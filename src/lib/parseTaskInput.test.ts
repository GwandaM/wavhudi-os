import { describe, it, expect } from 'vitest';
import { parseTaskInput } from './parseTaskInput';

describe('parseTaskInput', () => {
  it('returns plain title when no tokens present', () => {
    const result = parseTaskInput('Fix login bug');
    expect(result).toEqual({
      title: 'Fix login bug',
      priority: 'none',
      estimated_minutes: null,
    });
  });

  it('parses !urgent priority token', () => {
    const result = parseTaskInput('!urgent Fix login bug');
    expect(result.title).toBe('Fix login bug');
    expect(result.priority).toBe('urgent');
  });

  it('parses !h shorthand for high priority', () => {
    const result = parseTaskInput('!h Deploy hotfix');
    expect(result.priority).toBe('high');
    expect(result.title).toBe('Deploy hotfix');
  });

  it('parses !med shorthand for medium priority', () => {
    const result = parseTaskInput('!med Update docs');
    expect(result.priority).toBe('medium');
  });

  it('parses !low priority', () => {
    const result = parseTaskInput('!low Clean up comments');
    expect(result.priority).toBe('low');
    expect(result.title).toBe('Clean up comments');
  });

  it('parses minute time estimates', () => {
    const result = parseTaskInput('30m Write tests');
    expect(result.estimated_minutes).toBe(30);
    expect(result.title).toBe('Write tests');
  });

  it('parses hour time estimates', () => {
    const result = parseTaskInput('2h Refactor auth module');
    expect(result.estimated_minutes).toBe(120);
    expect(result.title).toBe('Refactor auth module');
  });

  it('parses both priority and time together', () => {
    const result = parseTaskInput('!urgent 2h Fix critical production bug');
    expect(result.priority).toBe('urgent');
    expect(result.estimated_minutes).toBe(120);
    expect(result.title).toBe('Fix critical production bug');
  });

  it('handles tokens in any order', () => {
    const result = parseTaskInput('1h !high Review PR');
    expect(result.priority).toBe('high');
    expect(result.estimated_minutes).toBe(60);
    expect(result.title).toBe('Review PR');
  });

  it('ignores extra whitespace', () => {
    const result = parseTaskInput('  !urgent   30m   Fix it  ');
    expect(result.title).toBe('Fix it');
    expect(result.priority).toBe('urgent');
    expect(result.estimated_minutes).toBe(30);
  });

  it('only uses first priority token', () => {
    const result = parseTaskInput('!urgent !low Do something');
    expect(result.priority).toBe('urgent');
    // !low should be treated as part of the title since priority already set
    expect(result.title).toBe('!low Do something');
  });

  it('handles plain numbers as part of the title, not time', () => {
    const result = parseTaskInput('Fix bug 123');
    expect(result.title).toBe('Fix bug 123');
    expect(result.estimated_minutes).toBeNull();
  });

  it('handles empty input', () => {
    const result = parseTaskInput('');
    expect(result.title).toBe('');
    expect(result.priority).toBe('none');
    expect(result.estimated_minutes).toBeNull();
  });

  it('parses min suffix', () => {
    const result = parseTaskInput('15min Quick standup');
    expect(result.estimated_minutes).toBe(15);
    expect(result.title).toBe('Quick standup');
  });

  it('parses hr suffix', () => {
    const result = parseTaskInput('1hr Meeting prep');
    expect(result.estimated_minutes).toBe(60);
    expect(result.title).toBe('Meeting prep');
  });
});
