import { motion, AnimatePresence } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import FooterDisclaimer from "./FooterDisclaimer";
import type { ChatMessage } from "../../types";

interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  onClose: () => void;
  onButtonClick: (value: string, label: string) => void;
  onIntakeSubmit: (value: string) => void;
  onIntakeCancel: () => void;
  onIntakeBack: () => void;
  canGoBack: boolean;
  getInputValue: (messageIndex: number) => string;
}

export default function ChatPanel({
  isOpen,
  messages,
  isLoading,
  onClose,
  onButtonClick,
  onIntakeSubmit,
  onIntakeCancel,
  onIntakeBack,
  canGoBack,
  getInputValue,
}: ChatPanelProps) {
  const containerRef = useFocusTrap(isOpen);

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black bg-opacity-20 z-40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="chat-panel z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-header"
            onKeyDown={handleKeyDown}
          >
            <ChatHeader onClose={onClose} />

            <MessageList
              messages={messages}
              isLoading={isLoading}
              onButtonClick={onButtonClick}
              onIntakeSubmit={onIntakeSubmit}
              onIntakeCancel={onIntakeCancel}
              onIntakeBack={onIntakeBack}
              canGoBack={canGoBack}
              getInputValue={getInputValue}
            />

            <FooterDisclaimer />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
