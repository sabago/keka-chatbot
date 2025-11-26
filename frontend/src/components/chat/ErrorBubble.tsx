import Button from "../ui/Button";

interface ErrorBubbleProps {
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
}

export default function ErrorBubble({
  message,
  onRetry,
  onDismiss,
}: ErrorBubbleProps) {
  return (
    <div
      className="flex flex-col gap-3 p-4 bg-red-50 border border-danger rounded-xl"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span className="text-danger text-xl" role="img" aria-label="Error">
          ⚠️
        </span>
        <p className="text-sm text-danger flex-1">{message}</p>
      </div>
      <div className="flex gap-1">
        <Button
          onClick={onRetry}
          variant="default"
          className="text-danger border-danger"
        >
          Retry
        </Button>
        {onDismiss && (
          <Button onClick={onDismiss} variant="default">
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
