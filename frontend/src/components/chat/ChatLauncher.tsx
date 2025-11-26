import { motion } from 'framer-motion';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface ChatLauncherProps {
  onClick: () => void;
  isOpen: boolean;
}

export default function ChatLauncher({ onClick, isOpen }: ChatLauncherProps) {
  if (isOpen) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onClick={onClick}
      className="chat-launcher"
      aria-label="Open chat"
      aria-haspopup="dialog"
    >
      <ChatBubbleLeftRightIcon className="w-7 h-7" strokeWidth={2} />
    </motion.button>
  );
}
