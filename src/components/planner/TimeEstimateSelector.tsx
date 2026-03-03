import { useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeEstimateSelectorProps {
  value: number | null;
  onChange: (minutes: number | null) => void;
  compact?: boolean;
}

const PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
];

export function TimeEstimateSelector({ value, onChange, compact }: TimeEstimateSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const isPreset = PRESETS.some(p => p.minutes === value);

  const handleCustomSubmit = () => {
    const num = parseInt(customValue, 10);
    if (num > 0) {
      onChange(num);
      setShowCustom(false);
      setCustomValue('');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            onClick={() => onChange(value === p.minutes ? null : p.minutes)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
              value === p.minutes
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Time Estimate
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            onClick={() => onChange(value === p.minutes ? null : p.minutes)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              value === p.minutes
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            !isPreset && value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          {!isPreset && value ? `${value}m` : 'Custom'}
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="Minutes"
            className="w-20 rounded-md border bg-secondary/30 px-2 py-1 text-xs outline-none focus:border-primary/30"
          />
          <button
            onClick={handleCustomSubmit}
            className="px-2 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}
