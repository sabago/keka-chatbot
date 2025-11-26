import { XMarkIcon } from "@heroicons/react/24/outline";

interface ChatHeaderProps {
  onClose: () => void;
}

export default function ChatHeader({ onClose }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#27A9E2] to-blue-500 text-white shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
          <img
            src="/keka-logo.png"
            alt="Keka Rehab Services"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h2 className="font-semibold text-base">Keka Support</h2>
          <p className="text-xs text-blue-100">We're here to help</p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="p-2 hover:bg-white/20 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Close chat"
      >
        <XMarkIcon className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
