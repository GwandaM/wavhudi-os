import { describe, it, expect } from 'vitest';
import { parseIcs, getEventsForDate, formatEventTime, formatEventDuration, validateIcsContent } from './icsParser';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:event-001@test.com
SUMMARY:Team Standup
DTSTART:20260306T100000Z
DTEND:20260306T101500Z
LOCATION:Room 42
DESCRIPTION:Daily sync meeting
END:VEVENT
BEGIN:VEVENT
UID:event-002@test.com
SUMMARY:Design Review
DTSTART:20260306T143000Z
DTEND:20260306T153000Z
END:VEVENT
BEGIN:VEVENT
UID:event-003@test.com
SUMMARY:All Day Event
DTSTART;VALUE=DATE:20260306
DTEND;VALUE=DATE:20260307
END:VEVENT
END:VCALENDAR`;

describe('parseIcs', () => {
  it('extracts VEVENT entries from ICS content', () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events).toHaveLength(3);
  });

  it('parses summary, location, description', () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events[0].summary).toBe('Team Standup');
    expect(events[0].location).toBe('Room 42');
    expect(events[0].description).toBe('Daily sync meeting');
  });

  it('parses datetime with Z suffix', () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events[0].dtstart).toBe('2026-03-06T10:00:00Z');
    expect(events[0].dtend).toBe('2026-03-06T10:15:00Z');
    expect(events[0].allDay).toBe(false);
  });

  it('parses all-day events', () => {
    const events = parseIcs(SAMPLE_ICS);
    const allDay = events.find(e => e.summary === 'All Day Event');
    expect(allDay).toBeDefined();
    expect(allDay!.allDay).toBe(true);
    expect(allDay!.dtstart).toContain('2026-03-06');
  });

  it('handles empty input', () => {
    expect(parseIcs('')).toEqual([]);
  });

  it('handles ICS with no events', () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR`;
    expect(parseIcs(ics)).toEqual([]);
  });

  it('handles TZID parameter in DTSTART', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tz-event
SUMMARY:With timezone
DTSTART;TZID=America/New_York:20260306T090000
DTEND;TZID=America/New_York:20260306T100000
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].dtstart).toBe('2026-03-06T09:00:00');
  });

  it('unescapes special characters', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:escape-test
SUMMARY:Test\\, with commas
DESCRIPTION:Line one\\nLine two
DTSTART:20260306T100000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].summary).toBe('Test, with commas');
    expect(events[0].description).toBe('Line one\nLine two');
  });

  it('handles folded lines (continuations)', () => {
    // RFC 5545: fold inserts CRLF+LWSP. Unfold removes both, so the content
    // must already contain the space if a word boundary is intended.
    const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fold-test\n' +
      'SUMMARY:Very long summary that gets \n folded across lines\n' +
      'DTSTART:20260306T100000Z\nEND:VEVENT\nEND:VCALENDAR';
    const events = parseIcs(ics);
    expect(events[0].summary).toBe('Very long summary that gets folded across lines');
  });
});

describe('getEventsForDate', () => {
  const events = parseIcs(SAMPLE_ICS);

  it('returns events matching the date', () => {
    const result = getEventsForDate(events, '2026-03-06');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for dates with no events', () => {
    const result = getEventsForDate(events, '2026-01-01');
    expect(result).toEqual([]);
  });

  it('sorts events by start time', () => {
    const result = getEventsForDate(events, '2026-03-06');
    for (let i = 1; i < result.length; i++) {
      expect(result[i].dtstart >= result[i - 1].dtstart).toBe(true);
    }
  });
});

describe('formatEventTime', () => {
  it('formats to a locale time string', () => {
    const time = formatEventTime('2026-03-06T10:00:00Z');
    // Output depends on local TZ — just verify it produces a valid time pattern
    expect(time).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('formats non-UTC time', () => {
    // No Z suffix — treated as local time, avoids TZ conversion
    const time = formatEventTime('2026-03-06T14:30:00');
    expect(time).toMatch(/2:30\s*PM/i);
  });
});

describe('formatEventDuration', () => {
  it('formats minutes duration', () => {
    expect(formatEventDuration('2026-03-06T10:00:00Z', '2026-03-06T10:15:00Z')).toBe('15 min');
  });

  it('formats hour duration', () => {
    expect(formatEventDuration('2026-03-06T10:00:00Z', '2026-03-06T11:00:00Z')).toBe('1 hr');
  });

  it('formats hours and minutes', () => {
    expect(formatEventDuration('2026-03-06T10:00:00Z', '2026-03-06T11:30:00Z')).toBe('1 hr 30 min');
  });
});

describe('validateIcsContent', () => {
  it('returns valid for proper ICS content', () => {
    expect(validateIcsContent(SAMPLE_ICS)).toEqual({ valid: true });
  });

  it('rejects content missing BEGIN:VCALENDAR', () => {
    const result = validateIcsContent('END:VCALENDAR');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('BEGIN:VCALENDAR');
  });

  it('rejects content missing END:VCALENDAR', () => {
    const result = validateIcsContent('BEGIN:VCALENDAR');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('END:VCALENDAR');
  });

  it('rejects empty string', () => {
    expect(validateIcsContent('').valid).toBe(false);
  });

  it('rejects arbitrary text', () => {
    expect(validateIcsContent('hello world').valid).toBe(false);
  });
});

describe('parseIcs - STATUS field', () => {
  it('parses event status', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:status-test
SUMMARY:Cancelled Meeting
DTSTART:20260306T100000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].status).toBe('CANCELLED');
  });

  it('status is undefined when not provided', () => {
    const events = parseIcs(SAMPLE_ICS);
    expect(events[0].status).toBeUndefined();
  });
});

describe('parseIcs - RRULE expansion', () => {
  it('expands FREQ=DAILY events', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:daily-001
SUMMARY:Daily Standup
DTSTART:20260306T100000Z
DTEND:20260306T101500Z
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    // Original + 4 expanded occurrences
    expect(events).toHaveLength(5);
    expect(events[0].uid).toBe('daily-001');
    expect(events[1].uid).toBe('daily-001_rrule_1');
    expect(events[1].dtstart).toContain('2026-03-07');
  });

  it('expands FREQ=WEEKLY events', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:weekly-001
SUMMARY:Weekly Review
DTSTART:20260306T140000Z
DTEND:20260306T150000Z
RRULE:FREQ=WEEKLY;COUNT=4
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    // Original + 3 expanded occurrences
    expect(events).toHaveLength(4);
    expect(events[0].uid).toBe('weekly-001');
    expect(events[1].dtstart).toContain('2026-03-13');
    expect(events[2].dtstart).toContain('2026-03-20');
    expect(events[3].dtstart).toContain('2026-03-27');
  });

  it('does not expand unsupported RRULE frequencies', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:monthly-001
SUMMARY:Monthly Review
DTSTART:20260306T140000Z
DTEND:20260306T150000Z
RRULE:FREQ=MONTHLY;COUNT=3
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
  });

  it('limits daily expansion to 90 days', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:unlimited-daily
SUMMARY:Unlimited Daily
DTSTART:20260306T100000Z
DTEND:20260306T101500Z
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    // Original + 90 expanded
    expect(events).toHaveLength(91);
  });
});
