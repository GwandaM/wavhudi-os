import { useEffect } from 'react';

interface ShortcutHandlers {
  onCommandPalette: () => void;
  onNewTask: () => void;
  onSwitchMyDay: () => void;
  onSwitchTimeline: () => void;
  onSwitchReview: () => void;
  onEscape: () => void;
  onShowShortcuts: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K — Command palette (works even in inputs)
      if (meta && e.key === 'k') {
        e.preventDefault();
        handlers.onCommandPalette();
        return;
      }

      // Don't handle other shortcuts when focused on inputs
      if (isInput) return;

      // Cmd+N — New task
      if (meta && e.key === 'n') {
        e.preventDefault();
        handlers.onNewTask();
        return;
      }

      // Cmd+1 — My Day
      if (meta && e.key === '1') {
        e.preventDefault();
        handlers.onSwitchMyDay();
        return;
      }

      // Cmd+2 — Timeline
      if (meta && e.key === '2') {
        e.preventDefault();
        handlers.onSwitchTimeline();
        return;
      }

      // Cmd+3 — Review
      if (meta && e.key === '3') {
        e.preventDefault();
        handlers.onSwitchReview();
        return;
      }

      // Escape — Close panels
      if (e.key === 'Escape') {
        handlers.onEscape();
        return;
      }

      // ? — Show shortcuts
      if (e.key === '?' && !e.shiftKey) {
        handlers.onShowShortcuts();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

export const SHORTCUTS = [
  { keys: '⌘K', label: 'Open command palette' },
  { keys: '⌘N', label: 'New task' },
  { keys: '⌘1', label: 'Switch to My Day' },
  { keys: '⌘2', label: 'Switch to Timeline' },
  { keys: '⌘3', label: 'Switch to Review' },
  { keys: 'Esc', label: 'Close panel / dialog' },
  { keys: '?', label: 'Show keyboard shortcuts' },
];
