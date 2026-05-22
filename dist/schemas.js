import { z } from "zod";
const idOrSlugRefMessage = "Provide either an internal id or both projectSlug and ref.";
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
function hasStoryRef(d) {
    return d.storyId != null || (Boolean(d.projectSlug) && d.storyRef != null);
}
function hasTaskRef(d) {
    return d.taskId != null || (Boolean(d.projectSlug) && d.taskRef != null);
}
export function storyRefRefine(d, ctx) {
    if (!hasStoryRef(d)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: idOrSlugRefMessage });
    }
}
export function taskRefRefine(d, ctx) {
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
export function storyUpdateRefine(d, ctx) {
    const hasField = d.statusName != null ||
        d.statusId != null ||
        d.isClosed != null ||
        d.subject != null ||
        d.description != null ||
        d.milestoneSlug != null ||
        d.milestoneId != null;
    if (!hasField) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide at least one field to update: statusName, statusId, isClosed, subject, description, milestoneSlug, or milestoneId."
        });
    }
}
export function taskUpdateRefine(d, ctx) {
    const hasField = d.statusName != null ||
        d.statusId != null ||
        d.isClosed != null ||
        d.subject != null ||
        d.description != null;
    if (!hasField) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide at least one field to update: statusName, statusId, isClosed, subject, or description."
        });
    }
}
/** Runtime validation when MCP SDK requires a plain Zod shape (no .superRefine). */
export class SchemaValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "SchemaValidationError";
    }
}
export function assertStoryRefValid(d) {
    if (!hasStoryRef(d))
        throw new SchemaValidationError(idOrSlugRefMessage);
}
export function assertTaskRefValid(d) {
    if (!hasTaskRef(d))
        throw new SchemaValidationError(idOrSlugRefMessage);
}
export function assertStoryUpdateValid(d) {
    const hasField = d.statusName != null ||
        d.statusId != null ||
        d.isClosed != null ||
        d.subject != null ||
        d.description != null ||
        d.milestoneSlug != null ||
        d.milestoneId != null;
    if (!hasField) {
        throw new SchemaValidationError("Provide at least one field to update: statusName, statusId, isClosed, subject, description, milestoneSlug, or milestoneId.");
    }
}
export function assertTaskUpdateValid(d) {
    const hasField = d.statusName != null ||
        d.statusId != null ||
        d.isClosed != null ||
        d.subject != null ||
        d.description != null;
    if (!hasField) {
        throw new SchemaValidationError("Provide at least one field to update: statusName, statusId, isClosed, subject, or description.");
    }
}
