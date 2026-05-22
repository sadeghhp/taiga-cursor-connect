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

export const issueRefFields = {
  issueId: z.number().optional().describe("Taiga internal issue ID"),
  projectSlug: z.string().optional().describe("Project slug (with issueRef)"),
  issueRef: z.number().optional().describe("Issue ref # (with projectSlug)")
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

function hasIssueRef(d: {
  issueId?: number;
  projectSlug?: string;
  issueRef?: number;
}): boolean {
  return d.issueId != null || (Boolean(d.projectSlug) && d.issueRef != null);
}

export const commonUpdateFieldsShape = {
  statusName: z
    .string()
    .optional()
    .describe("Status label as shown in Taiga UI (case-insensitive)"),
  statusId: z.number().optional().describe("Internal status ID"),
  isClosed: z.boolean().optional().describe("Mark entity closed/open"),
  subject: z.string().optional().describe("New subject/title"),
  description: z.string().optional().describe("New description"),
  assignedToId: z
    .number()
    .optional()
    .describe("Taiga user id to assign (null not supported via tool)"),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags, e.g. 'bug,backend'"),
  isBlocked: z.boolean().optional().describe("Mark blocked/unblocked"),
  blockedNote: z.string().optional().describe("Reason when blocked")
};

export const updateFieldsShape = {
  ...commonUpdateFieldsShape,
  milestoneSlug: z
    .string()
    .optional()
    .describe("Sprint/milestone slug (stories and tasks)"),
  milestoneId: z
    .number()
    .optional()
    .describe("Sprint/milestone internal id (stories and tasks)")
};

export const taskUpdateFieldsShape = {
  ...commonUpdateFieldsShape,
  milestoneSlug: updateFieldsShape.milestoneSlug,
  milestoneId: updateFieldsShape.milestoneId
};

export const issueUpdateFieldsShape = {
  ...commonUpdateFieldsShape,
  milestoneSlug: updateFieldsShape.milestoneSlug,
  milestoneId: updateFieldsShape.milestoneId
};

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

export function assertIssueRefValid(d: {
  issueId?: number;
  projectSlug?: string;
  issueRef?: number;
}): void {
  if (!hasIssueRef(d)) throw new SchemaValidationError(idOrSlugRefMessage);
}

type UpdateFieldCheck = {
  statusName?: string;
  statusId?: number;
  isClosed?: boolean;
  subject?: string;
  description?: string;
  milestoneSlug?: string;
  milestoneId?: number;
  assignedToId?: number;
  tags?: string;
  isBlocked?: boolean;
  blockedNote?: string;
};

function hasCommonUpdate(d: UpdateFieldCheck): boolean {
  return (
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null ||
    d.assignedToId != null ||
    (d.tags != null && d.tags.trim() !== "") ||
    d.isBlocked != null ||
    d.blockedNote != null
  );
}

export function assertStoryUpdateValid(d: UpdateFieldCheck): void {
  if (!hasCommonUpdate(d) && d.milestoneSlug == null && d.milestoneId == null) {
    throw new SchemaValidationError(
      "Provide at least one field to update (status, subject, description, milestone, assignee, tags, blocked, etc.)."
    );
  }
}

export function assertTaskUpdateValid(d: UpdateFieldCheck): void {
  if (!hasCommonUpdate(d) && d.milestoneSlug == null && d.milestoneId == null) {
    throw new SchemaValidationError(
      "Provide at least one field to update (status, subject, description, milestone, assignee, tags, blocked, etc.)."
    );
  }
}

export function assertIssueUpdateValid(d: UpdateFieldCheck): void {
  if (!hasCommonUpdate(d) && d.milestoneSlug == null && d.milestoneId == null) {
    throw new SchemaValidationError(
      "Provide at least one field to update (status, subject, description, milestone, assignee, tags, blocked, etc.)."
    );
  }
}

export function parseTagsParam(tags?: string): string[] | undefined {
  if (tags == null || tags.trim() === "") return undefined;
  const parsed = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}
