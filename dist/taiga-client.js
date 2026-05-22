import axios from "axios";
import { assertIssueRefValid, assertStoryRefValid, assertTaskRefValid } from "./schemas.js";
function taigaApiUrl() {
    return process.env.TAIGA_API_URL?.replace(/\/$/, "") ?? "";
}
function taigaToken() {
    return process.env.TAIGA_TOKEN ?? "";
}
const HISTORY_CAP = 50;
const OCC_MAX_RETRIES = 2;
const THROTTLE_MAX_RETRIES = 3;
const THROTTLE_BASE_MS = 1000;
export class TaigaError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "TaigaError";
    }
}
function requireConfig() {
    if (!taigaApiUrl() || !taigaToken()) {
        throw new TaigaError("Missing TAIGA_API_URL or TAIGA_TOKEN. Set them in environment or .env.");
    }
}
function wrapAxiosError(err) {
    if (err instanceof TaigaError)
        return err;
    if (axios.isAxiosError(err)) {
        const ax = err;
        const status = ax.response?.status;
        const body = ax.response?.data;
        const detail = (typeof body === "object" && body !== null
            ? body.detail ?? body._error_message
            : undefined) ?? ax.message;
        return new TaigaError(`Taiga API error (${status ?? "network"}): ${detail}`, status);
    }
    return new TaigaError(err instanceof Error ? err.message : String(err));
}
function isVersionConflict(err) {
    if (!axios.isAxiosError(err))
        return false;
    const status = err.response?.status;
    if (status === 409)
        return true;
    const body = err.response?.data;
    if (typeof body === "object" && body !== null) {
        const detail = String(body.detail ?? "").toLowerCase();
        if (detail.includes("version"))
            return true;
    }
    return false;
}
let client = null;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function createClient() {
    const instance = axios.create({
        baseURL: taigaApiUrl(),
        headers: {
            Authorization: `Bearer ${taigaToken()}`,
            "Content-Type": "application/json",
            "x-disable-pagination": "True"
        }
    });
    instance.interceptors.response.use((response) => response, async (error) => {
        const config = error.config;
        if (error.response?.status === 429 &&
            config &&
            (config._retry429 ?? 0) < THROTTLE_MAX_RETRIES) {
            config._retry429 = (config._retry429 ?? 0) + 1;
            await sleep(THROTTLE_BASE_MS * config._retry429);
            return instance.request(config);
        }
        return Promise.reject(error);
    });
    return instance;
}
export function getClient() {
    requireConfig();
    if (!client) {
        client = createClient();
    }
    return client;
}
/** @internal Reset HTTP client (tests only). */
export function resetClient() {
    client = null;
}
/** @internal Inject mock Axios instance (tests only). */
export function setClientForTests(instance) {
    client = instance;
}
export async function patchWithOCC(fetchCurrent, patch) {
    let lastErr;
    for (let attempt = 0; attempt <= OCC_MAX_RETRIES; attempt++) {
        try {
            const entity = await fetchCurrent();
            await patch(entity);
            return;
        }
        catch (e) {
            lastErr = e;
            if (attempt < OCC_MAX_RETRIES && isVersionConflict(e))
                continue;
            throw wrapAxiosError(e);
        }
    }
    throw wrapAxiosError(lastErr);
}
export async function getProjectBySlug(slug) {
    try {
        const res = await getClient().get("/projects/by_slug", {
            params: { slug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
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
export async function getStoryByRefSlug(projectSlug, storyRef) {
    try {
        const res = await getClient().get("/userstories/by_ref", {
            params: { ref: storyRef, project__slug: projectSlug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function getStoryByRef(projectId, storyRef) {
    try {
        const res = await getClient().get("/userstories/by_ref", {
            params: { ref: storyRef, project: projectId }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
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
export async function getTaskByRefSlug(projectSlug, taskRef) {
    try {
        const res = await getClient().get("/tasks/by_ref", {
            params: { ref: taskRef, project__slug: projectSlug }
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
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
        throw wrapAxiosError(e);
    }
}
export async function resolveIssue(input) {
    assertIssueRefValid(input);
    if (input.issueId != null)
        return getIssueById(input.issueId);
    return getIssueByRefSlug(input.projectSlug, input.issueRef);
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
export async function searchProject(projectSlug, text) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().get("/search", {
            params: { project: project.id, text }
        });
        return trimSearchResults(res.data);
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
const STATUS_LIST_PATH = {
    user_story: "/userstory-statuses",
    task: "/task-statuses",
    issue: "/issue-statuses"
};
export async function resolveStatusId(projectId, entityType, statusName) {
    const path = STATUS_LIST_PATH[entityType];
    try {
        const res = await getClient().get(path, {
            params: { project: projectId }
        });
        const statuses = Array.isArray(res.data) ? res.data : [];
        const normalized = statusName.trim().toLowerCase();
        const matches = statuses.filter((s) => s.name.trim().toLowerCase() === normalized);
        if (matches.length === 0) {
            throw new TaigaError(`No ${entityType} status named "${statusName}" in project ${projectId}.`);
        }
        if (matches.length > 1) {
            throw new TaigaError(`Ambiguous status name "${statusName}" (${matches.length} matches).`);
        }
        return matches[0].id;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
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
async function resolveTaskProjectId(task) {
    if (task.project != null)
        return task.project;
    const full = await getTask(task.id);
    if (full.project == null) {
        throw new TaigaError(`Could not determine project for task ${task.id}.`);
    }
    return full.project;
}
async function storyIdFromInput(input) {
    return typeof input === "number" ? input : (await resolveStory(input)).id;
}
async function taskIdFromInput(input) {
    return typeof input === "number" ? input : (await resolveTask(input)).id;
}
export async function addStoryComment(input, comment) {
    const storyId = await storyIdFromInput(input);
    await patchWithOCC(() => getStoryById(storyId), (current) => getClient().patch(`/userstories/${storyId}`, {
        version: current.version,
        comment
    }));
}
export async function addTaskComment(input, comment) {
    const taskId = await taskIdFromInput(input);
    await patchWithOCC(() => getTask(taskId), (current) => getClient().patch(`/tasks/${taskId}`, {
        version: current.version,
        comment
    }));
}
function applyCommonPatchFields(body, fields) {
    if (fields.subject != null)
        body.subject = fields.subject;
    if (fields.description != null)
        body.description = fields.description;
    if (fields.isClosed != null)
        body.is_closed = fields.isClosed;
    if (fields.assignedToId != null)
        body.assigned_to = fields.assignedToId;
    if (fields.tags != null)
        body.tags = fields.tags;
    if (fields.isBlocked != null)
        body.is_blocked = fields.isBlocked;
    if (fields.blockedNote != null)
        body.blocked_note = fields.blockedNote;
}
async function applyStatusToBody(body, projectId, entityType, fields) {
    if (fields.statusId != null)
        body.status = fields.statusId;
    else if (fields.statusName != null) {
        body.status = await resolveStatusId(projectId, entityType, fields.statusName);
    }
}
export async function updateStory(input, fields) {
    const story = await resolveStory(input);
    const projectId = await resolveStoryProjectId(story);
    const patchBody = await buildStoryPatchBody(projectId, fields);
    await patchWithOCC(() => getStoryById(story.id), (current) => getClient().patch(`/userstories/${story.id}`, {
        version: current.version,
        ...patchBody
    }));
    return getStoryById(story.id);
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
async function resolveIssueProjectId(issue) {
    if (issue.project != null)
        return issue.project;
    const full = await getIssueById(issue.id);
    if (full.project == null) {
        throw new TaigaError(`Could not determine project for issue ${issue.id}.`);
    }
    return full.project;
}
export async function addIssueComment(input, comment) {
    const issueId = typeof input === "number" ? input : (await resolveIssue(input)).id;
    await patchWithOCC(() => getIssueById(issueId), (current) => getClient().patch(`/issues/${issueId}`, {
        version: current.version,
        comment
    }));
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
export async function createUserStory(projectSlug, subject, description) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().post("/userstories", {
            project: project.id,
            subject,
            ...(description != null ? { description } : {})
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function createTask(projectSlug, subject, options) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().post("/tasks", {
            project: project.id,
            subject,
            ...(options?.description != null ? { description: options.description } : {}),
            ...(options?.userStoryId != null ? { user_story: options.userStoryId } : {})
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function createIssue(projectSlug, subject, description) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const res = await getClient().post("/issues", {
            project: project.id,
            subject,
            ...(description != null ? { description } : {})
        });
        return res.data;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function resolveMilestoneId(projectId, milestoneSlug, milestoneId) {
    if (milestoneId != null)
        return milestoneId;
    if (milestoneSlug == null)
        return undefined;
    try {
        const res = await getClient().get("/milestones", {
            params: { project: projectId }
        });
        const milestones = Array.isArray(res.data) ? res.data : [];
        const normalized = milestoneSlug.trim().toLowerCase();
        const matches = milestones.filter((m) => m.slug.trim().toLowerCase() === normalized ||
            m.name.trim().toLowerCase() === normalized);
        if (matches.length === 0) {
            throw new TaigaError(`No milestone named or slugged "${milestoneSlug}" in project ${projectId}.`);
        }
        if (matches.length > 1) {
            throw new TaigaError(`Ambiguous milestone "${milestoneSlug}" (${matches.length} matches).`);
        }
        return matches[0].id;
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
async function buildStoryPatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "user_story", fields);
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
async function buildTaskPatchBody(projectId, fields) {
    const body = {};
    applyCommonPatchFields(body, fields);
    await applyStatusToBody(body, projectId, "task", fields);
    const milestone = await resolveMilestoneId(projectId, fields.milestoneSlug, fields.milestoneId);
    if (milestone != null)
        body.milestone = milestone;
    if (Object.keys(body).length === 0) {
        throw new TaigaError("Provide at least one field to update.");
    }
    return body;
}
async function buildIssuePatchBody(projectId, fields) {
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
export function trimIssueDetail(issue) {
    return {
        id: issue.id,
        ref: issue.ref,
        subject: issue.subject,
        description: issue.description ?? null,
        status: issue.status_extra_info?.name ?? null,
        assigned_to: issue.assigned_to_extra_info?.full_name_display ?? null,
        milestone: issue.milestone_slug ?? issue.milestone_name ?? null,
        version: issue.version,
        tags: normalizeTags(issue.tags),
        is_blocked: issue.is_blocked ?? false,
        blocked_note: issue.blocked_note ?? null,
        is_closed: issue.is_closed ?? issue.status_extra_info?.is_closed ?? false,
        priority: issue.priority ?? null,
        severity: issue.severity ?? null
    };
}
function normalizeTags(tags) {
    if (!tags?.length)
        return [];
    return tags.map((t) => (Array.isArray(t) ? t[0] : t));
}
function trimTask(task) {
    return {
        id: task.id,
        ref: task.ref,
        subject: task.subject,
        description: task.description ?? null,
        status: task.status_extra_info?.name ?? null,
        assigned_to: task.assigned_to_extra_info?.full_name_display ?? null,
        is_closed: task.is_closed,
        version: task.version,
        blocked_note: task.blocked_note ?? null,
        tags: task.tags ?? []
    };
}
function trimEpics(story) {
    return (story.epics ?? []).map((e) => ({
        id: e.id,
        ref: e.ref,
        subject: e.subject
    }));
}
function historyTimestamp(entry) {
    const raw = entry.created_at;
    if (!raw)
        return 0;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? 0 : t;
}
export function trimHistory(entries) {
    const candidates = [];
    for (const raw of entries) {
        const comment = raw.comment?.trim();
        const diff = raw.values_diff ?? raw.diff;
        const hasDiff = diff != null &&
            typeof diff === "object" &&
            Object.keys(diff).length > 0;
        if (!comment && !hasDiff)
            continue;
        candidates.push({
            ts: historyTimestamp(raw),
            entry: {
                id: raw.id,
                type: raw.type,
                created_at: raw.created_at ?? null,
                user: raw.user?.name ?? raw.user?.username ?? null,
                comment: comment || null,
                changes: hasDiff ? diff : null
            }
        });
    }
    candidates.sort((a, b) => b.ts - a.ts);
    return candidates.slice(0, HISTORY_CAP).map((c) => c.entry);
}
export function resolvePointsByRole(points, defs) {
    if (!points || Object.keys(points).length === 0)
        return null;
    const byId = new Map(defs.map((p) => [String(p.id), p.name]));
    const out = {};
    for (const [id, value] of Object.entries(points)) {
        out[byId.get(id) ?? `point_${id}`] = value;
    }
    return out;
}
async function getPointsForProject(projectId) {
    try {
        const res = await getClient().get("/points", {
            params: { project: projectId }
        });
        return Array.isArray(res.data) ? res.data : [];
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
export async function listUserStories(projectSlug, milestoneId) {
    const project = await getProjectBySlug(projectSlug);
    try {
        const params = { project: project.id };
        if (milestoneId != null)
            params.milestone = milestoneId;
        const res = await getClient().get("/userstories", {
            params
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map((us) => ({
            id: us.id,
            ref: us.ref,
            subject: us.subject,
            status: us.status_extra_info?.name ?? null,
            milestone: us.milestone_name ?? null,
            is_closed: us.is_closed ?? false
        }));
    }
    catch (e) {
        throw wrapAxiosError(e);
    }
}
function trimSearchResults(data) {
    const out = [];
    for (const us of data.user_stories ?? []) {
        out.push({ type: "user_story", id: us.id, ref: us.ref, subject: us.subject });
    }
    for (const t of data.tasks ?? []) {
        out.push({ type: "task", id: t.id, ref: t.ref, subject: t.subject });
    }
    for (const e of data.epics ?? []) {
        out.push({ type: "epic", id: e.id, ref: e.ref, subject: e.subject });
    }
    for (const i of data.issues ?? []) {
        out.push({ type: "issue", id: i.id, ref: i.ref, subject: i.subject });
    }
    return out;
}
export function trimStoryWithTasks(story, tasks, history, pointsByRole) {
    const summary = {
        id: story.id,
        ref: story.ref,
        subject: story.subject,
        description: story.description,
        status: story.status_extra_info?.name ?? null,
        assigned_to: story.assigned_to_extra_info?.full_name_display ?? null,
        milestone: story.milestone_slug ?? story.milestone_name ?? null,
        version: story.version,
        tags: normalizeTags(story.tags),
        points: story.points ?? null,
        points_by_role: pointsByRole ?? null,
        is_blocked: story.is_blocked ?? false,
        blocked_note: story.blocked_note ?? null,
        due_date: story.due_date ?? null,
        total_comments: story.total_comments ?? null,
        epics: trimEpics(story),
        is_closed: story.is_closed ?? story.status_extra_info?.is_closed ?? false,
        tasks: tasks.map(trimTask)
    };
    if (history != null)
        summary.history = history;
    return summary;
}
export function trimTaskDetail(task) {
    return {
        ...trimTask(task),
        user_story: task.user_story ?? null
    };
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
    const pointDefs = await getPointsForProject(projectId);
    const pointsByRole = resolvePointsByRole(story.points, pointDefs);
    let history;
    if (includeHistory) {
        history = trimHistory(await getStoryHistory(story.id));
    }
    return trimStoryWithTasks(story, tasks, history, pointsByRole);
}
