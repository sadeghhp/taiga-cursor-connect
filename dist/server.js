import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatTaigaError } from "./errors.js";
import { bulkSyncTasksCsv } from "./plan-sync.js";
import { addEpicComment, addIssueComment, addStoryComment, addTaskComment, archiveEpic, archiveIssue, archiveStory, archiveTask, createEpic, createIssue, createMilestone, createTask, createUserStory, deleteEpic, deleteIssue, deleteTask, deleteUserStory, fetchStoryBundle, getProjectDetail, getIssueHistory, getStoryHistory, getTaskHistory, linkStoryToEpic, listEpics, listIssues, listMembers, listMilestones, listPoints, listProjects, listStatuses, listTasks, listUserStories, resolveEpic, resolveIssue, resolveStory, resolveTask, searchProject, trimEpicDetail, trimHistory, trimIssueDetail, trimTaskDetail, unlinkStoryFromEpic, updateEpic, updateIssue, updateMilestone, updateStory, updateStoryBacklogOrder, updateStorySprintOrder, updateTask } from "./taiga-client.js";
import { assertEpicRefValid, assertEpicUpdateValid, assertIssueRefValid, assertIssueUpdateValid, assertMilestoneRefValid, assertStoryRefValid, assertStoryUpdateValid, assertTaskRefValid, assertTaskUpdateValid, buildListQuery, createOptionalFieldsShape, createStoryFieldsShape, epicRefFields, epicUpdateFieldsShape, issueRefFields, issueUpdateFieldsShape, listFilterFields, milestoneRefFields, parseTagsParam, storyRefFields, storyUpdateFieldsShape, taskRefFields, taskUpdateFieldsShape } from "./schemas.js";
function toolError(message) {
    return {
        isError: true,
        content: [{ type: "text", text: message }]
    };
}
function toolText(text) {
    return {
        content: [{ type: "text", text }]
    };
}
function jsonResult(data) {
    return toolText(JSON.stringify(data, null, 2));
}
function pickCommonUpdate(args) {
    return {
        statusName: args.statusName,
        statusId: args.statusId,
        isClosed: args.isClosed,
        subject: args.subject,
        description: args.description,
        assignedToId: args.assignedToId,
        unassign: args.unassign,
        tags: parseTagsParam(args.tags),
        isBlocked: args.isBlocked,
        blockedNote: args.blockedNote,
        milestoneSlug: args.milestoneSlug,
        milestoneId: args.milestoneId,
        epicId: args.epicId,
        unlinkEpic: args.unlinkEpic,
        dueDate: args.dueDate,
        estimateHours: args.estimateHours,
        userStoryId: args.userStoryId
    };
}
function pickCreateOptions(args) {
    const opts = {
        statusName: args.statusName,
        statusId: args.statusId,
        assignedToId: args.assignedToId,
        milestoneSlug: args.milestoneSlug,
        milestoneId: args.milestoneId,
        tags: parseTagsParam(args.tags),
        dueDate: args.dueDate,
        estimateHours: args.estimateHours
    };
    const has = opts.statusName != null ||
        opts.statusId != null ||
        opts.assignedToId != null ||
        opts.milestoneSlug != null ||
        opts.milestoneId != null ||
        (opts.tags != null && opts.tags.length > 0) ||
        opts.dueDate != null ||
        opts.estimateHours != null;
    return has ? opts : undefined;
}
const statusEntityTypeSchema = z
    .enum(["user_story", "task", "issue", "epic"])
    .describe("Entity type for status list");
