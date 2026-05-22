import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig
} from "axios";
import type {
  EpicSummary,
  HistoryEntrySummary,
  ProjectSummary,
  SearchResultSummary,
  StoryRefInput,
  StorySummary,
  TaigaHistoryEntry,
  TaigaMilestone,
  TaigaPoint,
  TaigaProject,
  TaigaSearchResults,
  TaigaStatus,
  TaigaTask,
  TaigaUserStory,
  TaskRefInput,
  TaskSummary,
  UserStoryListItem,
  UserStoryListSummary
} from "./types.js";

const TAIGA_API_URL = process.env.TAIGA_API_URL?.replace(/\/$/, "") ?? "";
const TAIGA_TOKEN = process.env.TAIGA_TOKEN ?? "";
const HISTORY_CAP = 50;
const OCC_MAX_RETRIES = 2;
const THROTTLE_MAX_RETRIES = 3;
const THROTTLE_BASE_MS = 1000;

type RetryConfig = InternalAxiosRequestConfig & { _retry429?: number };

export class TaigaError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "TaigaError";
  }
}

function requireConfig(): void {
  if (!TAIGA_API_URL || !TAIGA_TOKEN) {
    throw new TaigaError(
      "Missing TAIGA_API_URL or TAIGA_TOKEN. Set them in environment or .env."
    );
  }
}

function wrapAxiosError(err: unknown): TaigaError {
  if (err instanceof TaigaError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ detail?: string; _error_message?: string }>;
    const status = ax.response?.status;
    const body = ax.response?.data;
    const detail =
      (typeof body === "object" && body !== null
        ? body.detail ?? body._error_message
        : undefined) ?? ax.message;
    return new TaigaError(`Taiga API error (${status ?? "network"}): ${detail}`, status);
  }
  return new TaigaError(err instanceof Error ? err.message : String(err));
}

function isVersionConflict(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status === 409) return true;
  const body = err.response?.data;
  if (typeof body === "object" && body !== null) {
    const detail = String((body as { detail?: string }).detail ?? "").toLowerCase();
    if (detail.includes("version")) return true;
  }
  return false;
}

let client: AxiosInstance | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: TAIGA_API_URL,
    headers: {
      Authorization: `Bearer ${TAIGA_TOKEN}`,
      "Content-Type": "application/json",
      "x-disable-pagination": "True"
    }
  });
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetryConfig | undefined;
      if (
        error.response?.status === 429 &&
        config &&
        (config._retry429 ?? 0) < THROTTLE_MAX_RETRIES
      ) {
        config._retry429 = (config._retry429 ?? 0) + 1;
        await sleep(THROTTLE_BASE_MS * config._retry429);
        return instance.request(config);
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

export function getClient(): AxiosInstance {
  requireConfig();
  if (!client) {
    client = createClient();
  }
  return client;
}

/** @internal Reset HTTP client (tests only). */
export function resetClient(): void {
  client = null;
}

export async function patchWithOCC<T extends { version: number }>(
  fetchCurrent: () => Promise<T>,
  patch: (entity: T) => Promise<void>
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= OCC_MAX_RETRIES; attempt++) {
    try {
      const entity = await fetchCurrent();
      await patch(entity);
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < OCC_MAX_RETRIES && isVersionConflict(e)) continue;
      throw wrapAxiosError(e);
    }
  }
  throw wrapAxiosError(lastErr);
}

export function assertStoryRefInput(input: StoryRefInput): void {
  if (input.storyId != null) return;
  if (input.projectSlug && input.storyRef != null) return;
  throw new TaigaError(
    "Provide either storyId or both projectSlug and storyRef."
  );
}

export function assertTaskRefInput(input: TaskRefInput): void {
  if (input.taskId != null) return;
  if (input.projectSlug && input.taskRef != null) return;
  throw new TaigaError(
    "Provide either taskId or both projectSlug and taskRef."
  );
}

