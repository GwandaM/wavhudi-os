import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type RangeMode = 'day' | 'week' | 'month' | 'custom';

interface DateRangeSelectorProps {
  mode: RangeMode;
  onModeChange: (mode: RangeMode) => void;
  customStart: Date | undefined;
  customEnd: Date | undefined;
  onCustomRangeChange: (start: Date | undefined, end: Date | undefined) => void;
}

const modes: { value: RangeMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeSelector({
  mode,
  onModeChange,
  customStart,
  customEnd,
  onCustomRangeChange,
}: DateRangeSelectorProps) {
  const [pickingStart, setPickingStart] = useState(true);

  const handleModeClick = (m: RangeMode) => {
    onModeChange(m);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border bg-secondary/50 p-0.5">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => handleModeClick(m.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              mode === m.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 text-xs gap-1.5',
                  !customStart && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {customStart ? format(customStart, 'MMM d') : 'Start'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customStart}
                onSelect={(d) => {
                  onCustomRangeChange(d, customEnd);
                }}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 text-xs gap-1.5',
                  !customEnd && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {customEnd ? format(customEnd, 'MMM d') : 'End'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customEnd}
                onSelect={(d) => {
                  onCustomRangeChange(customStart, d);
                }}
                disabled={(date) => customStart ? date < customStart : false}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
