import { useRef, useState } from 'react';
import { Clock, Video, Upload, Trash2, CalendarDays, MapPin, X, Loader2 } from 'lucide-react';
import { useCalendarEventsContext } from '@/contexts/CalendarEventsContext';
import { validateIcsContent, formatEventTime, formatEventDuration, type CalendarEvent } from '@/lib/icsParser';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CalendarEventsProps {
  date: string; // yyyy-MM-dd
}

export function CalendarEvents({ date }: CalendarEventsProps) {
  const { getForDate, importIcs, clearEvents, removeEvent, count, loading } = useCalendarEventsContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const todayEvents = getForDate(date);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        const validation = validateIcsContent(content);
        if (!validation.valid) {
          toast.error('Invalid calendar file', {
            description: validation.error,
          });
          setImporting(false);
          return;
        }

        const imported = importIcs(content);
        if (imported === 0) {
          toast.warning('No events found in the file.');
        } else {
          toast.success(`Imported ${imported} event${imported !== 1 ? 's' : ''}`);
        }
      }
      setImporting(false);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
      setImporting(false);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {todayEvents.length > 0 ? (
        <div className="space-y-1">
          {todayEvents.map((event, i) => (
            <EventRow key={event.uid || i} event={event} onRemove={removeEvent} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/50">
          <CalendarDays className="h-5 w-5 mb-1.5" />
          <p className="text-xs">{count > 0 ? 'No events today' : 'No calendar imported'}</p>
        </div>
      )}

      {/* Import / Clear actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors',
            importing && 'opacity-50 cursor-not-allowed'
          )}
        >
          {importing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {importing ? 'Importing…' : 'Import .ics'}
        </button>
        {count > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Clear all imported events"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all calendar events?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all {count} imported event{count !== 1 ? 's' : ''}. You can re-import your .ics file afterwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clearEvents();
                    toast.success('All calendar events cleared');
                  }}
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ics,.ical"
        onChange={handleFileImport}
        className="hidden"
      />
    </div>
  );
}

function EventRow({ event, onRemove }: { event: CalendarEvent; onRemove: (uid: string) => void }) {
  const startTime = formatEventTime(event.dtstart);
  const duration = event.dtend ? formatEventDuration(event.dtstart, event.dtend) : '';
  const isCancelled = event.status === 'CANCELLED';

  return (
    <div className={cn(
      'group flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/30',
      isCancelled && 'opacity-50'
    )}>
      <Video className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-foreground" />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13px] font-medium leading-tight truncate',
          isCancelled && 'line-through'
        )}>
          {event.summary}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {event.allDay ? 'All day' : startTime}
            {duration && !event.allDay && ` · ${duration}`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground/70" />
            <p className="text-[11px] text-muted-foreground/70 truncate">
              {event.location}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={() => onRemove(event.uid)}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-all"
        title="Remove event"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