export async function getProjectBySlug(slug: string): Promise<TaigaProject> {
  try {
    const res = await getClient().get<TaigaProject>("/projects/by_slug", {
      params: { slug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  try {
    const res = await getClient().get<TaigaProject[]>("/projects");
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name }));
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getStoryByRefSlug(
  projectSlug: string,
  storyRef: number
): Promise<TaigaUserStory> {
  try {
    const res = await getClient().get<TaigaUserStory>("/userstories/by_ref", {
      params: { ref: storyRef, project__slug: projectSlug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getStoryByRef(
  projectId: number,
  storyRef: number
): Promise<TaigaUserStory> {
  try {
    const res = await getClient().get<TaigaUserStory>("/userstories/by_ref", {
      params: { ref: storyRef, project: projectId }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getStoryById(storyId: number): Promise<TaigaUserStory> {
  try {
    const res = await getClient().get<TaigaUserStory>(`/userstories/${storyId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function resolveStory(input: StoryRefInput): Promise<TaigaUserStory> {
  assertStoryRefInput(input);
  if (input.storyId != null) return getStoryById(input.storyId);
  return getStoryByRefSlug(input.projectSlug!, input.storyRef!);
}

export async function getTaskByRefSlug(
  projectSlug: string,
  taskRef: number
): Promise<TaigaTask> {
  try {
    const res = await getClient().get<TaigaTask>("/tasks/by_ref", {
      params: { ref: taskRef, project__slug: projectSlug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getTask(taskId: number): Promise<TaigaTask> {
  try {
    const res = await getClient().get<TaigaTask>(`/tasks/${taskId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function resolveTask(input: TaskRefInput): Promise<TaigaTask> {
  assertTaskRefInput(input);
  if (input.taskId != null) return getTask(input.taskId);
  return getTaskByRefSlug(input.projectSlug!, input.taskRef!);
}

export async function getTasksForStory(
  projectId: number,
  storyId: number
): Promise<TaigaTask[]> {
  try {
    const res = await getClient().get<TaigaTask[]>("/tasks", {
      params: { project: projectId, user_story: storyId }
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getStoryHistory(storyId: number): Promise<TaigaHistoryEntry[]> {
  try {
    const res = await getClient().get<TaigaHistoryEntry[]>(
      `/history/userstory/${storyId}`
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getTaskHistory(taskId: number): Promise<TaigaHistoryEntry[]> {
  try {
    const res = await getClient().get<TaigaHistoryEntry[]>(`/history/task/${taskId}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function searchProject(
  projectSlug: string,
  text: string
): Promise<SearchResultSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaSearchResults>("/search", {
      params: { project: project.id, text }
    });
    return trimSearchResults(res.data);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export type StatusEntityType = "user_story" | "task";

export async function resolveStatusId(
  projectId: number,
  entityType: StatusEntityType,
  statusName: string
): Promise<number> {
  const path =
    entityType === "user_story" ? "/userstory-statuses" : "/task-statuses";
  try {
    const res = await getClient().get<TaigaStatus[]>(path, {
      params: { project: projectId }
    });
    const statuses = Array.isArray(res.data) ? res.data : [];
    const normalized = statusName.trim().toLowerCase();
    const matches = statuses.filter(
      (s) => s.name.trim().toLowerCase() === normalized
    );
    if (matches.length === 0) {
      throw new TaigaError(
        `No ${entityType} status named "${statusName}" in project ${projectId}.`
      );
    }
    if (matches.length > 1) {
      throw new TaigaError(
        `Ambiguous status name "${statusName}" (${matches.length} matches).`
      );
    }
    return matches[0].id;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

async function resolveStoryProjectId(story: TaigaUserStory): Promise<number> {
  if (story.project != null) return story.project;
  const full = await getStoryById(story.id);
  if (full.project == null) {
    throw new TaigaError(`Could not determine project for user story ${story.id}.`);
  }
  return full.project;
}

async function resolveTaskProjectId(task: TaigaTask): Promise<number> {
  if (task.project != null) return task.project;
  const full = await getTask(task.id);
  if (full.project == null) {
    throw new TaigaError(`Could not determine project for task ${task.id}.`);
  }
  return full.project;
}

async function storyIdFromInput(input: number | StoryRefInput): Promise<number> {
  return typeof input === "number" ? input : (await resolveStory(input)).id;
}

async function taskIdFromInput(input: number | TaskRefInput): Promise<number> {
  return typeof input === "number" ? input : (await resolveTask(input)).id;
}

export async function addStoryComment(
  input: number | StoryRefInput,
  comment: string
): Promise<void> {
  const storyId = await storyIdFromInput(input);
  await patchWithOCC(
    () => getStoryById(storyId),
    (current) =>
      getClient().patch(`/userstories/${storyId}`, {
        version: current.version,
        comment
      })
  );
}

export async function addTaskComment(
  input: number | TaskRefInput,
  comment: string
): Promise<void> {
  const taskId = await taskIdFromInput(input);
  await patchWithOCC(
    () => getTask(taskId),
    (current) =>
      getClient().patch(`/tasks/${taskId}`, {
        version: current.version,
        comment
      })
  );
}

export interface StoryUpdateFields {
  statusId?: number;
  statusName?: string;
  isClosed?: boolean;
  subject?: string;
  description?: string;
  milestoneId?: number;
  milestoneSlug?: string;
}

export interface TaskUpdateFields {
  statusId?: number;
  statusName?: string;
  isClosed?: boolean;
  subject?: string;
  description?: string;
}

export async function updateStory(
  input: StoryRefInput,
  fields: StoryUpdateFields
): Promise<TaigaUserStory> {
  const story = await resolveStory(input);
  const projectId = await resolveStoryProjectId(story as TaigaUserStory & { project?: number });
  const patchBody = await buildStoryPatchBody(projectId, fields);

  await patchWithOCC(
    () => getStoryById(story.id),
    (current) =>
      getClient().patch(`/userstories/${story.id}`, {
        version: current.version,
        ...patchBody
      })
  );
  return getStoryById(story.id);
}

export async function updateTask(
  input: TaskRefInput,
  fields: TaskUpdateFields
): Promise<TaigaTask> {
  const task = await resolveTask(input);
  const projectId = await resolveTaskProjectId(task);
  const patchBody = await buildTaskPatchBody(projectId, fields);

  await patchWithOCC(
    () => getTask(task.id),
    (current) =>
      getClient().patch(`/tasks/${task.id}`, {
        version: current.version,
        ...patchBody
      })
  );
  return getTask(task.id);
}

export async function resolveMilestoneId(
  projectId: number,
  milestoneSlug?: string,
  milestoneId?: number
): Promise<number | undefined> {
  if (milestoneId != null) return milestoneId;
  if (milestoneSlug == null) return undefined;
  try {
    const res = await getClient().get<TaigaMilestone[]>("/milestones", {
      params: { project: projectId }
    });
    const milestones = Array.isArray(res.data) ? res.data : [];
    const normalized = milestoneSlug.trim().toLowerCase();
    const matches = milestones.filter(
      (m) =>
        m.slug.trim().toLowerCase() === normalized ||
        m.name.trim().toLowerCase() === normalized
    );
    if (matches.length === 0) {
      throw new TaigaError(
        `No milestone named or slugged "${milestoneSlug}" in project ${projectId}.`
      );
    }
    if (matches.length > 1) {
      throw new TaigaError(
        `Ambiguous milestone "${milestoneSlug}" (${matches.length} matches).`
      );
    }
    return matches[0].id;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

async function buildStoryPatchBody(
  projectId: number,
  fields: StoryUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (fields.subject != null) body.subject = fields.subject;
  if (fields.description != null) body.description = fields.description;
  if (fields.isClosed != null) body.is_closed = fields.isClosed;
  if (fields.statusId != null) body.status = fields.statusId;
  else if (fields.statusName != null) {
    body.status = await resolveStatusId(projectId, "user_story", fields.statusName);
  }
  const milestone = await resolveMilestoneId(
    projectId,
    fields.milestoneSlug,
    fields.milestoneId
  );
  if (milestone != null) body.milestone = milestone;
  if (Object.keys(body).length === 0) {
    throw new TaigaError(
      "Provide at least one field to update: statusName, statusId, isClosed, subject, description, milestoneSlug, or milestoneId."
    );
  }
  return body;
}

async function buildTaskPatchBody(
  projectId: number,
  fields: TaskUpdateFields
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (fields.subject != null) body.subject = fields.subject;
  if (fields.description != null) body.description = fields.description;
  if (fields.isClosed != null) body.is_closed = fields.isClosed;
  if (fields.statusId != null) body.status = fields.statusId;
  else if (fields.statusName != null) {
    body.status = await resolveStatusId(projectId, "task", fields.statusName);
  }
  if (Object.keys(body).length === 0) {
    throw new TaigaError(
      "Provide at least one field to update: statusName, statusId, isClosed, subject, or description."
    );
  }
  return body;
}

function normalizeTags(
  tags?: Array<string | [string, string | null]>
): string[] {
  if (!tags?.length) return [];
  return tags.map((t) => (Array.isArray(t) ? t[0] : t));
}

function trimTask(task: TaigaTask): TaskSummary {
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

function trimEpics(story: TaigaUserStory): EpicSummary[] {
  return (story.epics ?? []).map((e) => ({
    id: e.id,
    ref: e.ref,
    subject: e.subject
  }));
}

function historyTimestamp(entry: TaigaHistoryEntry): number {
  const raw = entry.created_at;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

export function trimHistory(entries: TaigaHistoryEntry[]): HistoryEntrySummary[] {
  const candidates: { ts: number; entry: HistoryEntrySummary }[] = [];
  for (const raw of entries) {
    const comment = raw.comment?.trim();
    const diff = raw.values_diff ?? raw.diff;
    const hasDiff =
      diff != null &&
      typeof diff === "object" &&
      Object.keys(diff as object).length > 0;
    if (!comment && !hasDiff) continue;

    candidates.push({
      ts: historyTimestamp(raw),
      entry: {
        id: raw.id,
        type: raw.type,
        created_at: raw.created_at ?? null,
        user: raw.user?.name ?? raw.user?.username ?? null,
        comment: comment || null,
        changes: hasDiff ? (diff as Record<string, unknown>) : null
      }
    });
  }
  candidates.sort((a, b) => b.ts - a.ts);
  return candidates.slice(0, HISTORY_CAP).map((c) => c.entry);
}

export function resolvePointsByRole(
  points: Record<string, number> | undefined,
  defs: TaigaPoint[]
): Record<string, number> | null {
  if (!points || Object.keys(points).length === 0) return null;
  const byId = new Map(defs.map((p) => [String(p.id), p.name]));
  const out: Record<string, number> = {};
  for (const [id, value] of Object.entries(points)) {
    out[byId.get(id) ?? `point_${id}`] = value;
  }
  return out;
}

async function getPointsForProject(projectId: number): Promise<TaigaPoint[]> {
  try {
    const res = await getClient().get<TaigaPoint[]>("/points", {
      params: { project: projectId }
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function listUserStories(
  projectSlug: string,
  milestoneId?: number
): Promise<UserStoryListSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const params: Record<string, number> = { project: project.id };
    if (milestoneId != null) params.milestone = milestoneId;
    const res = await getClient().get<UserStoryListItem[]>("/userstories", {
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
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

function trimSearchResults(data: TaigaSearchResults): SearchResultSummary[] {
  const out: SearchResultSummary[] = [];
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

export function trimStoryWithTasks(
  story: TaigaUserStory,
  tasks: TaigaTask[],
  history?: HistoryEntrySummary[],
  pointsByRole?: Record<string, number> | null
): StorySummary {
  const summary: StorySummary = {
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
    is_closed:
      story.is_closed ?? story.status_extra_info?.is_closed ?? false,
    tasks: tasks.map(trimTask)
  };
  if (history != null) summary.history = history;
  return summary;
}

export function trimTaskDetail(task: TaigaTask): TaskSummary & { user_story: number | null } {
  return {
    ...trimTask(task),
    user_story: task.user_story ?? null
  };
}

export async function fetchStoryBundle(
  projectSlug: string,
  storyRef: number,
  includeHistory: boolean
): Promise<StorySummary> {
  const story = await getStoryByRefSlug(projectSlug, storyRef);
  const projectId =
    story.project ?? (await getProjectBySlug(projectSlug)).id;
  const tasks = await getTasksForStory(projectId, story.id);
  const pointDefs = await getPointsForProject(projectId);
  const pointsByRole = resolvePointsByRole(story.points, pointDefs);
  let history: HistoryEntrySummary[] | undefined;
  if (includeHistory) {
    history = trimHistory(await getStoryHistory(story.id));
  }
  return trimStoryWithTasks(story, tasks, history, pointsByRole);
}
