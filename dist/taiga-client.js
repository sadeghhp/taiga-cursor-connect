export { TaigaError } from "./http/client.js";
export { getClient, patchWithOCC, resetClient, setClientForTests, wrapAxiosError } from "./http/client.js";
export { resolveStatusId, resolveMilestoneId } from "./resolvers.js";
export { trimHistory, trimStoryWithTasks, trimTaskDetail, trimIssueDetail, trimEpicDetail, trimSearchResults, resolvePointsByRole, normalizeTags } from "./trimmers.js";
import { assertEpicRefValid, assertIssueRefValid, assertStoryRefValid, assertTaskRefValid } from "./schemas.js";
import { getClient, patchWithOCC, paginationHeaders, wrapAxiosError, TaigaError } from "./http/client.js";
import { buildEpicPatchBody, buildIssuePatchBody, buildStoryPatchBody, buildTaskPatchBody, applyCreateOptions } from "./patch-builders.js";
import { buildListParams, parsePaginationHeaders, resolveMilestoneByRef } from "./resolvers.js";
import { resolvePointsFromEstimateHours, listPointsForProject } from "./points.js";
import { trimEpicListItem, trimHistory, trimSearchResults, trimStoryWithTasks, resolvePointsByRole } from "./trimmers.js";
// --- Project ---
export async function getProjectBySlug(slug) {
    try {
        const res = await getClient().get("/projects/by_slug", {
            params: { slug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug: slug });
    }
}
export function trimProjectDetail(p) {
    return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        is_epics_activated: p.is_epics_activated ?? false,
        is_issues_activated: p.is_issues_activated ?? false,
        is_wiki_activated: p.is_wiki_activated ?? false,
        total_milestones: p.total_milestones ?? null,
        total_story_points: p.total_story_points ?? null
    };
}
export async function getProjectDetail(projectSlug) {
    return trimProjectDetail(await getProjectBySlug(projectSlug));
}
export async function listProjects() {
    try {
        const res = await getClient().get("/projects");
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
// --- Milestones ---
export async function listMilestones(projectSlug) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().get("/milestones", {
            params: { project: project.id }
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map((m) => ({
            id: m.id,
            name: m.name,
            slug: m.slug,
            closed: m.closed ?? false,
            estimated_start: m.estimated_start ?? null,
            estimated_finish: m.estimated_finish ?? null
        }));
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function createMilestone(projectSlug, input) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().post("/milestones", {
            project: project.id,
            name: input.name,
            slug: input.slug,
            estimated_start: input.estimatedStart,
            estimated_finish: input.estimatedFinish,
            ...(input.order != null ? { order: input.order } : {})
        });
        const m = res.data;
        return {
            id: m.id,
            name: m.name,
            slug: m.slug,
            closed: m.closed ?? false,
            estimated_start: m.estimated_start ?? null,
            estimated_finish: m.estimated_finish ?? null
        };
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function resolveMilestone(input) {
    if (input.milestoneId != null) {
        try {
            const res = await getClient().get(`/milestones/${input.milestoneId}`);
            return res.data;
        }
        catch (e) {
            throw wrapAxiosError(e);
        }
    }
    if (input.projectSlug && input.milestoneSlug) {
        const project = await getProjectBySlug(input.projectSlug);
        return resolveMilestoneByRef(project.id, input.projectSlug, input.milestoneSlug);
    }
    throw new TaigaError("Provide milestoneId or projectSlug + milestoneSlug.");
}
export async function updateMilestone(input, fields) {
    const milestone = await resolveMilestone(input);
    const body = {};
    if (fields.name != null)
        body.name = fields.name;
    if (fields.estimatedStart != null)
        body.estimated_start = fields.estimatedStart;
    if (fields.estimatedFinish != null)
        body.estimated_finish = fields.estimatedFinish;
    if (fields.closed != null)
        body.closed = fields.closed;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    await patchWithOCC(async () => {
        const m = await resolveMilestone({ milestoneId: milestone.id });
        if (m.version == null) {
            throw new TaigaError(`Milestone ${milestone.id} missing version for OCC patch.`);
        }
        return { version: m.version };
    }, (current) => getClient().patch(`/milestones/${milestone.id}`, {
        version: current.version,
        ...body
    }));
    const updated = await resolveMilestone({ milestoneId: milestone.id });
    return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        closed: updated.closed ?? false,
        estimated_start: updated.estimated_start ?? null,
        estimated_finish: updated.estimated_finish ?? null
    };
}
// --- Status / members / points ---
export async function listStatuses(projectSlug, entityType) {
    const project = await getProjectBySlug(projectSlug);
    const path = entityType === "user_story"
        ? "/userstory-statuses"
        : entityType === "task"
            ? "/task-statuses"
            : entityType === "issue"
                ? "/issue-statuses"
                : "/epic-statuses";
    try {
        const res = await getClient().get(path, { params: { project: project.id } });
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map((s) => ({
            id: s.id,
            name: s.name,
            is_closed: s.is_closed ?? false
        }));
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function listMembers(projectSlug) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().get("/memberships", {
            params: { project: project.id }
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows
            .filter((m) => m.user != null)
            .map((m) => ({
            user_id: m.user,
            full_name: m.user_full_name ?? null,
            username: m.user_email ?? null,
            role: m.role_name ?? null
        }));
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function listPoints(projectSlug) {
    const project = await getProjectBySlug(projectSlug);
    return listPointsForProject(project.id);
}
// --- Stories ---
export async function getStoryByRefSlug(projectSlug, storyRef) {
    try {
        const res = await getClient().get("/userstories/by_ref", {
            params: { ref: storyRef, project__slug: projectSlug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug, storyRef });
    }
}
export async function getStoryById(storyId) {
    try {
        const res = await getClient().get(`/userstories/${storyId}`);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function resolveStory(input) {
    assertStoryRefValid(input);
    if (input.storyId != null)
        return getStoryById(input.storyId);
    return getStoryByRefSlug(input.projectSlug, input.storyRef);
}
async function resolveStoryProjectId(story) {
    if (story.project != null)
        return story.project;
    const full = await getStoryById(story.id);
    if (full.project == null) {
        throw new TaigaError(`Could not determine project for user story ${story.id}.`);
    }
    return full.project;
}
export async function enrichCreateOptions(projectId, options) {
    if (options == null)
        return undefined;
    const out = { ...options };
    if (options.estimateHours != null && options.points == null) {
        out.points = await resolvePointsFromEstimateHours(projectId, options.estimateHours);
    }
    return out;
}
export async function createUserStory(projectSlug, subject, description, options) {
    const project = await getProjectBySlug(projectSlug);
    const enriched = await enrichCreateOptions(project.id, options);
    const body = {
        project: project.id,
        subject,
        ...(description != null ? { description } : {})
    };
    await applyCreateOptions(body, project.id, "user_story", enriched);
    try {
        const res = await getClient().post("/userstories", body);
        const story = res.data;
        if (options?.epicId != null) {
            await linkStoryToEpic(options.epicId, story.id);
        }
        return story;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function updateStory(input, fields) {
    const story = await resolveStory(input);
    const projectId = await resolveStoryProjectId(story);
    const patchFields = { ...fields };
    if (patchFields.estimateHours != null && patchFields.points == null) {
        patchFields.points = await resolvePointsFromEstimateHours(projectId, patchFields.estimateHours);
    }
    const patchBody = await buildStoryPatchBody(projectId, patchFields);
    await patchWithOCC(() => getStoryById(story.id), (current) => getClient().patch(`/userstories/${story.id}`, {
        version: current.version,
        ...patchBody
    }));
    if (fields.unlinkEpic && fields.epicId != null) {
        await unlinkStoryFromEpic(fields.epicId, story.id);
    }
    else if (fields.epicId != null) {
        await linkStoryToEpic(fields.epicId, story.id);
    }
    return getStoryById(story.id);
}
export async function addStoryComment(input, comment) {
    const storyId = typeof input === "number" ? input : (await resolveStory(input)).id;
    await patchWithOCC(() => getStoryById(storyId), (current) => getClient().patch(`/userstories/${storyId}`, {
        version: current.version,
        comment
    }));
}
export async function deleteUserStory(storyId) {
    try {
        await getClient().delete(`/userstories/${storyId}`);
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
// --- Tasks ---
export async function getTaskByRefSlug(projectSlug, taskRef) {
    try {
        const res = await getClient().get("/tasks/by_ref", {
            params: { ref: taskRef, project__slug: projectSlug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug, taskRef });
    }
}
export async function getTask(taskId) {
    try {
        const res = await getClient().get(`/tasks/${taskId}`);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function resolveTask(input) {
    assertTaskRefValid(input);
    if (input.taskId != null)
        return getTask(input.taskId);
    return getTaskByRefSlug(input.projectSlug, input.taskRef);
}
async function resolveTaskProjectId(task) {
    if (task.project != null)
        return task.project;
    const full = await getTask(task.id);
    if (full.project == null) {
        throw new TaigaError(`Could not determine project for task ${task.id}.`);
    }
    return full.project;
}
export async function createTask(projectSlug, subject, options) {
    const project = await getProjectBySlug(projectSlug);
    const enriched = await enrichCreateOptions(project.id, options);
    const body = {
        project: project.id,
        subject,
        ...(options?.description != null ? { description: options.description } : {}),
        ...(options?.userStoryId != null ? { user_story: options.userStoryId } : {})
    };
    await applyCreateOptions(body, project.id, "task", enriched);
    try {
        const res = await getClient().post("/tasks", body);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function updateTask(input, fields) {
    const task = await resolveTask(input);
    const projectId = await resolveTaskProjectId(task);
    const patchBody = await buildTaskPatchBody(projectId, fields);
    await patchWithOCC(() => getTask(task.id), (current) => getClient().patch(`/tasks/${task.id}`, {
        version: current.version,
        ...patchBody
    }));
    return getTask(task.id);
}
export async function addTaskComment(input, comment) {
    const taskId = typeof input === "number" ? input : (await resolveTask(input)).id;
    await patchWithOCC(() => getTask(taskId), (current) => getClient().patch(`/tasks/${taskId}`, {
        version: current.version,
        comment
    }));
}
export async function deleteTask(taskId) {
    try {
        await getClient().delete(`/tasks/${taskId}`);
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
// --- Issues ---
export async function getIssueById(issueId) {
    try {
        const res = await getClient().get(`/issues/${issueId}`);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getIssueByRefSlug(projectSlug, issueRef) {
    try {
        const res = await getClient().get("/issues/by_ref", {
            params: { ref: issueRef, project__slug: projectSlug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug, issueRef });
    }
}
export async function resolveIssue(input) {
    assertIssueRefValid(input);
    if (input.issueId != null)
        return getIssueById(input.issueId);
    return getIssueByRefSlug(input.projectSlug, input.issueRef);
}
async function resolveIssueProjectId(issue) {
    if (issue.project != null)
        return issue.project;
    const full = await getIssueById(issue.id);
    if (full.project == null) {
        throw new TaigaError(`Could not determine project for issue ${issue.id}.`);
    }
    return full.project;
}
export async function createIssue(projectSlug, subject, description, options) {
    const project = await getProjectBySlug(projectSlug);
    const enriched = await enrichCreateOptions(project.id, options);
    const body = {
        project: project.id,
        subject,
        ...(description != null ? { description } : {})
    };
    await applyCreateOptions(body, project.id, "issue", enriched);
    try {
        const res = await getClient().post("/issues", body);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function updateIssue(input, fields) {
    const issue = await resolveIssue(input);
    const projectId = await resolveIssueProjectId(issue);
    const patchBody = await buildIssuePatchBody(projectId, fields);
    await patchWithOCC(() => getIssueById(issue.id), (current) => getClient().patch(`/issues/${issue.id}`, {
        version: current.version,
        ...patchBody
    }));
    return getIssueById(issue.id);
}
export async function addIssueComment(input, comment) {
    const issueId = typeof input === "number" ? input : (await resolveIssue(input)).id;
    await patchWithOCC(() => getIssueById(issueId), (current) => getClient().patch(`/issues/${issueId}`, {
        version: current.version,
        comment
    }));
}
export async function deleteIssue(issueId) {
    try {
        await getClient().delete(`/issues/${issueId}`);
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
// --- Epics ---
export async function getEpicById(epicId) {
    try {
        const res = await getClient().get(`/epics/${epicId}`);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getEpicByRefSlug(projectSlug, epicRef) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().get("/epics/by_ref", {
            params: { ref: epicRef, project: project.id }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug, epicRef });
    }
}
export async function resolveEpic(input) {
    assertEpicRefValid(input);
    if (input.epicId != null)
        return getEpicById(input.epicId);
    return getEpicByRefSlug(input.projectSlug, input.epicRef);
}
export async function createEpic(projectSlug, subject, description, options) {
    const project = await getProjectBySlug(projectSlug);
    const enriched = await enrichCreateOptions(project.id, options);
    const body = {
        project: project.id,
        subject,
        ...(description != null ? { description } : {})
    };
    await applyCreateOptions(body, project.id, "epic", enriched);
    try {
        const res = await getClient().post("/epics", body);
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function updateEpic(input, fields) {
    const epic = await resolveEpic(input);
    let projectId = epic.project;
    if (projectId == null) {
        const full = await getEpicById(epic.id);
        projectId = full.project;
    }
    if (projectId == null && input.projectSlug) {
        projectId = (await getProjectBySlug(input.projectSlug)).id;
    }
    if (projectId == null) {
        throw new TaigaError(`Could not determine project for epic ${epic.id}.`);
    }
    const patchBody = await buildEpicPatchBody(projectId, fields);
    await patchWithOCC(() => getEpicById(epic.id), (current) => getClient().patch(`/epics/${epic.id}`, {
        version: current.version,
        ...patchBody
    }));
    return getEpicById(epic.id);
}
export async function addEpicComment(input, comment) {
    const epicId = typeof input === "number" ? input : (await resolveEpic(input)).id;
    await patchWithOCC(() => getEpicById(epicId), (current) => getClient().patch(`/epics/${epicId}`, {
        version: current.version,
        comment
    }));
}
export async function linkStoryToEpic(epicId, userStoryId) {
    try {
        await getClient().post(`/epics/${epicId}/related_userstories`, {
            epic: epicId,
            user_story: userStoryId
        });
    }
    catch (e) {
        throw wrapAxiosError(e, { epicId, userStoryId });
    }
}
export async function unlinkStoryFromEpic(epicId, userStoryId) {
    try {
        await getClient().delete(`/epics/${epicId}/related_userstories/${userStoryId}`);
    }
    catch (e) {
        throw wrapAxiosError(e, { epicId, userStoryId });
    }
}
export async function deleteEpic(epicId) {
    try {
        await getClient().delete(`/epics/${epicId}`);
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
// --- List with filters ---
async function fetchList(path, projectId, query, entityType, mapRow) {
    const params = await buildListParams(projectId, query, entityType);
    const headers = query.page != null
        ? paginationHeaders(query.page, query.pageSize)
        : undefined;
    try {
        const res = await getClient().get(path, { params, headers });
        const rows = Array.isArray(res.data) ? res.data : [];
        const items = rows.map((r) => mapRow(r));
        if (query.page != null) {
            const meta = parsePaginationHeaders(res, query.page, query.pageSize);
            return { items, ...meta };
        }
        return items;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function listUserStories(projectSlug, queryOrMilestoneId = {}) {
    const query = typeof queryOrMilestoneId === "number"
        ? { milestoneId: queryOrMilestoneId }
        : queryOrMilestoneId;
    const project = await getProjectBySlug(projectSlug);
    const result = await fetchList("/userstories", project.id, query, "user_story", (us) => ({
        id: us.id,
        ref: us.ref,
        subject: us.subject,
        status: us.status_extra_info?.name ?? null,
        milestone: us.milestone_name ?? null,
        is_closed: us.is_closed ?? false
    }));
    return result;
}
export async function listTasks(projectSlug, queryOrUserStoryId = {}) {
    const query = typeof queryOrUserStoryId === "number"
        ? { userStoryId: queryOrUserStoryId }
        : queryOrUserStoryId;
    const project = await getProjectBySlug(projectSlug);
    const result = await fetchList("/tasks", project.id, query, "task", (t) => ({
        id: t.id,
        ref: t.ref,
        subject: t.subject,
        status: t.status_extra_info?.name ?? null,
        is_closed: t.is_closed,
        user_story: t.user_story ?? null
    }));
    return result;
}
export async function listIssues(projectSlug, query = {}) {
    const project = await getProjectBySlug(projectSlug);
    const result = await fetchList("/issues", project.id, query, "issue", (i) => ({
        id: i.id,
        ref: i.ref,
        subject: i.subject,
        status: i.status_extra_info?.name ?? null,
        is_closed: i.is_closed ?? i.status_extra_info?.is_closed ?? false
    }));
    return result;
}
export async function listEpics(projectSlug, query = {}) {
    const project = await getProjectBySlug(projectSlug);
    const result = await fetchList("/epics", project.id, query, "epic", (e) => trimEpicListItem(e));
    return result;
}
// --- History / search / bundle ---
export async function getStoryHistory(storyId) {
    try {
        const res = await getClient().get(`/history/userstory/${storyId}`);
        return Array.isArray(res.data) ? res.data : [];
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getTaskHistory(taskId) {
    try {
        const res = await getClient().get(`/history/task/${taskId}`);
        return Array.isArray(res.data) ? res.data : [];
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getIssueHistory(issueId) {
    try {
        const res = await getClient().get(`/history/issue/${issueId}`);
        return Array.isArray(res.data) ? res.data : [];
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getTasksForStory(projectId, storyId) {
    try {
        const res = await getClient().get("/tasks", {
            params: { project: projectId, user_story: storyId }
        });
        return Array.isArray(res.data) ? res.data : [];
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function searchProject(projectSlug, text) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().get("/search", {
            params: { project: project.id, text }
        });
        return trimSearchResults(res.data);
    }
    catch (e) {
        throw wrapAxiosError(e, { projectSlug });
    }
}
export async function fetchStoryBundle(input, includeHistory) {
    const story = await resolveStory(input);
    let projectId = story.project;
    if (projectId == null) {
        if (input.projectSlug) {
            projectId = (await getProjectBySlug(input.projectSlug)).id;
        }
        else {
            const full = await getStoryById(story.id);
            if (full.project == null) {
                throw new TaigaError(`Could not determine project for user story ${story.id}.`);
            }
            projectId = full.project;
        }
    }
    const tasks = await getTasksForStory(projectId, story.id);
    const pointDefs = await listPointsForProject(projectId);
    const pointsByRole = resolvePointsByRole(story.points, pointDefs);
    let history;
    if (includeHistory) {
        history = trimHistory(await getStoryHistory(story.id));
    }
    return trimStoryWithTasks(story, tasks, history, pointsByRole);
}
export async function updateStoryBacklogOrder(projectSlug, entries) {
    const project = await getProjectBySlug(projectSlug);
    const bulk_stories = [];
    for (const e of entries) {
        const story = e.storyId
            ? await getStoryById(e.storyId)
            : await getStoryByRefSlug(e.projectSlug ?? projectSlug, e.storyRef);
        bulk_stories.push({ us_id: story.id, order: e.order });
    }
    try {
        await getClient().post("/userstories/bulk_update_backlog_order", {
            project_id: project.id,
            bulk_stories
        });
    }
    catch (err) {
        throw wrapAxiosError(err, { projectSlug });
    }
}
export async function updateStorySprintOrder(projectSlug, entries) {
    const project = await getProjectBySlug(projectSlug);
    const bulk_stories = [];
    for (const e of entries) {
        const story = e.storyId
            ? await getStoryById(e.storyId)
            : await getStoryByRefSlug(e.projectSlug ?? projectSlug, e.storyRef);
        bulk_stories.push({ us_id: story.id, order: e.order });
    }
    try {
        await getClient().post("/userstories/bulk_update_sprint_order", {
            project_id: project.id,
            bulk_stories
        });
    }
    catch (err) {
        throw wrapAxiosError(err, { projectSlug });
    }
}
// --- Archive (soft close) ---
export async function archiveStory(input) {
    return updateStory(input, { isClosed: true });
}
export async function archiveTask(input) {
    return updateTask(input, { isClosed: true });
}
export async function archiveEpic(input) {
    return updateEpic(input, { isClosed: true });
}
export async function archiveIssue(input) {
    return updateIssue(input, { isClosed: true });
}
