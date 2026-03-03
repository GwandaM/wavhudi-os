import { X } from 'lucide-react';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={keys} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <kbd className="px-2 py-0.5 rounded bg-secondary text-xs font-mono font-medium">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t">
          <p className="text-[11px] text-muted-foreground">
            Tip: Type <kbd className="px-1 py-0.5 rounded bg-secondary text-[10px] font-mono">!urgent 2h</kbd> when
            adding tasks to set priority and time estimate.
          </p>
        </div>
      </div>
    </div>
  );
}
