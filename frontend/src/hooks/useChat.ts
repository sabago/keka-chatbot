import { useState, useCallback, useEffect } from 'react';
import { sendChatMessage } from '../api';
import type { ChatMessage } from '../types';

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Storage key for input values
const INPUT_VALUES_STORAGE_KEY = 'keka-chat-input-values';

// Helper functions for input value persistence
function saveInputValuesToStorage(values: Record<number, string>): void {
  try {
    sessionStorage.setItem(INPUT_VALUES_STORAGE_KEY, JSON.stringify(values));
  } catch (error) {
    console.warn('Failed to save input values to sessionStorage:', error);
  }
}

function loadInputValuesFromStorage(): Record<number, string> {
  try {
    const stored = sessionStorage.getItem(INPUT_VALUES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load input values from sessionStorage:', error);
    return {};
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(generateSessionId);
  const [sessionData, setSessionData] = useState<Record<string, any>>({});
  const [messageHistory, setMessageHistory] = useState<ChatMessage[][]>([]);

  // Store input values by message index for back button functionality
  const [inputValues, setInputValues] = useState<Record<number, string>>(() =>
    loadInputValuesFromStorage()
  );

  // Save input values to sessionStorage whenever they change
  useEffect(() => {
    saveInputValuesToStorage(inputValues);
  }, [inputValues]);

  const sendMessage = useCallback(
    async (message: string, hideUserMessage = false, displayText?: string) => {
      if (isLoading) return;

      setError(null);

      // Add user message
      if (!hideUserMessage && message !== 'start') {
        const userMessage: ChatMessage = {
          id: generateSessionId(),
          sender: 'user',
          text: displayText || message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      setIsLoading(true);

      try {
        const response = await sendChatMessage(message, sessionId, sessionData);

        // Add bot response
        const botMessage: ChatMessage = {
          id: generateSessionId(),
          sender: 'bot',
          text: response.text,
          buttons: response.buttons,
          links: response.links,
          input_type: response.input_type,
          input_label: response.input_label,
          input_placeholder: response.input_placeholder,
          timestamp: new Date(),
          session_data: response.session_data,
        };
        setMessages((prev) => {
          const newMessages = [...prev, botMessage];
          // Save to history before adding new message
          setMessageHistory((hist) => [...hist, prev]);
          return newMessages;
        });

        // Update session data
        if (response.session_data) {
          setSessionData(response.session_data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        const errorMessage: ChatMessage = {
          id: generateSessionId(),
          sender: 'bot',
          text: '⚠️ Sorry, something went wrong. Please try again.',
          buttons: [{ label: '🏠 Back to Home', value: 'home' }],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, sessionData]
  );

  const retry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.sender === 'user');
      if (lastUserMessage) {
        sendMessage(lastUserMessage.text);
      }
    }
  }, [messages, sendMessage]);

  const goBack = useCallback(() => {
    if (messageHistory.length > 0) {
      // Get the previous state
      const previousMessages = messageHistory[messageHistory.length - 1];
      setMessages(previousMessages);
      setMessageHistory((hist) => hist.slice(0, -1));
      
      // Restore session data from the previous bot message
      const lastBotMessage = [...previousMessages]
        .reverse()
        .find((m) => m.sender === 'bot');
      if (lastBotMessage?.session_data) {
        setSessionData(lastBotMessage.session_data);
      }
    }
  }, [messageHistory]);

  const canGoBack = messageHistory.length > 0;

  // Save input value for the current step (to be restored on back)
  const saveInputValue = useCallback((value: string) => {
    const currentIndex = messages.length - 1; // Index of the current bot message
    if (currentIndex >= 0) {
      setInputValues((prev) => ({
        ...prev,
        [currentIndex]: value,
      }));
    }
  }, [messages.length]);

  // Get saved input value for the current bot message
  const getInputValue = useCallback((messageIndex: number): string => {
    return inputValues[messageIndex] || '';
  }, [inputValues]);

  // Clear input value after successfully moving forward
  const clearInputValue = useCallback((messageIndex: number) => {
    setInputValues((prev) => {
      const newValues = { ...prev };
      delete newValues[messageIndex];
      return newValues;
    });
  }, []);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sessionData,
    sendMessage,
    retry,
    goBack,
    canGoBack,
    saveInputValue,
    getInputValue,
    clearInputValue,
  };
}
