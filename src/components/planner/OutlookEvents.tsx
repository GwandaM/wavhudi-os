// TODO: Connect to Electron IPC for local Outlook COM sync.

import { Clock, Video } from 'lucide-react';

const mockEvents = [
  { id: 1, title: 'Team Standup', time: '10:00 AM', duration: '15 min' },
  { id: 2, title: 'Design Review', time: '11:30 AM', duration: '30 min' },
  { id: 3, title: '1:1 with Manager', time: '2:00 PM', duration: '30 min' },
  { id: 4, title: 'Sprint Planning', time: '3:30 PM', duration: '1 hr' },
];

export function OutlookEvents() {
  return (
    <div className="space-y-1.5">
      {mockEvents.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/50"
        >
          <Video className="h-4 w-4 mt-0.5 shrink-0 text-accent-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{event.title}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {event.time} · {event.duration}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
