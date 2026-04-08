// Lightweight ICS (iCalendar RFC 5545) parser.
// Extracts VEVENT blocks and returns structured CalendarEvent objects.

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  dtstart: string; // ISO 8601
  dtend: string;   // ISO 8601
  allDay: boolean;
  status?: string;
}

/**
 * Parse an ICS date string into an ISO 8601 string.
 * Handles formats: 20260306T100000Z, 20260306T100000, 20260306
 */
function parseIcsDate(raw: string): { iso: string; allDay: boolean } {
  const cleaned = raw.replace(/^.*:/, '').trim(); // strip TZID= prefix if present

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(cleaned)) {
    const y = cleaned.slice(0, 4);
    const m = cleaned.slice(4, 6);
    const d = cleaned.slice(6, 8);
    return { iso: `${y}-${m}-${d}T00:00:00`, allDay: true };
  }

  // DateTime: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`;
    return { iso, allDay: false };
  }

  // Fallback: return as-is
  return { iso: cleaned, allDay: false };
}

/**
 * Unfold ICS content lines (lines starting with space/tab are continuations).
 */
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

/**
 * Validate that the content looks like a valid ICS file.
 */
const ICS_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateIcsContent(content: string): { valid: boolean; error?: string } {
  if (content.length > ICS_MAX_BYTES) {
    return { valid: false, error: 'Calendar file is too large (max 10 MB)' };
  }
  if (!content.includes('BEGIN:VCALENDAR')) {
    return { valid: false, error: 'Missing BEGIN:VCALENDAR' };
  }
  if (!content.includes('END:VCALENDAR')) {
    return { valid: false, error: 'Missing END:VCALENDAR' };
  }
  return { valid: true };
}

interface ParsedEvent extends Partial<CalendarEvent> {
  rrule?: string;
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString().replace(/\.000Z$/, 'Z');
}

function addDaysLocal(iso: string, days: number): string {
  // For non-UTC dates (no Z suffix), manipulate the date string directly
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})$/);
  if (!match) return addDays(iso, days);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + days);
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${match[4]}`;
}

function shiftDate(iso: string, days: number): string {
  if (iso.endsWith('Z')) return addDays(iso, days);
  return addDaysLocal(iso, days);
}

function parseRruleParts(rrule: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const segment of rrule.split(';')) {
    const eq = segment.indexOf('=');
    if (eq !== -1) {
      parts[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1);
    }
  }
  return parts;
}

function expandRrule(event: CalendarEvent, rrule: string): CalendarEvent[] {
  const parts = parseRruleParts(rrule);
  const freq = parts['FREQ'];
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return [];

  const maxDays = 90;
  const count = parts['COUNT'] ? Number(parts['COUNT']) : undefined;
  const stepDays = freq === 'WEEKLY' ? 7 : 1;
  const limit = count ? Math.min(count - 1, Math.floor(maxDays / stepDays)) : Math.floor(maxDays / stepDays);

  const expanded: CalendarEvent[] = [];
  for (let i = 1; i <= limit; i++) {
    const dayOffset = i * stepDays;
    expanded.push({
      ...event,
      uid: `${event.uid}_rrule_${i}`,
      dtstart: shiftDate(event.dtstart, dayOffset),
      dtend: event.dtend ? shiftDate(event.dtend, dayOffset) : '',
    });
  }
  return expanded;
}

/**
 * Parse an ICS string and extract all VEVENT entries.
 */
export function parseIcs(icsContent: string): CalendarEvent[] {
  const unfolded = unfold(icsContent);
  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];
  const rrules: Map<number, string> = new Map();
  let current: ParsedEvent | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {
        uid: '',
        summary: '',
        description: '',
        location: '',
        dtstart: '',
        dtend: '',
        allDay: false,
      };
      continue;
    }

    if (line === 'END:VEVENT' && current) {
      if (current.dtstart) {
        const rrule = current.rrule;
        delete current.rrule;
        events.push(current as CalendarEvent);
        if (rrule) {
          rrules.set(events.length - 1, rrule);
        }
      }
      current = null;
      continue;
    }

    if (!current) continue;

    // Extract property value (handle parameters like DTSTART;TZID=...)
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1).trim();
    const propName = propPart.split(';')[0].toUpperCase();

    switch (propName) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.summary = unescapeIcs(value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeIcs(value);
        break;
      case 'LOCATION':
        current.location = unescapeIcs(value);
        break;
      case 'DTSTART': {
        const parsed = parseIcsDate(value);
        current.dtstart = parsed.iso;
        current.allDay = parsed.allDay;
        break;
      }
      case 'DTEND': {
        const parsed = parseIcsDate(value);
        current.dtend = parsed.iso;
        break;
      }
      case 'STATUS':
        current.status = value;
        break;
      case 'RRULE':
        current.rrule = value;
        break;
    }
  }

  // Expand RRULEs after main parsing loop
  const expanded: CalendarEvent[] = [];
  for (const [idx, rrule] of rrules) {
    expanded.push(...expandRrule(events[idx], rrule));
  }
  events.push(...expanded);

  return events;
}

function unescapeIcs(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Filter events that occur on a specific date (yyyy-MM-dd).
 */
export function getEventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter(event => {
    const startDate = event.dtstart.slice(0, 10);
    const endDate = event.dtend ? event.dtend.slice(0, 10) : startDate;
    return date >= startDate && date <= endDate;
  }).sort((a, b) => a.dtstart.localeCompare(b.dtstart));
}

/**
 * Format an ISO datetime to a display time string like "10:00 AM".
 */
export function formatEventTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/**
 * Calculate duration between two ISO strings and return a human-readable string.
 */
export function formatEventDuration(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  } catch {
    return '';
  }
}
