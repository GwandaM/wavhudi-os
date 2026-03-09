import { describe, it, expect } from "vitest";
import { sortByPriority, formatMinutes, PRIORITY_WEIGHT } from "./priority";
import type { Task } from "./db";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Test",
    description: "",
    daily_notes: [],
    status: "scheduled",
    start_date: "2026-03-03",
    end_date: null,
    order_index: 0,
    created_at: "2026-03-03T00:00:00Z",
    estimated_minutes: null,
    actual_minutes: null,
    priority: "none",
    project_id: null,
    is_pinned: false,
    subtasks: [],
    tags: [],
    recurrence_rule: null,
    recurrence_parent_id: null,
    ...overrides,
  };
}

describe("formatMinutes", () => {
  it("returns empty string for null", () => {
    expect(formatMinutes(null)).toBe("");
  });

  it("returns empty string for 0", () => {
    expect(formatMinutes(0)).toBe("");
  });

  it("formats minutes under an hour", () => {
    expect(formatMinutes(30)).toBe("30m");
    expect(formatMinutes(15)).toBe("15m");
  });

  it("formats exact hours", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(120)).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(150)).toBe("2h 30m");
  });
});

describe("sortByPriority", () => {
  it("sorts urgent before high before medium before low before none", () => {
    const tasks = [
      makeTask({ id: 1, priority: "none", order_index: 0 }),
      makeTask({ id: 2, priority: "urgent", order_index: 0 }),
      makeTask({ id: 3, priority: "low", order_index: 0 }),
      makeTask({ id: 4, priority: "high", order_index: 0 }),
      makeTask({ id: 5, priority: "medium", order_index: 0 }),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted.map((t) => t.priority)).toEqual([
      "urgent", "high", "medium", "low", "none",
    ]);
  });

  it("preserves order_index within same priority", () => {
    const tasks = [
      makeTask({ id: 1, priority: "high", order_index: 2 }),
      makeTask({ id: 2, priority: "high", order_index: 0 }),
      makeTask({ id: 3, priority: "high", order_index: 1 }),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted.map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it("does not mutate original array", () => {
    const tasks = [
      makeTask({ id: 1, priority: "low" }),
      makeTask({ id: 2, priority: "urgent" }),
    ];
    const original = [...tasks];
    sortByPriority(tasks);
    expect(tasks).toEqual(original);
  });

  it("handles empty array", () => {
    expect(sortByPriority([])).toEqual([]);
  });

  it("handles tasks with missing priority (defaults to none)", () => {
    type TaskWithOptionalPriority = Omit<Task, "priority"> & { priority?: Task["priority"] };

    const tasks: TaskWithOptionalPriority[] = [
      { ...makeTask({ id: 1 }), priority: undefined },
      makeTask({ id: 2, priority: "urgent" }),
    ];
    const sorted = sortByPriority(tasks as Task[]);
    expect(sorted[0].id).toBe(2);
  });

  it("sorts pinned tasks before unpinned within same priority", () => {
    const tasks = [
      makeTask({ id: 1, priority: "high", is_pinned: false }),
      makeTask({ id: 2, priority: "none", is_pinned: true }),
      makeTask({ id: 3, priority: "high", is_pinned: true }),
    ];
    const sorted = sortByPriority(tasks);
    // Pinned tasks first, then by priority within pinned/unpinned
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it("preserves priority order among unpinned tasks", () => {
    const tasks = [
      makeTask({ id: 1, priority: "low", is_pinned: false }),
      makeTask({ id: 2, priority: "urgent", is_pinned: false }),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe("PRIORITY_WEIGHT", () => {
  it("has correct ordering values", () => {
    expect(PRIORITY_WEIGHT.urgent).toBeLessThan(PRIORITY_WEIGHT.high);
    expect(PRIORITY_WEIGHT.high).toBeLessThan(PRIORITY_WEIGHT.medium);
    expect(PRIORITY_WEIGHT.medium).toBeLessThan(PRIORITY_WEIGHT.low);
    expect(PRIORITY_WEIGHT.low).toBeLessThan(PRIORITY_WEIGHT.none);
  });
});
