import { useState } from 'react';
import { Clock, Video, MapPin, RefreshCw, LogOut, Settings, Loader2, Calendar, AlertCircle, ExternalLink } from 'lucide-react';
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar';
import type { OutlookCalendarEvent } from '@/electron.d';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface OutlookEventsProps {
  date: string; // yyyy-MM-dd
}

export function OutlookEvents({ date }: OutlookEventsProps) {
  const { events, connected, configured, loading, error, isElectron, connect, disconnect, saveConfig, refresh } =
    useOutlookCalendar(date);

  const [showConfig, setShowConfig] = useState(false);
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  if (!isElectron) return null;

  const handleSaveConfig = async () => {
    if (!clientId.trim() || !tenantId.trim()) return;
    setSaving(true);
    await saveConfig({ clientId: clientId.trim(), tenantId: tenantId.trim() });
    setSaving(false);
    setShowConfig(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    await connect();
    setConnecting(false);
  };

  if (loading && !connected) {
    return (
      <div className="flex items-center justify-center py-3 text-muted-foreground/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }

  // Config entry panel
  if (showConfig) {
    return (
      <div className="space-y-3 px-1">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Register an app in{' '}
          <span className="text-foreground font-medium">Azure Portal → App registrations</span>,
          add a{' '}
          <span className="font-medium text-foreground">Mobile/Desktop redirect URI</span>{' '}
          pointing to <code className="text-[10px] bg-muted px-1 rounded">http://localhost</code>,
          then grant <code className="text-[10px] bg-muted px-1 rounded">Calendars.Read</code>.
        </p>
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Application (Client) ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            spellCheck={false}
          />
          <input
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Directory (Tenant) ID or 'organizations'"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveConfig}
            disabled={saving || !clientId.trim() || !tenantId.trim()}
            className="flex-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => setShowConfig(false)}
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Not yet connected
  if (!connected) {
    return (
      <div className="space-y-2">
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
            <p className="text-[11px] text-destructive leading-snug">{error}</p>
          </div>
        )}
        <div className="flex flex-col items-center gap-2 py-2">
          <Calendar className="h-5 w-5 text-muted-foreground/40" />
          <p className="text-[11px] text-muted-foreground">No Outlook calendar connected</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={!configured || connecting}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
            configured
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted/40 text-muted-foreground cursor-not-allowed'
          )}
        >
          {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
          {connecting ? 'Opening browser…' : 'Sign in with Microsoft'}
        </button>
        <button
          onClick={() => setShowConfig(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <Settings className="h-3 w-3" />
          {configured ? 'Edit app credentials' : 'Set up app credentials first'}
        </button>
      </div>
    );
  }

  // Connected — show events
  return (
    <div className="space-y-1">
      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground/50">
          <Calendar className="h-5 w-5" />
          <p className="text-[11px]">No events today</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 mt-1">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
          <p className="text-[11px] text-destructive leading-snug">{error}</p>
        </div>
      )}
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          title="Refresh calendar"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
        <div className="flex-1" />
        <button
          onClick={disconnect}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Disconnect Outlook"
        >
          <LogOut className="h-3 w-3" />
          Disconnect
        </button>
      </div>
    </div>
  );
}

function formatEventTime(isoDateTime: string): string {
  try {
    // Graph returns ISO without 'Z', so treat as local
    const dt = parseISO(isoDateTime.endsWith('Z') ? isoDateTime : isoDateTime + 'Z');
    return format(dt, 'h:mm a');
  } catch {
    return isoDateTime.slice(11, 16);
  }
}

function formatDuration(start: string, end: string): string {
  try {
    const startMs = new Date(start.endsWith('Z') ? start : start + 'Z').getTime();
    const endMs = new Date(end.endsWith('Z') ? end : end + 'Z').getTime();
    const mins = Math.round((endMs - startMs) / 60_000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  } catch {
    return '';
  }
}

function EventRow({ event }: { event: OutlookCalendarEvent }) {
  const startTime = formatEventTime(event.startDateTime);
  const duration = formatDuration(event.startDateTime, event.endDateTime);
  const cancelled = event.isCancelled;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/30',
        cancelled && 'opacity-40'
      )}
    >
      <Video className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-foreground" />
      <div className="flex-1 min-w-0">
        <p className={cn('text-[13px] font-medium leading-tight truncate', cancelled && 'line-through')}>
          {event.subject}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {event.isAllDay ? 'All day' : startTime}
            {!event.isAllDay && duration && ` · ${duration}`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground/70 truncate">{event.location}</p>
          </div>
        )}
      </div>
    </div>
  );
}
