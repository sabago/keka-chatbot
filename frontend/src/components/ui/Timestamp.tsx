import { format } from 'date-fns';

interface TimestampProps {
  date: Date;
}

export default function Timestamp({ date }: TimestampProps) {
  const timeString = format(date, 'h:mm a');
  const fullDateString = format(date, 'PPpp'); // e.g., "Apr 29, 2021, 11:30 AM"

  return (
    <time
      className="text-xs text-muted mt-1"
      dateTime={date.toISOString()}
      title={fullDateString}
    >
      {timeString}
    </time>
  );
}
