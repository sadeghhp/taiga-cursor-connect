import { TaigaError } from "./http/client.js";
import {
  resolveMilestoneId,
  resolveStatusId,
  type StatusEntityType
} from "./resolvers.js";
import {
  applyIssueMetadataToBody,
  type IssueMetadataFields
} from "./metadata.js";

export interface CommonUpdateFields {
  statusId?: number;
  statusName?: string;
  isClosed?: boolean;
  subject?: string;
  description?: string;
  assignedToId?: number;
  unassign?: boolean;
  tags?: string[];
  isBlocked?: boolean;
  blockedNote?: string;
}

export interface StoryUpdateFields extends CommonUpdateFields {
  milestoneId?: number;
  milestoneSlug?: string;
  epicId?: number;
  unlinkEpic?: boolean;
  dueDate?: string;
  estimateHours?: number;
  points?: Record<string, number>;
}

export interface TaskUpdateFields extends CommonUpdateFields {
  milestoneId?: number;
  milestoneSlug?: string;
  userStoryId?: number;
}

export interface IssueUpdateFields extends CommonUpdateFields {
  milestoneId?: number;
  milestoneSlug?: string;
  typeId?: number;
  typeName?: string;
  priorityId?: number;
  priorityName?: string;
  severityId?: number;
  severityName?: string;
}

export interface EpicUpdateFields extends CommonUpdateFields {
  milestoneId?: number;
  milestoneSlug?: string;
}

export interface CreateOptionalFields {
  statusId?: number;
  statusName?: string;
  assignedToId?: number;
  milestoneId?: number;
  milestoneSlug?: string;
  tags?: string[];
  dueDate?: string;
  estimateHours?: number;
  points?: Record<string, number>;
  typeId?: number;
  typeName?: string;
  priorityId?: number;
  priorityName?: string;
  severityId?: number;
  severityName?: string;
}

export function applyCommonPatchFields(
  body: Record<string, unknown>,
  fields: CommonUpdateFields
): void {
  if (fields.subject != null) body.subject = fields.subject;
  if (fields.description != null) body.description = fields.description;
  if (fields.isClosed != null) body.is_closed = fields.isClosed;
  if (fields.unassign) body.assigned_to = null;
  else if (fields.assignedToId != null) body.assigned_to = fields.assignedToId;
  if (fields.tags != null) body.tags = fields.tags;
  if (fields.isBlocked != null) body.is_blocked = fields.isBlocked;
  if (fields.blockedNote != null) body.blocked_note = fields.blockedNote;
}

export async function applyStatusToBody(
  body: Record<string, unknown>,
  projectId: number,
  entityType: StatusEntityType,
  fields: CommonUpdateFields
): Promise<void> {
  if (fields.statusId != null) body.status = fields.statusId;
  else if (fields.statusName != null) {
    body.status = await resolveStatusId(projectId, entityType, fields.statusName);
  }
}

export async function applyCreateOptions(
  body: Record<string, unknown>,
  projectId: number,
  entityType: StatusEntityType,
  fields?: CreateOptionalFields
): Promise<void> {
  if (fields == null) return;
  await applyStatusToBody(body, projectId, entityType, fields);
  if (fields.assignedToId != null) body.assigned_to = fields.assignedToId;
  if (fields.tags != null) body.tags = fields.tags;
  if (entityType === "user_story") {
    if (fields.dueDate != null) body.due_date = fields.dueDate;
    if (fields.points != null) body.points = fields.points;
  }
  const milestone = await resolveMilestoneId(
    projectId,
    fields.milestoneSlug,
    fields.milestoneId
  );
  if (milestone != null) body.milestone = milestone;
  if (entityType === "issue") {
    await applyIssueMetadataToBody(body, projectId, fields as IssueMetadataFields);
  }
}

export function omitStoryEpicFields(
  fields: StoryUpdateFields
): Omit<StoryUpdateFields, "epicId" | "unlinkEpic"> {
  const { epicId: _e, unlinkEpic: _u, ...rest } = fields;
  return rest;
}

export function hasStoryPatchFields(fields: StoryUpdateFields): boolean {
  const f = omitStoryEpicFields(fields);
  return (
    f.statusName != null ||
    f.statusId != null ||
    f.isClosed != null ||
    f.subject != null ||
    f.description != null ||
    f.assignedToId != null ||
    f.unassign === true ||
    (f.tags != null && f.tags.length > 0) ||
    f.isBlocked != null ||
    f.blockedNote != null ||
    f.milestoneSlug != null ||
    f.milestoneId != null ||
    f.dueDate != null ||
    f.estimateHours != null ||
    f.points != null
  );
}

export function hasStoryEpicMutation(fields: StoryUpdateFields): boolean {
  return fields.epicId != null;
}

export async function buildStoryPatchBody(
  projectId: number,
  fields: StoryUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  applyCommonPatchFields(body, fields);
  await applyStatusToBody(body, projectId, "user_story", fields);
  const milestone = await resolveMilestoneId(
    projectId,
    fields.milestoneSlug,
    fields.milestoneId
  );
  if (milestone != null) body.milestone = milestone;
  if (fields.dueDate != null) body.due_date = fields.dueDate;
  if (fields.points != null) body.points = fields.points;
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update.");
  }
  return body;
}

export async function buildTaskPatchBody(
  projectId: number,
  fields: TaskUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  applyCommonPatchFields(body, fields);
  await applyStatusToBody(body, projectId, "task", fields);
  const milestone = await resolveMilestoneId(
    projectId,
    fields.milestoneSlug,
    fields.milestoneId
  );
  if (milestone != null) body.milestone = milestone;
  if (fields.userStoryId != null) body.user_story = fields.userStoryId;
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update.");
  }
  return body;
}

export async function buildIssuePatchBody(
  projectId: number,
  fields: IssueUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  applyCommonPatchFields(body, fields);
  await applyStatusToBody(body, projectId, "issue", fields);
  const milestone = await resolveMilestoneId(
    projectId,
    fields.milestoneSlug,
    fields.milestoneId
  );
  if (milestone != null) body.milestone = milestone;
  await applyIssueMetadataToBody(body, projectId, fields);
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update.");
  }
  return body;
}

export async function buildEpicPatchBody(
  projectId: number,
  fields: EpicUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  applyCommonPatchFields(body, fields);
  await applyStatusToBody(body, projectId, "epic", fields);
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update.");
  }
  return body;
}
