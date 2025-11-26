export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-3" aria-live="polite" aria-label="Typing">
      <div className="flex items-center space-x-1 px-4 py-3 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl shadow-sm">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce-dots" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce-dots" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce-dots" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
