import { useState, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import ChatLauncher from "./chat/ChatLauncher";
import ChatPanel from "./chat/ChatPanel";
import {
  trackSessionStart,
  trackSessionEnd,
  trackButtonClick,
  trackBackButtonUse,
  trackMessage,
} from "../utils/analytics";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(true);
  const {
    messages,
    isLoading,
    sendMessage,
    sessionId,
    sessionData,
    saveInputValue,
    getInputValue,
    clearInputValue
  } = useChat();

  // Get canGoBack from backend's session data (last bot message)
  const canGoBack = (() => {
    const lastBotMessage = [...messages].reverse().find(m => m.sender === 'bot');
    return lastBotMessage?.session_data?.can_go_back ?? false;
  })();

  // Initialize chat on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sendMessage("start", true);
      // Track session start
      trackSessionStart(sessionId);
    }
  }, [isOpen, messages.length, sendMessage, sessionId]);

  // Persist open/close state
  useEffect(() => {
    const savedState = sessionStorage.getItem("chat-open");
    if (savedState === "true") {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("chat-open", isOpen ? "true" : "false");
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    // Track session end when closing chat
    trackSessionEnd(sessionId);
    setIsOpen(false);
  };

  const handleButtonClick = (value: string, label: string) => {
    // Track button click with current state
    const currentState = sessionData?.state || 'unknown';
    trackButtonClick(sessionId, label, value, currentState);
    trackMessage();

    // Show user's selection as message for non-navigation buttons
    const navigationButtons = [
      "start_intake",
      "therapy_rehab",
      "home_care",
      "equipment",
      "business",
      "insurance",
      "community",
      "home",
    ];

    const shouldShowMessage = !navigationButtons.includes(value);
    sendMessage(value, !shouldShowMessage, label);
  };

  const handleIntakeSubmit = (value: string) => {
    // Track message submission
    trackMessage();

    // Save the input value before sending (for back button functionality)
    saveInputValue(value);

    // Send the user's input and show it as a user message
    // The backend will validate and proceed to next step
    sendMessage(value, false);

    // Clear the saved value after successful submission
    // (will be restored if user goes back)
    const currentIndex = messages.length - 1;
    setTimeout(() => {
      clearInputValue(currentIndex);
    }, 100);
  };

  const handleIntakeCancel = () => {
    // Go back to main menu when user cancels intake form
    sendMessage("home", true);
  };

  const handleIntakeBack = () => {
    // Track back button usage
    const currentState = sessionData?.state || 'unknown';
    trackBackButtonUse(sessionId, currentState, 'previous');

    // Send "back" message to backend to sync state
    // The backend will call popState() and return the appropriate previous state
    sendMessage("back", true);
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="pointer-events-auto">
        <ChatLauncher onClick={handleOpen} isOpen={isOpen} />

        <ChatPanel
          isOpen={isOpen}
          messages={messages}
          isLoading={isLoading}
          onClose={handleClose}
          onButtonClick={handleButtonClick}
          onIntakeSubmit={handleIntakeSubmit}
          onIntakeCancel={handleIntakeCancel}
          onIntakeBack={handleIntakeBack}
          canGoBack={canGoBack}
          getInputValue={getInputValue}
        />
      </div>
    </div>
  );
}
