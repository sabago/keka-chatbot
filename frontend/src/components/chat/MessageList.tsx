import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import ChipTray from "./ChipTray";
import TypingIndicator from "./TypingIndicator";
import IntakeForm from "../intake/IntakeForm";
import DynamicInputForm from "../intake/DynamicInputForm";
import type { ChatMessage } from "../../types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onButtonClick: (value: string, label: string) => void;
  onIntakeSubmit: (value: string) => void;
  onIntakeCancel: () => void;
  onIntakeBack: () => void;
  canGoBack: boolean;
  getInputValue: (messageIndex: number) => string;
}

export default function MessageList({
  messages,
  isLoading,
  onButtonClick,
  onIntakeSubmit,
  onIntakeCancel,
  onIntakeBack,
  canGoBack,
  getInputValue,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Group messages by time (show timestamp if >2 min gap)
  const shouldShowTimestamp = (index: number): boolean => {
    if (index === messages.length - 1) return true;
    if (index === 0) return false;

    const currentMessage = messages[index];
    const nextMessage = messages[index + 1];

    if (currentMessage.sender !== nextMessage.sender) return true;

    const timeDiff =
      nextMessage.timestamp.getTime() - currentMessage.timestamp.getTime();
    return timeDiff > 2 * 60 * 1000; // 2 minutes
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-hide px-4 py-6 space-y-4 bg-gradient-to-b from-gray-50/30 to-white"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((message, index) => (
        <div key={message.id}>
          <MessageBubble
            message={message}
            showTimestamp={shouldShowTimestamp(index)}
          />

          {/* Show intake form or buttons for the last bot message */}
          {message.sender === "bot" &&
            index === messages.length - 1 &&
            !isLoading && (
              <>
                {/* Show Dynamic Input Form if input_type is specified */}
                {message.input_type && message.input_type !== "none" ? (
                  <div className="mt-3">
                    <DynamicInputForm
                      inputType={message.input_type}
                      label={message.input_label}
                      placeholder={message.input_placeholder}
                      initialValue={getInputValue(index)}
                      onSubmit={onIntakeSubmit}
                      onCancel={onIntakeCancel}
                      onBack={onIntakeBack}
                      canGoBack={canGoBack}
                    />
                  </div>
                ) : message.session_data?.contact_type &&
                  (!message.buttons || message.buttons.length === 0) ? (
                  /* Fallback to old IntakeForm for backward compatibility */
                  <div className="mt-3">
                    <IntakeForm
                      contactType={
                        message.session_data.contact_type as "email" | "phone"
                      }
                      onSubmit={onIntakeSubmit}
                      onCancel={onIntakeCancel}
                      onBack={onIntakeBack}
                      canGoBack={canGoBack}
                    />
                  </div>
                ) : (
                  /* Show buttons if available */
                  message.buttons &&
                  message.buttons.length > 0 && (
                    <div className="mt-3">
                      <ChipTray
                        buttons={message.buttons}
                        onButtonClick={onButtonClick}
                        disabled={isLoading}
                      />
                    </div>
                  )
                )}
              </>
            )}
        </div>
      ))}

      {isLoading && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}
