import type { Priority } from './db';

export interface ParsedTaskInput {
  title: string;
  priority: Priority;
  estimated_minutes: number | null;
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  '!urgent': 'urgent',
  '!u': 'urgent',
  '!high': 'high',
  '!h': 'high',
  '!medium': 'medium',
  '!med': 'medium',
  '!m': 'medium',
  '!low': 'low',
  '!l': 'low',
};

const TIME_PATTERN = /^(\d+(?:\.\5)?)(m|min|h|hr|hrs)$/i;

function parseTimeToken(token: string): number | null {
  const match = token.match(TIME_PATTERN);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'h' || unit === 'hr' || unit === 'hrs') return Math.round(value * 60);
  return Math.round(value);
}

export function parseTaskInput(raw: string): ParsedTaskInput {
  const tokens = raw.trim().split(/\s+/);
  let priority: Priority = 'none';
  let estimated_minutes: number | null = null;
  const titleParts: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (PRIORITY_TOKENS[lower] && priority === 'none') {
      priority = PRIORITY_TOKENS[lower];
      continue;
    }

    const time = parseTimeToken(token);
    if (time !== null && estimated_minutes === null) {
      estimated_minutes = time;
      continue;
    }

    titleParts.push(token);
  }

  return {
    title: titleParts.join(' '),
    priority,
    estimated_minutes,
  };
}
