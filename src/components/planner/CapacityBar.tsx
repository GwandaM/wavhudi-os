import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/priority';

interface CapacityBarProps {
  plannedMinutes: number;
  capacityMinutes: number;
  className?: string;
}

export function CapacityBar({ plannedMinutes, capacityMinutes, className }: CapacityBarProps) {
  const ratio = capacityMinutes > 0 ? plannedMinutes / capacityMinutes : 0;
  const percentage = Math.min(ratio * 100, 100);
  const state = ratio <= 0.75 ? 'ok' : ratio <= 1.0 ? 'warn' : 'over';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          {formatMinutes(plannedMinutes)} planned
        </span>
        <span className={cn(
          'font-semibold',
          state === 'ok' && 'text-capacity-ok',
          state === 'warn' && 'text-capacity-warn',
          state === 'over' && 'text-capacity-over',
        )}>
          {formatMinutes(capacityMinutes - plannedMinutes)} {ratio <= 1 ? 'remaining' : 'over'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            state === 'ok' && 'bg-capacity-ok',
            state === 'warn' && 'bg-capacity-warn',
            state === 'over' && 'bg-capacity-over',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {formatMinutes(capacityMinutes)} daily capacity
      </p>
    </div>
  );
}
