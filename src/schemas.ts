import { z } from "zod";

const idOrSlugRefMessage =
  "Provide either an internal id or both projectSlug and ref.";

export const storyRefFields = {
  storyId: z.number().optional().describe("Taiga internal user story ID"),
  projectSlug: z.string().optional().describe("Project slug (with storyRef)"),
  storyRef: z.number().optional().describe("Story ref # (with projectSlug)")
};

export const taskRefFields = {
  taskId: z.number().optional().describe("Taiga internal task ID"),
  projectSlug: z.string().optional().describe("Project slug (with taskRef)"),
  taskRef: z.number().optional().describe("Task ref # (with projectSlug)")
};

function hasStoryRef(d: {
  storyId?: number;
  projectSlug?: string;
  storyRef?: number;
}): boolean {
  return d.storyId != null || (Boolean(d.projectSlug) && d.storyRef != null);
}

function hasTaskRef(d: {
  taskId?: number;
  projectSlug?: string;
  taskRef?: number;
}): boolean {
  return d.taskId != null || (Boolean(d.projectSlug) && d.taskRef != null);
}

export function storyRefRefine(
  d: { storyId?: number; projectSlug?: string; storyRef?: number },
  ctx: z.RefinementCtx
): void {
  if (!hasStoryRef(d)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: idOrSlugRefMessage });
  }
}

export function taskRefRefine(
  d: { taskId?: number; projectSlug?: string; taskRef?: number },
  ctx: z.RefinementCtx
): void {
  if (!hasTaskRef(d)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: idOrSlugRefMessage });
  }
}

export const updateFieldsShape = {
  statusName: z
    .string()
    .optional()
    .describe("Status label as shown in Taiga UI (case-insensitive)"),
  statusId: z.number().optional().describe("Internal status ID"),
  isClosed: z.boolean().optional().describe("Mark entity closed/open"),
  subject: z.string().optional().describe("New subject/title"),
  description: z.string().optional().describe("New description"),
  milestoneSlug: z
    .string()
    .optional()
    .describe("Sprint/milestone slug (user stories only)"),
  milestoneId: z
    .number()
    .optional()
    .describe("Sprint/milestone internal id (user stories only)")
};

export function storyUpdateRefine(
  d: {
    statusName?: string;
    statusId?: number;
    isClosed?: boolean;
    subject?: string;
    description?: string;
    milestoneSlug?: string;
    milestoneId?: number;
  },
  ctx: z.RefinementCtx
): void {
  const hasField =
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null ||
    d.milestoneSlug != null ||
    d.milestoneId != null;
  if (!hasField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Provide at least one field to update: statusName, statusId, isClosed, subject, description, milestoneSlug, or milestoneId."
    });
  }
}

export function taskUpdateRefine(
  d: {
    statusName?: string;
    statusId?: number;
    isClosed?: boolean;
    subject?: string;
    description?: string;
  },
  ctx: z.RefinementCtx
): void {
  const hasField =
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null;
  if (!hasField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Provide at least one field to update: statusName, statusId, isClosed, subject, or description."
    });
  }
}

/** Runtime validation when MCP SDK requires a plain Zod shape (no .superRefine). */
export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

export function assertStoryRefValid(d: {
  storyId?: number;
  projectSlug?: string;
  storyRef?: number;
}): void {
  if (!hasStoryRef(d)) throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertTaskRefValid(d: {
  taskId?: number;
  projectSlug?: string;
  taskRef?: number;
}): void {
  if (!hasTaskRef(d)) throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertStoryUpdateValid(d: {
  statusName?: string;
  statusId?: number;
  isClosed?: boolean;
  subject?: string;
  description?: string;
  milestoneSlug?: string;
  milestoneId?: number;
}): void {
  const hasField =
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null ||
    d.milestoneSlug != null ||
    d.milestoneId != null;
  if (!hasField) {
    throw new SchemaValidationError(
      "Provide at least one field to update: statusName, statusId, isClosed, subject, description, milestoneSlug, or milestoneId."
    );
  }
}

export function assertTaskUpdateValid(d: {
  statusName?: string;
  statusId?: number;
  isClosed?: boolean;
  subject?: string;
  description?: string;
}): void {
  const hasField =
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null;
  if (!hasField) {
    throw new SchemaValidationError(
      "Provide at least one field to update: statusName, statusId, isClosed, subject, or description."
    );
  }
}
