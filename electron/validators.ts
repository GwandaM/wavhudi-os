import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_TEXT_LENGTH = 100_000;
const MAX_NOTES = 366;
const MAX_SUBTASKS = 500;
const MAX_TAGS = 50;
const MAX_MINUTES = 10_080;
const MAX_ORDER_INDEX = 1_000_000;
const FORBIDDEN_HTML_PATTERNS = [
  /<\s*\/?\s*script\b/i,
  /<\s*(iframe|object|embed|meta|base|form|input|button|textarea|select|option|link)\b/i,
  /\son[a-z]+\s*=/i,
  /javascript:/i,
  /data:text\/html/i,
  /url\s*\(/i,
  /expression\s*\(/i,
];

const dateSchema = z.string().regex(DATE_PATTERN, "Expected yyyy-MM-dd date");
const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected ISO timestamp");
const positiveIntegerSchema = z.number().int().positive();
const nullableMinutesSchema = z.number().int().min(0).max(MAX_MINUTES).nullable();
const boundedOrderSchema = z.number().int().min(0).max(MAX_ORDER_INDEX);
const prioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);
const statusSchema = z.enum(["backlog", "scheduled", "completed"]);

function assertSafeRichText(value: string): boolean {
  return !FORBIDDEN_HTML_PATTERNS.some((pattern) => pattern.test(value));
}

const plainTextSchema = z.string().trim().min(1).max(500);
const longTextSchema = z.string().max(10_000);
const richTextSchema = z
  .string()
  .max(MAX_TEXT_LENGTH)
  .refine(assertSafeRichText, "Unsafe HTML content rejected");

const dailyNoteSchema = z
  .object({
    date: dateSchema,
    content: richTextSchema,
  })
  .strict();

const subtaskSchema = z
  .object({
    id: positiveIntegerSchema,
    title: plainTextSchema,
    completed: z.boolean(),
    order_index: boundedOrderSchema,
  })
  .strict();

const recurrenceRuleSchema = z
  .object({
    frequency: z.enum(["daily", "weekdays", "weekly", "biweekly", "monthly"]),
    end_date: dateSchema.optional(),
  })
  .strict();

const taskObjectSchema = z
  .object({
    title: plainTextSchema,
    description: richTextSchema,
    daily_notes: z.array(dailyNoteSchema).max(MAX_NOTES),
    status: statusSchema,
    start_date: dateSchema.nullable(),
    end_date: dateSchema.nullable(),
    order_index: boundedOrderSchema,
    created_at: isoTimestampSchema,
    estimated_minutes: nullableMinutesSchema,
    actual_minutes: nullableMinutesSchema,
    priority: prioritySchema,
    project_id: positiveIntegerSchema.nullable(),
    is_pinned: z.boolean(),
    subtasks: z.array(subtaskSchema).max(MAX_SUBTASKS),
    tags: z.array(z.string().trim().min(1).max(50)).max(MAX_TAGS),
    recurrence_rule: recurrenceRuleSchema.nullable(),
    recurrence_parent_id: positiveIntegerSchema.nullable(),
  })
  .strict();

const taskCreateSchema = taskObjectSchema.superRefine((task, ctx) => {
    if (task.status === "backlog" && (task.start_date || task.end_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Backlog tasks cannot include schedule dates",
        path: ["start_date"],
      });
    }

    if (task.status !== "backlog" && !task.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scheduled or completed tasks require a start date",
        path: ["start_date"],
      });
    }

    if (task.start_date && task.end_date && task.end_date < task.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be before start date",
        path: ["end_date"],
      });
    }
  });

const taskUpdateSchema = taskObjectSchema
  .partial()
  .strict()
  .superRefine((task, ctx) => {
    if (
      task.start_date !== undefined &&
      task.end_date !== undefined &&
      task.start_date &&
      task.end_date &&
      task.end_date < task.start_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be before start date",
        path: ["end_date"],
      });
    }
  });

const journalUpdateSchema = z
  .object({
    intention: longTextSchema.optional(),
    reflection: longTextSchema.optional(),
    planning_completed: z.boolean().optional(),
    shutdown_completed: z.boolean().optional(),
  })
  .strict();

const settingsUpdateSchema = z
  .object({
    daily_capacity_minutes: z.number().int().min(0).max(1_440).optional(),
    planning_ritual_enabled: z.boolean().optional(),
    shutdown_ritual_enabled: z.boolean().optional(),
    default_view: z.enum(["myday", "week", "month"]).optional(),
    planning_reminder_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    shutdown_reminder_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict();

const projectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    color: z.string().regex(HEX_COLOR_PATTERN, "Expected hex color"),
    icon: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2_000).optional(),
    is_archived: z.boolean(),
    order_index: boundedOrderSchema,
  })
  .strict();

const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().regex(HEX_COLOR_PATTERN, "Expected hex color").optional(),
    icon: z.string().trim().min(1).max(120).nullable().optional(),
    description: z.string().max(2_000).nullable().optional(),
    is_archived: z.boolean().optional(),
    order_index: boundedOrderSchema.optional(),
  })
  .strict();

const noteCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: richTextSchema,
  })
  .strict();

const noteUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: richTextSchema.optional(),
  })
  .strict();

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  return tags?.map((tag) => tag.trim().toLowerCase());
}

export function parseId(value: unknown): number {
  return positiveIntegerSchema.parse(value);
}

export function parseDate(value: unknown): string {
  return dateSchema.parse(value);
}

export function parseTaskCreate(value: unknown) {
  const task = taskCreateSchema.parse(value);
  return {
    ...task,
    tags: normalizeTags(task.tags) ?? [],
  };
}

export function parseTaskUpdate(value: unknown) {
  const task = taskUpdateSchema.parse(value);
  return {
    ...task,
    tags: normalizeTags(task.tags),
  };
}

export function parseJournalUpdate(value: unknown) {
  return journalUpdateSchema.parse(value);
}

export function parseSettingsUpdate(value: unknown) {
  return settingsUpdateSchema.parse(value);
}

export function parseProjectCreate(value: unknown) {
  return projectCreateSchema.parse(value);
}

export function parseProjectUpdate(value: unknown) {
  return projectUpdateSchema.parse(value);
}

export function parseNoteCreate(value: unknown) {
  return noteCreateSchema.parse(value);
}

export function parseNoteUpdate(value: unknown) {
  return noteUpdateSchema.parse(value);
}