const server = new McpServer({
    name: "taiga-mcp",
    version: "0.5.0"
});
server.tool("taiga_list_projects", {}, async () => {
    try {
        return jsonResult(await listProjects());
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_project", {
    projectSlug: z
        .string()
        .describe("Project slug. Example: taiga_get_project projectSlug=mcp-test")
}, async ({ projectSlug }) => {
    try {
        return jsonResult(await getProjectDetail(projectSlug));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_user_stories", {
    projectSlug: z.string().describe("Taiga project slug"),
    ...listFilterFields
}, async (args) => {
    try {
        return jsonResult(await listUserStories(args.projectSlug, buildListQuery(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_search", {
    projectSlug: z.string().describe("Taiga project slug"),
    text: z.string().describe("Search text e.g. T00042 or thread id")
}, async ({ projectSlug, text }) => {
    try {
        return jsonResult(await searchProject(projectSlug, text));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_milestones", { projectSlug: z.string().describe("Taiga project slug") }, async ({ projectSlug }) => {
    try {
        return jsonResult(await listMilestones(projectSlug));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_create_milestone", {
    projectSlug: z.string().describe("Taiga project slug"),
    name: z.string().describe("Milestone display name"),
    slug: z
        .string()
        .describe("Milestone slug e.g. P1-A-Data-Identity"),
    estimatedStart: z.string().describe("ISO date YYYY-MM-DD"),
    estimatedFinish: z.string().describe("ISO date YYYY-MM-DD"),
    order: z.number().optional()
}, async (args) => {
    try {
        return jsonResult(await createMilestone(args.projectSlug, {
            name: args.name,
            slug: args.slug,
            estimatedStart: args.estimatedStart,
            estimatedFinish: args.estimatedFinish,
            order: args.order
        }));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_milestone", {
    ...milestoneRefFields,
    name: z.string().optional(),
    estimatedStart: z.string().optional(),
    estimatedFinish: z.string().optional(),
    closed: z
        .boolean()
        .optional()
        .describe("Close milestone for gate M1.x")
}, async (args) => {
    try {
        assertMilestoneRefValid(args);
        return jsonResult(await updateMilestone({
            milestoneId: args.milestoneId,
            projectSlug: args.projectSlug,
            milestoneSlug: args.milestoneSlug
        }, {
            name: args.name,
            estimatedStart: args.estimatedStart,
            estimatedFinish: args.estimatedFinish,
            closed: args.closed
        }));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_statuses", {
    projectSlug: z.string(),
    entityType: statusEntityTypeSchema
}, async ({ projectSlug, entityType }) => {
    try {
        return jsonResult(await listStatuses(projectSlug, entityType));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_members", { projectSlug: z.string() }, async ({ projectSlug }) => {
    try {
        return jsonResult(await listMembers(projectSlug));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_points", { projectSlug: z.string().describe("List story point scale for project") }, async ({ projectSlug }) => {
    try {
        return jsonResult(await listPoints(projectSlug));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_tasks", {
    projectSlug: z.string(),
    userStoryId: z.number().optional().describe("Filter by parent story id"),
    ...listFilterFields
}, async (args) => {
    try {
        const q = buildListQuery(args);
        if (args.userStoryId != null)
            q.userStoryId = args.userStoryId;
        return jsonResult(await listTasks(args.projectSlug, q));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_issues", {
    projectSlug: z.string(),
    ...listFilterFields
}, async (args) => {
    try {
        return jsonResult(await listIssues(args.projectSlug, buildListQuery(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_list_epics", {
    projectSlug: z.string(),
    ...listFilterFields
}, async (args) => {
    try {
        return jsonResult(await listEpics(args.projectSlug, buildListQuery(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_story", {
    ...storyRefFields,
    includeHistory: z.boolean().optional()
}, async (args) => {
    try {
        assertStoryRefValid(args);
        return jsonResult(await fetchStoryBundle({
            storyId: args.storyId,
            projectSlug: args.projectSlug,
            storyRef: args.storyRef
        }, args.includeHistory ?? false));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_story_history", storyRefFields, async (args) => {
    try {
        assertStoryRefValid(args);
        const story = await resolveStory(args);
        const history = trimHistory(await getStoryHistory(story.id));
        return jsonResult({ story_id: story.id, ref: story.ref, history });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_task", taskRefFields, async (args) => {
    try {
        assertTaskRefValid(args);
        return jsonResult(trimTaskDetail(await resolveTask(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_task_history", taskRefFields, async (args) => {
    try {
        assertTaskRefValid(args);
        const task = await resolveTask(args);
        const history = trimHistory(await getTaskHistory(task.id));
        return jsonResult({ task_id: task.id, ref: task.ref, history });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_issue", issueRefFields, async (args) => {
    try {
        assertIssueRefValid(args);
        return jsonResult(trimIssueDetail(await resolveIssue(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_issue_history", issueRefFields, async (args) => {
    try {
        assertIssueRefValid(args);
        const issue = await resolveIssue(args);
        const history = trimHistory(await getIssueHistory(issue.id));
        return jsonResult({ issue_id: issue.id, ref: issue.ref, history });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_get_epic", epicRefFields, async (args) => {
    try {
        assertEpicRefValid(args);
        return jsonResult(trimEpicDetail(await resolveEpic(args)));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_create_story", {
    projectSlug: z.string(),
    subject: z.string().describe("e.g. T00042 — Implement auth"),
    description: z.string().optional(),
    ...createStoryFieldsShape
}, async (args) => {
    try {
        const story = await createUserStory(args.projectSlug, args.subject, args.description, { ...pickCreateOptions(args), epicId: args.epicId });
        return jsonResult({
            id: story.id,
            ref: story.ref,
            subject: story.subject,
            version: story.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_create_task", {
    projectSlug: z.string(),
    subject: z.string(),
    description: z.string().optional(),
    userStoryId: z.number().optional(),
    ...createOptionalFieldsShape
}, async (args) => {
    try {
        const task = await createTask(args.projectSlug, args.subject, {
            description: args.description,
            userStoryId: args.userStoryId,
            ...pickCreateOptions(args)
        });
        return jsonResult({
            id: task.id,
            ref: task.ref,
            subject: task.subject,
            version: task.version,
            user_story: task.user_story ?? null
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_create_issue", {
    projectSlug: z.string(),
    subject: z.string(),
    description: z.string().optional(),
    ...createOptionalFieldsShape
}, async (args) => {
    try {
        const issue = await createIssue(args.projectSlug, args.subject, args.description, pickCreateOptions(args));
        return jsonResult({
            id: issue.id,
            ref: issue.ref,
            subject: issue.subject,
            version: issue.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_create_epic", {
    projectSlug: z.string(),
    subject: z.string().describe("e.g. [M05-E03] Epic title"),
    description: z.string().optional(),
    ...createOptionalFieldsShape
}, async (args) => {
    try {
        const epic = await createEpic(args.projectSlug, args.subject, args.description, pickCreateOptions(args));
        return jsonResult({
            id: epic.id,
            ref: epic.ref,
            subject: epic.subject,
            version: epic.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_link_story_to_epic", {
    epicId: z.number(),
    storyId: z.number().describe("User story internal id")
}, async ({ epicId, storyId }) => {
    try {
        await linkStoryToEpic(epicId, storyId);
        return toolText(`Linked user story ${storyId} to epic ${epicId}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_unlink_story_from_epic", {
    epicId: z.number(),
    storyId: z.number()
}, async ({ epicId, storyId }) => {
    try {
        await unlinkStoryFromEpic(epicId, storyId);
        return toolText(`Unlinked user story ${storyId} from epic ${epicId}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_bulk_sync_tasks_csv", {
    projectSlug: z.string().describe("Required Taiga project slug"),
    csvPath: z
        .string()
        .describe("Absolute or workspace path to plan/L5/tasks.csv"),
    dryRun: z
        .boolean()
        .optional()
        .describe("If true, validate only — no creates"),
    delayMs: z.number().optional().describe("Delay between rows (default 200)"),
    milestoneSlugMap: z
        .string()
        .optional()
        .describe('JSON map subphase→slug e.g. {"A":"P1-A-Data-Identity"}')
}, async (args) => {
    try {
        let map;
        if (args.milestoneSlugMap) {
            map = JSON.parse(args.milestoneSlugMap);
        }
        return jsonResult(await bulkSyncTasksCsv({
            projectSlug: args.projectSlug,
            csvPath: args.csvPath,
            dryRun: args.dryRun ?? false,
            delayMs: args.delayMs,
            milestoneSlugMap: map
        }));
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_story_backlog_order", {
    projectSlug: z.string(),
    orders: z
        .string()
        .describe('JSON array [{\"storyRef\":1,\"order\":10}] or storyId+order')
}, async ({ projectSlug, orders }) => {
    try {
        const parsed = JSON.parse(orders);
        await updateStoryBacklogOrder(projectSlug, parsed.map((e) => ({
            storyRef: e.storyRef,
            storyId: e.storyId,
            order: e.order,
            projectSlug
        })));
        return toolText("Backlog order updated.");
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_story_sprint_order", {
    projectSlug: z.string(),
    orders: z.string().describe("JSON array of {storyRef|storyId, order}")
}, async ({ projectSlug, orders }) => {
    try {
        const parsed = JSON.parse(orders);
        await updateStorySprintOrder(projectSlug, parsed.map((e) => ({
            storyRef: e.storyRef,
            storyId: e.storyId,
            order: e.order,
            projectSlug
        })));
        return toolText("Sprint order updated.");
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_set_story_blocked_by", {
    projectSlug: z.string(),
    storyRef: z.number().optional(),
    taskRef: z.number().optional(),
    storyId: z.number().optional(),
    taskId: z.number().optional(),
    blockedByThreadId: z
        .string()
        .describe("Thread id of blocker e.g. T00041"),
    blockTask: z
        .boolean()
        .optional()
        .describe("If true, block task instead of story")
}, async (args) => {
    try {
        const note = args.blockedByThreadId;
        if (args.blockTask || args.taskRef != null || args.taskId != null) {
            const updated = await updateTask({
                taskId: args.taskId,
                taskRef: args.taskRef,
                projectSlug: args.projectSlug
            }, { isBlocked: true, blockedNote: note });
            return jsonResult({ ref: updated.ref, id: updated.id, blocked: true });
        }
        const updated = await updateStory({
            storyId: args.storyId,
            storyRef: args.storyRef,
            projectSlug: args.projectSlug
        }, { isBlocked: true, blockedNote: note });
        return jsonResult({ ref: updated.ref, id: updated.id, blocked: true });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_comment_on_story", { ...storyRefFields, comment: z.string() }, async (args) => {
    try {
        assertStoryRefValid(args);
        const story = await resolveStory(args);
        await addStoryComment(story.id, args.comment);
        return toolText(`Comment added to Taiga user story #${story.ref} (id ${story.id})`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_comment_on_task", { ...taskRefFields, comment: z.string() }, async (args) => {
    try {
        assertTaskRefValid(args);
        const task = await resolveTask(args);
        await addTaskComment(task.id, args.comment);
        return toolText(`Comment added to Taiga task #${task.ref} (id ${task.id})`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_comment_on_issue", { ...issueRefFields, comment: z.string() }, async (args) => {
    try {
        assertIssueRefValid(args);
        const issue = await resolveIssue(args);
        await addIssueComment(issue.id, args.comment);
        return toolText(`Comment added to Taiga issue #${issue.ref} (id ${issue.id})`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_comment_on_epic", { ...epicRefFields, comment: z.string() }, async (args) => {
    try {
        assertEpicRefValid(args);
        const epic = await resolveEpic(args);
        await addEpicComment(epic.id, args.comment);
        return toolText(`Comment added to Taiga epic #${epic.ref} (id ${epic.id})`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_story", { ...storyRefFields, ...storyUpdateFieldsShape }, async (args) => {
    try {
        assertStoryRefValid(args);
        assertStoryUpdateValid(args);
        const updated = await updateStory({
            storyId: args.storyId,
            projectSlug: args.projectSlug,
            storyRef: args.storyRef
        }, pickCommonUpdate(args));
        return jsonResult({
            id: updated.id,
            ref: updated.ref,
            subject: updated.subject,
            status: updated.status_extra_info?.name ?? null,
            milestone: updated.milestone_slug ?? updated.milestone_name ?? null,
            is_closed: updated.is_closed ?? updated.status_extra_info?.is_closed ?? false,
            version: updated.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_task", { ...taskRefFields, ...taskUpdateFieldsShape }, async (args) => {
    try {
        assertTaskRefValid(args);
        assertTaskUpdateValid(args);
        const updated = await updateTask({
            taskId: args.taskId,
            projectSlug: args.projectSlug,
            taskRef: args.taskRef
        }, pickCommonUpdate(args));
        return jsonResult({
            id: updated.id,
            ref: updated.ref,
            subject: updated.subject,
            status: updated.status_extra_info?.name ?? null,
            is_closed: updated.is_closed,
            version: updated.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_issue", { ...issueRefFields, ...issueUpdateFieldsShape }, async (args) => {
    try {
        assertIssueRefValid(args);
        assertIssueUpdateValid(args);
        const updated = await updateIssue({
            issueId: args.issueId,
            projectSlug: args.projectSlug,
            issueRef: args.issueRef
        }, pickCommonUpdate(args));
        return jsonResult({
            id: updated.id,
            ref: updated.ref,
            subject: updated.subject,
            status: updated.status_extra_info?.name ?? null,
            is_closed: updated.is_closed ?? updated.status_extra_info?.is_closed ?? false,
            version: updated.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_update_epic", { ...epicRefFields, ...epicUpdateFieldsShape }, async (args) => {
    try {
        assertEpicRefValid(args);
        assertEpicUpdateValid(args);
        const updated = await updateEpic({
            epicId: args.epicId,
            projectSlug: args.projectSlug,
            epicRef: args.epicRef
        }, pickCommonUpdate(args));
        return jsonResult({
            id: updated.id,
            ref: updated.ref,
            subject: updated.subject,
            status: updated.status_extra_info?.name ?? null,
            version: updated.version
        });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_archive_story", storyRefFields, async (args) => {
    try {
        assertStoryRefValid(args);
        const s = await archiveStory(args);
        return jsonResult({ id: s.id, ref: s.ref, archived: true });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_archive_task", taskRefFields, async (args) => {
    try {
        assertTaskRefValid(args);
        const t = await archiveTask(args);
        return jsonResult({ id: t.id, ref: t.ref, archived: true });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_archive_epic", epicRefFields, async (args) => {
    try {
        assertEpicRefValid(args);
        const e = await archiveEpic(args);
        return jsonResult({ id: e.id, ref: e.ref, archived: true });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_archive_issue", issueRefFields, async (args) => {
    try {
        assertIssueRefValid(args);
        const i = await archiveIssue(args);
        return jsonResult({ id: i.id, ref: i.ref, archived: true });
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_delete_story", {
    ...storyRefFields,
    confirm: z.literal(true).describe("Must be true to delete")
}, async (args) => {
    try {
        assertStoryRefValid(args);
        if (args.confirm !== true) {
            return toolError("Set confirm=true to delete.");
        }
        const story = await resolveStory(args);
        await deleteUserStory(story.id);
        return toolText(`Deleted user story #${story.ref}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_delete_task", {
    ...taskRefFields,
    confirm: z.literal(true)
}, async (args) => {
    try {
        assertTaskRefValid(args);
        if (args.confirm !== true)
            return toolError("Set confirm=true to delete.");
        const task = await resolveTask(args);
        await deleteTask(task.id);
        return toolText(`Deleted task #${task.ref}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_delete_epic", {
    ...epicRefFields,
    confirm: z.literal(true)
}, async (args) => {
    try {
        assertEpicRefValid(args);
        if (args.confirm !== true)
            return toolError("Set confirm=true to delete.");
        const epic = await resolveEpic(args);
        await deleteEpic(epic.id);
        return toolText(`Deleted epic #${epic.ref}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
server.tool("taiga_delete_issue", {
    ...issueRefFields,
    confirm: z.literal(true)
}, async (args) => {
    try {
        assertIssueRefValid(args);
        if (args.confirm !== true)
            return toolError("Set confirm=true to delete.");
        const issue = await resolveIssue(args);
        await deleteIssue(issue.id);
        return toolText(`Deleted issue #${issue.ref}`);
    }
    catch (err) {
        return toolError(formatTaigaError(err));
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
