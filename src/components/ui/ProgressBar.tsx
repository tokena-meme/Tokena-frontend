interface ProgressBarProps {
  value: number;
  max?: number;
  migrated?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, max = 100, migrated = false, showLabel = false, className = '' }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden">
        <div
          className={migrated ? 'progress-bar-migrated h-full rounded-full' : 'progress-bar h-full rounded-full'}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs font-mono text-[#555]">
          <span>{pct.toFixed(1)}%</span>
          <span>{value.toFixed(1)} / {max} SOL</span>
        </div>
      )}
    </div>
  );
}
