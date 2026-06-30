interface EventIdBadgeProps {
  eventId: string;
  className?: string;
}

/** Admin / Display で同一イベントか目視確認するための ID 表示 */
export default function EventIdBadge({ eventId, className = '' }: EventIdBadgeProps) {
  return (
    <span
      className={`font-mono text-xs text-slate-500 ${className}`}
      title={eventId}
    >
      ID: {eventId.slice(0, 8)}…
    </span>
  );
}
