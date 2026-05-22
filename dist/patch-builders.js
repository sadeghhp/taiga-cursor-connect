import { TaigaError } from "./http/client.js";
import { resolveMilestoneId, resolveStatusId } from "./resolvers.js";
export function applyCommonPatchFields(body, fields) {
    if (fields.subject != null)
        body.subject = fields.subject;
    if (fields.description != null)
        body.description = fields.description;
    if (fields.isClosed != null)
        body.is_closed = fields.isClosed;
    if (fields.unassign)
        body.assigned_to = null;
    else if (fields.assignedToId != null)
        body.assigned_to = fields.assignedToId;
    if (fields.tags != null)
        body.tags = fields.tags;
    if (fields.isBlocked != null)
        body.is_blocked = fields.isBlocked;
    if (fields.blockedNote != null)
        body.blocked_note = fields.blockedNote;
}
export async function applyStatusToBody(body, projectId, entityType, fields) {
    if (fields.statusId != null)
        body.status = fields.statusId;
    else if (fields.statusName != null) {
        body.status = await resolveStatusId(projectId, entityType, fields.statusName);
    }
}
export async function applyCreateOptions(body, projectId, entityType, fields) {
    if (fields == null)
        return;
    await applyStatusToBody(body, projectId, entityType, fields);
    if (fields.assignedToId != null)
        body.assigned_to = fields.assignedToId;
    if (fields.tags != null)
        body.tags = fields.tags;
    if (fields.dueDate != null)
        body.due_date = fields.dueDate;
    if (fields.points != null)
        body.points = fields.points;
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
}
export async function buildStoryPatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "user_story", fields);
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
    if (fields.dueDate != null)
        body.due_date = fields.dueDate;
    if (fields.points != null)
        body.points = fields.points;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
export async function buildTaskPatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "task", fields);
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
    if (fields.userStoryId != null)
        body.user_story = fields.userStoryId;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
export async function buildIssuePatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "issue", fields);
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
export async function buildEpicPatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "epic", fields);
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
