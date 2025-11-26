import { motion } from "framer-motion";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Avatar from "../ui/Avatar";
import Timestamp from "../ui/Timestamp";
import type { ChatMessage } from "../../types";

interface MessageBubbleProps {
  message: ChatMessage;
  showTimestamp?: boolean;
}

export default function MessageBubble({
  message,
  showTimestamp = true,
}: MessageBubbleProps) {
  const isBot = message.sender === "bot";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-1 ${isBot ? "flex-row" : "flex-row-reverse"}`}
    >
      <div className="flex-shrink-0">
        <Avatar type={message.sender} />
      </div>

      <div
        className={`flex flex-col ${
          isBot ? "items-start" : "items-end"
        } max-w-[80%]`}
      >
        <div
          className={`message-bubble ${
            isBot ? "message-bubble-bot" : "message-bubble-user"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>

          {/* Link Cards */}
          {message.links && message.links.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-surface rounded-lg border border-gray-200 hover:border-brand transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-brand text-sm">
                        {link.title}
                      </div>
                      {link.description && (
                        <div className="text-xs text-muted mt-1">
                          {link.description}
                        </div>
                      )}
                    </div>
                    <ArrowTopRightOnSquareIcon
                      className="w-4 h-4 text-muted flex-shrink-0"
                      strokeWidth={2}
                    />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {showTimestamp && <Timestamp date={message.timestamp} />}
      </div>
    </motion.div>
  );
}
