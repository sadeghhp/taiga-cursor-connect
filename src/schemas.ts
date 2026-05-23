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

export const epicRefFields = {
  epicId: z.number().optional().describe("Taiga internal epic ID"),
  projectSlug: z.string().optional().describe("Project slug (with epicRef)"),
  epicRef: z.number().optional().describe("Epic ref # (with projectSlug)")
};

export const milestoneRefFields = {
  milestoneId: z.number().optional().describe("Taiga internal milestone ID"),
  projectSlug: z.string().optional().describe("Project slug (with milestoneSlug)"),
  milestoneSlug: z
    .string()
    .optional()
    .describe("Milestone slug e.g. P1-A-Data-Identity")
};

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
    .describe("Taiga user id to assign"),
  unassign: z
    .boolean()
    .optional()
    .describe("Set true to clear assignee (assigned_to null)"),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags, e.g. 'module:M05,gate:M1.1'"),
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
    .describe("Sprint/milestone internal id")
};

export const storyUpdateFieldsShape = {
  ...updateFieldsShape,
  epicId: z
    .number()
    .optional()
    .describe("Link story to epic (POST related_userstories after patch)"),
  unlinkEpic: z
    .boolean()
    .optional()
    .describe("When true with epicId, remove epic link"),
  dueDate: z
    .string()
    .optional()
    .describe("Due date ISO YYYY-MM-DD"),
  estimateHours: z
    .number()
    .optional()
    .describe("Map to nearest story point for computable role")
};

export const taskUpdateFieldsShape = {
  ...commonUpdateFieldsShape,
  milestoneSlug: updateFieldsShape.milestoneSlug,
  milestoneId: updateFieldsShape.milestoneId,
  userStoryId: z
    .number()
    .optional()
    .describe("Move task to parent user story internal id")
};

export const issueUpdateFieldsShape = {
  ...commonUpdateFieldsShape,
  milestoneSlug: updateFieldsShape.milestoneSlug,
  milestoneId: updateFieldsShape.milestoneId,
  typeName: z.string().optional().describe("Issue type label e.g. Bug"),
  typeId: z.number().optional().describe("Issue type internal id"),
  priorityName: z.string().optional().describe("Priority label e.g. High"),
  priorityId: z.number().optional().describe("Priority internal id"),
  severityName: z.string().optional().describe("Severity label e.g. Minor"),
  severityId: z.number().optional().describe("Severity internal id")
};

export const epicUpdateFieldsShape = {
  ...commonUpdateFieldsShape
};

export const createOptionalFieldsShape = {
  statusName: commonUpdateFieldsShape.statusName,
  statusId: commonUpdateFieldsShape.statusId,
  assignedToId: commonUpdateFieldsShape.assignedToId,
  milestoneSlug: updateFieldsShape.milestoneSlug,
  milestoneId: updateFieldsShape.milestoneId,
  tags: commonUpdateFieldsShape.tags,
  dueDate: z
    .string()
    .optional()
    .describe("Due date ISO YYYY-MM-DD (stories)"),
  estimateHours: z
    .number()
    .optional()
    .describe("Map estimate_h to nearest story point"),
  typeName: z.string().optional().describe("Issue type label (issues only)"),
  typeId: z.number().optional().describe("Issue type id (issues only)"),
  priorityName: z.string().optional().describe("Priority label (issues only)"),
  priorityId: z.number().optional().describe("Priority id (issues only)"),
  severityName: z.string().optional().describe("Severity label (issues only)"),
  severityId: z.number().optional().describe("Severity id (issues only)")
};

export const createStoryFieldsShape = {
  ...createOptionalFieldsShape,
  epicId: z
    .number()
    .optional()
    .describe("Epic internal id to link after create")
};

export const listFilterFields = {
  milestoneId: z.number().optional().describe("Filter by milestone internal id"),
  statusName: z.string().optional().describe("Filter by status label"),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags filter"),
  epicId: z.number().optional().describe("Filter stories by epic id"),
  page: z.number().optional().describe("Page number (enables paginated response)"),
  pageSize: z.number().optional().describe("Results per page when page is set")
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
  if (d.storyId != null || (Boolean(d.projectSlug) && d.storyRef != null)) return;
  throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertTaskRefValid(d: {
  taskId?: number;
  projectSlug?: string;
  taskRef?: number;
}): void {
  if (d.taskId != null || (Boolean(d.projectSlug) && d.taskRef != null)) return;
  throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertIssueRefValid(d: {
  issueId?: number;
  projectSlug?: string;
  issueRef?: number;
}): void {
  if (d.issueId != null || (Boolean(d.projectSlug) && d.issueRef != null)) return;
  throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertEpicRefValid(d: {
  epicId?: number;
  projectSlug?: string;
  epicRef?: number;
}): void {
  if (d.epicId != null || (Boolean(d.projectSlug) && d.epicRef != null)) return;
  throw new SchemaValidationError(idOrSlugRefMessage);
}

export function assertMilestoneRefValid(d: {
  milestoneId?: number;
  projectSlug?: string;
  milestoneSlug?: string;
}): void {
  if (
    d.milestoneId != null ||
    (Boolean(d.projectSlug) && Boolean(d.milestoneSlug))
  ) {
    return;
  }
  throw new SchemaValidationError(
    "Provide milestoneId or both projectSlug and milestoneSlug."
  );
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
  unassign?: boolean;
  tags?: string;
  isBlocked?: boolean;
  blockedNote?: string;
  epicId?: number;
  unlinkEpic?: boolean;
  dueDate?: string;
  estimateHours?: number;
  userStoryId?: number;
  typeName?: string;
  typeId?: number;
  priorityName?: string;
  priorityId?: number;
  severityName?: string;
  severityId?: number;
};

function hasCommonUpdate(d: UpdateFieldCheck): boolean {
  return (
    d.statusName != null ||
    d.statusId != null ||
    d.isClosed != null ||
    d.subject != null ||
    d.description != null ||
    d.assignedToId != null ||
    d.unassign === true ||
    (d.tags != null && d.tags.trim() !== "") ||
    d.isBlocked != null ||
    d.blockedNote != null ||
    d.epicId != null ||
    (d.unlinkEpic === true && d.epicId != null) ||
    d.dueDate != null ||
    d.estimateHours != null ||
    d.userStoryId != null
  );
}

const updateRequiredMessage =
  "Provide at least one field to update (status, subject, description, milestone, assignee, tags, blocked, etc.).";

export function assertStoryUpdateValid(d: UpdateFieldCheck): void {
  if (d.unlinkEpic === true && d.epicId == null) {
    throw new SchemaValidationError("epicId is required when unlinkEpic is true.");
  }
  if (!hasCommonUpdate(d) && d.milestoneSlug == null && d.milestoneId == null) {
    throw new SchemaValidationError(updateRequiredMessage);
  }
}

export function assertTaskUpdateValid(d: UpdateFieldCheck): void {
  if (!hasCommonUpdate(d) && d.milestoneSlug == null && d.milestoneId == null) {
    throw new SchemaValidationError(updateRequiredMessage);
  }
}

export function assertIssueUpdateValid(d: UpdateFieldCheck): void {
  if (
    !hasCommonUpdate(d) &&
    d.milestoneSlug == null &&
    d.milestoneId == null &&
    d.typeName == null &&
    d.typeId == null &&
    d.priorityName == null &&
    d.priorityId == null &&
    d.severityName == null &&
    d.severityId == null
  ) {
    throw new SchemaValidationError(updateRequiredMessage);
  }
}

export function assertEpicUpdateValid(d: UpdateFieldCheck): void {
  if (!hasCommonUpdate(d)) {
    throw new SchemaValidationError(updateRequiredMessage);
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

export function buildListQuery(args: {
  milestoneId?: number;
  statusName?: string;
  tags?: string;
  epicId?: number;
  userStoryId?: number;
  page?: number;
  pageSize?: number;
}): import("./types.js").ListQuery {
  return {
    milestoneId: args.milestoneId,
    statusName: args.statusName,
    tags: parseTagsParam(args.tags),
    epicId: args.epicId,
    userStoryId: args.userStoryId,
    page: args.page,
    pageSize: args.pageSize
  };
}

export type CustomAttributeEntityType = "user_story" | "task" | "issue" | "epic";
export type AttachmentEntityType = "user_story" | "task" | "issue" | "epic" | "wiki";

type EntityRefCheck = {
  projectSlug?: string;
  storyId?: number;
  storyRef?: number;
  taskId?: number;
  taskRef?: number;
  issueId?: number;
  issueRef?: number;
  epicId?: number;
  epicRef?: number;
  wikiId?: number;
};

export function assertCustomAttributeRefValid(
  entityType: CustomAttributeEntityType,
  d: EntityRefCheck
): void {
  switch (entityType) {
    case "user_story":
      assertStoryRefValid(d);
      return;
    case "task":
      assertTaskRefValid(d);
      return;
    case "issue":
      assertIssueRefValid(d);
      return;
    case "epic":
      assertEpicRefValid(d);
      return;
    default:
      throw new SchemaValidationError(`Unknown entity type: ${entityType}`);
  }
}

export function assertAttachmentRefValid(
  entityType: AttachmentEntityType,
  d: EntityRefCheck
): void {
  if (entityType === "wiki") {
    if (d.wikiId == null) {
      throw new SchemaValidationError("wikiId is required for wiki attachments.");
    }
    return;
  }
  assertCustomAttributeRefValid(entityType, d);
}
