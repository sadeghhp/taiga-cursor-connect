export { TaigaError } from "./http/client.js";
export {
  getClient,
  patchWithOCC,
  resetClient,
  setClientForTests,
  wrapAxiosError
} from "./http/client.js";
export { resolveStatusId, resolveMilestoneId, type StatusEntityType } from "./resolvers.js";
export {
  trimHistory,
  trimStoryWithTasks,
  trimTaskDetail,
  trimIssueDetail,
  trimEpicDetail,
  trimSearchResults,
  resolvePointsByRole,
  normalizeTags
} from "./trimmers.js";
export type {
  CommonUpdateFields,
  StoryUpdateFields,
  TaskUpdateFields,
  IssueUpdateFields,
  EpicUpdateFields,
  CreateOptionalFields
} from "./patch-builders.js";

import {
  assertEpicRefValid,
  assertIssueRefValid,
  assertStoryRefValid,
  assertTaskRefValid
} from "./schemas.js";
import {
  getClient,
  patchWithOCC,
  paginationHeaders,
  wrapAxiosError,
  TaigaError
} from "./http/client.js";
import {
  buildEpicPatchBody,
  buildIssuePatchBody,
  buildStoryPatchBody,
  buildTaskPatchBody,
  applyCreateOptions,
  hasStoryEpicMutation,
  hasStoryPatchFields,
  omitStoryEpicFields,
  type CreateOptionalFields,
  type EpicUpdateFields,
  type IssueUpdateFields,
  type StoryUpdateFields,
  type TaskUpdateFields
} from "./patch-builders.js";
import {
  buildListParams,
  parsePaginationHeaders,
  resolveMilestoneByRef,
  resolveMilestoneId,
  type StatusEntityType
} from "./resolvers.js";
import {
  resolvePointsFromEstimateHours,
  listPointsForProject,
  listRolesForProject
} from "./points.js";
import {
  trimEpicDetail,
  trimEpicListItem,
  trimHistory,
  trimIssueDetail,
  trimSearchResults,
  trimStoryWithTasks,
  trimTaskDetail,
  resolvePointsByRole
} from "./trimmers.js";
import type {
  EpicDetailSummary,
  EpicListSummary,
  EpicRefInput,
  EpicSummary,
  HistoryEntrySummary,
  IssueListSummary,
  IssueRefInput,
  IssueSummary,
  ListQuery,
  MemberSummary,
  MilestoneRefInput,
  MilestoneSummary,
  PaginatedResult,
  PointSummary,
  ProjectDetailSummary,
  ProjectSummary,
  SearchResultSummary,
  StoryRefInput,
  StorySummary,
  TaigaEpic,
  TaigaHistoryEntry,
  TaigaIssue,
  TaigaMembership,
  TaigaMilestone,
  TaigaPoint,
  TaigaProject,
  TaigaSearchResults,
  TaigaTask,
  TaigaUserStory,
  TaskListSummary,
  TaskRefInput,
  TaskSummary,
  UserStoryListItem,
  UserStoryListSummary
} from "./types.js";
import { getProjectBySlug } from "./project-context.js";

export { getProjectBySlug } from "./project-context.js";

export function trimProjectDetail(p: TaigaProject): ProjectDetailSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? null,
    is_epics_activated: p.is_epics_activated ?? false,
    is_issues_activated: p.is_issues_activated ?? false,
    is_wiki_activated: p.is_wiki_activated ?? false,
    is_kanban_activated: p.is_kanban_activated ?? false,
    is_backlog_activated: p.is_backlog_activated ?? false,
    is_private: p.is_private ?? false,
    total_milestones: p.total_milestones ?? null,
    total_story_points: p.total_story_points ?? null
  };
}

export async function getProjectDetail(projectSlug: string): Promise<ProjectDetailSummary> {
  return trimProjectDetail(await getProjectBySlug(projectSlug));
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

// --- Milestones ---

export async function listMilestones(
  projectSlug: string
): Promise<MilestoneSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaMilestone[]>("/milestones", {
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
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface CreateMilestoneInput {
  name: string;
  slug: string;
  estimatedStart: string;
  estimatedFinish: string;
  order?: number;
}

export async function createMilestone(
  projectSlug: string,
  input: CreateMilestoneInput
): Promise<MilestoneSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().post<TaigaMilestone>("/milestones", {
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
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface UpdateMilestoneFields {
  name?: string;
  estimatedStart?: string;
  estimatedFinish?: string;
  closed?: boolean;
}

export async function resolveMilestone(input: MilestoneRefInput): Promise<TaigaMilestone> {
  if (input.milestoneId != null) {
    try {
      const res = await getClient().get<TaigaMilestone>(
        `/milestones/${input.milestoneId}`
      );
      return res.data;
    } catch (e) {
      throw wrapAxiosError(e);
    }
  }
  if (input.projectSlug && input.milestoneSlug) {
    const project = await getProjectBySlug(input.projectSlug);
    return resolveMilestoneByRef(project.id, input.projectSlug, input.milestoneSlug);
  }
  throw new TaigaError("Provide milestoneId or projectSlug + milestoneSlug.");
}

export async function updateMilestone(
  input: MilestoneRefInput,
  fields: UpdateMilestoneFields
): Promise<MilestoneSummary> {
  const milestone = await resolveMilestone(input);
  const body: Record<string, unknown> = {};
  if (fields.name != null) body.name = fields.name;
  if (fields.estimatedStart != null) body.estimated_start = fields.estimatedStart;
  if (fields.estimatedFinish != null) body.estimated_finish = fields.estimatedFinish;
  if (fields.closed != null) body.closed = fields.closed;
  if (Object.keys(body).length === 0) {
    throw new TaigaError("Provide at least one field to update.");
  }

  await patchWithOCC(
    async () => {
      const m = await resolveMilestone({ milestoneId: milestone.id });
      if (m.version == null) {
        throw new TaigaError(`Milestone ${milestone.id} missing version for OCC patch.`);
      }
      return { version: m.version };
    },
    (current) =>
      getClient().patch(`/milestones/${milestone.id}`, {
        version: current.version,
        ...body
      })
  );
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

export async function listStatuses(
  projectSlug: string,
  entityType: StatusEntityType
): Promise<{ id: number; name: string; is_closed: boolean }[]> {
  const project = await getProjectBySlug(projectSlug);
  const path =
    entityType === "user_story"
      ? "/userstory-statuses"
      : entityType === "task"
        ? "/task-statuses"
        : entityType === "issue"
          ? "/issue-statuses"
          : "/epic-statuses";
  try {
    const res = await getClient().get<{ id: number; name: string; is_closed?: boolean }[]>(
      path,
      { params: { project: project.id } }
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      is_closed: s.is_closed ?? false
    }));
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function listMembers(projectSlug: string): Promise<MemberSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaMembership[]>("/memberships", {
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
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function listPoints(projectSlug: string): Promise<PointSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  return listPointsForProject(project.id);
}

// --- Stories ---

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
    throw wrapAxiosError(e, { projectSlug, storyRef });
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
  assertStoryRefValid(input);
  if (input.storyId != null) return getStoryById(input.storyId);
  return getStoryByRefSlug(input.projectSlug!, input.storyRef!);
}

async function resolveStoryProjectId(story: TaigaUserStory): Promise<number> {
  if (story.project != null) return story.project;
  const full = await getStoryById(story.id);
  if (full.project == null) {
    throw new TaigaError(`Could not determine project for user story ${story.id}.`);
  }
  return full.project;
}

export async function enrichCreateOptions(
  projectId: number,
  options?: CreateOptionalFields,
  entityType: StatusEntityType = "user_story"
): Promise<CreateOptionalFields | undefined> {
  if (options == null) return undefined;
  const out = { ...options };
  if (
    entityType === "user_story" &&
    options.estimateHours != null &&
    options.points == null
  ) {
    out.points = await resolvePointsFromEstimateHours(
      projectId,
      options.estimateHours
    );
  }
  return out;
}

export async function createUserStory(
  projectSlug: string,
  subject: string,
  description?: string,
  options?: CreateOptionalFields & { epicId?: number }
): Promise<TaigaUserStory> {
  const project = await getProjectBySlug(projectSlug);
  const enriched = await enrichCreateOptions(project.id, options);
  const body: Record<string, unknown> = {
    project: project.id,
    subject,
    ...(description != null ? { description } : {})
  };
  await applyCreateOptions(body, project.id, "user_story", enriched);
  try {
    const res = await getClient().post<TaigaUserStory>("/userstories", body);
    const story = res.data;
    if (options?.epicId != null) {
      await linkStoryToEpic(options.epicId, story.id);
    }
    return story;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function updateStory(
  input: StoryRefInput,
  fields: StoryUpdateFields
): Promise<TaigaUserStory> {
  if (fields.unlinkEpic === true && fields.epicId == null) {
    throw new TaigaError("epicId is required when unlinkEpic is true.");
  }
  const story = await resolveStory(input);
  const projectId = await resolveStoryProjectId(story);
  const patchFields = omitStoryEpicFields({ ...fields });
  if (!hasStoryPatchFields(fields) && !hasStoryEpicMutation(fields)) {
    throw new TaigaError("Provide at least one field to update.");
  }
  if (hasStoryPatchFields(fields)) {
    if (patchFields.estimateHours != null && patchFields.points == null) {
      patchFields.points = await resolvePointsFromEstimateHours(
        projectId,
        patchFields.estimateHours
      );
    }
    const patchBody = await buildStoryPatchBody(projectId, patchFields);
    await patchWithOCC(
      () => getStoryById(story.id),
      (current) =>
        getClient().patch(`/userstories/${story.id}`, {
          version: current.version,
          ...patchBody
        })
    );
  }

  if (fields.unlinkEpic && fields.epicId != null) {
    await unlinkStoryFromEpic(fields.epicId, story.id);
  } else if (fields.epicId != null) {
    await linkStoryToEpic(fields.epicId, story.id);
  }

  return getStoryById(story.id);
}

export async function addStoryComment(
  input: number | StoryRefInput,
  comment: string
): Promise<void> {
  const storyId =
    typeof input === "number" ? input : (await resolveStory(input)).id;
  await patchWithOCC(
    () => getStoryById(storyId),
    (current) =>
      getClient().patch(`/userstories/${storyId}`, {
        version: current.version,
        comment
      })
  );
}

export async function deleteUserStory(storyId: number): Promise<void> {
  try {
    await getClient().delete(`/userstories/${storyId}`);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

// --- Tasks ---

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
    throw wrapAxiosError(e, { projectSlug, taskRef });
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
  assertTaskRefValid(input);
  if (input.taskId != null) return getTask(input.taskId);
  return getTaskByRefSlug(input.projectSlug!, input.taskRef!);
}

async function resolveTaskProjectId(task: TaigaTask): Promise<number> {
  if (task.project != null) return task.project;
  const full = await getTask(task.id);
  if (full.project == null) {
    throw new TaigaError(`Could not determine project for task ${task.id}.`);
  }
  return full.project;
}

export async function createTask(
  projectSlug: string,
  subject: string,
  options?: {
    description?: string;
    userStoryId?: number;
  } & CreateOptionalFields
): Promise<TaigaTask> {
  const project = await getProjectBySlug(projectSlug);
  const enriched = await enrichCreateOptions(project.id, options, "task");
  const body: Record<string, unknown> = {
    project: project.id,
    subject,
    ...(options?.description != null ? { description: options.description } : {}),
    ...(options?.userStoryId != null ? { user_story: options.userStoryId } : {})
  };
  await applyCreateOptions(body, project.id, "task", enriched);
  try {
    const res = await getClient().post<TaigaTask>("/tasks", body);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
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

export async function addTaskComment(
  input: number | TaskRefInput,
  comment: string
): Promise<void> {
  const taskId =
    typeof input === "number" ? input : (await resolveTask(input)).id;
  await patchWithOCC(
    () => getTask(taskId),
    (current) =>
      getClient().patch(`/tasks/${taskId}`, {
        version: current.version,
        comment
      })
  );
}

export async function deleteTask(taskId: number): Promise<void> {
  try {
    await getClient().delete(`/tasks/${taskId}`);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

// --- Issues ---

export async function getIssueById(issueId: number): Promise<TaigaIssue> {
  try {
    const res = await getClient().get<TaigaIssue>(`/issues/${issueId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getIssueByRefSlug(
  projectSlug: string,
  issueRef: number
): Promise<TaigaIssue> {
  try {
    const res = await getClient().get<TaigaIssue>("/issues/by_ref", {
      params: { ref: issueRef, project__slug: projectSlug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, issueRef });
  }
}

export async function resolveIssue(input: IssueRefInput): Promise<TaigaIssue> {
  assertIssueRefValid(input);
  if (input.issueId != null) return getIssueById(input.issueId);
  return getIssueByRefSlug(input.projectSlug!, input.issueRef!);
}

async function resolveIssueProjectId(issue: TaigaIssue): Promise<number> {
  if (issue.project != null) return issue.project;
  const full = await getIssueById(issue.id);
  if (full.project == null) {
    throw new TaigaError(`Could not determine project for issue ${issue.id}.`);
  }
  return full.project;
}

export async function createIssue(
  projectSlug: string,
  subject: string,
  description?: string,
  options?: CreateOptionalFields
): Promise<TaigaIssue> {
  const project = await getProjectBySlug(projectSlug);
  const enriched = await enrichCreateOptions(project.id, options, "issue");
  const body: Record<string, unknown> = {
    project: project.id,
    subject,
    ...(description != null ? { description } : {})
  };
  await applyCreateOptions(body, project.id, "issue", enriched);
  try {
    const res = await getClient().post<TaigaIssue>("/issues", body);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function updateIssue(
  input: IssueRefInput,
  fields: IssueUpdateFields
): Promise<TaigaIssue> {
  const issue = await resolveIssue(input);
  const projectId = await resolveIssueProjectId(issue);
  const patchBody = await buildIssuePatchBody(projectId, fields);

  await patchWithOCC(
    () => getIssueById(issue.id),
    (current) =>
      getClient().patch(`/issues/${issue.id}`, {
        version: current.version,
        ...patchBody
      })
  );
  return getIssueById(issue.id);
}

export async function addIssueComment(
  input: number | IssueRefInput,
  comment: string
): Promise<void> {
  const issueId =
    typeof input === "number" ? input : (await resolveIssue(input)).id;
  await patchWithOCC(
    () => getIssueById(issueId),
    (current) =>
      getClient().patch(`/issues/${issueId}`, {
        version: current.version,
        comment
      })
  );
}

export async function deleteIssue(issueId: number): Promise<void> {
  try {
    await getClient().delete(`/issues/${issueId}`);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

// --- Epics ---

export async function getEpicById(epicId: number): Promise<TaigaEpic> {
  try {
    const res = await getClient().get<TaigaEpic>(`/epics/${epicId}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getEpicByRefSlug(
  projectSlug: string,
  epicRef: number
): Promise<TaigaEpic> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaEpic>("/epics/by_ref", {
      params: { ref: epicRef, project: project.id }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, epicRef });
  }
}

export async function resolveEpic(input: EpicRefInput): Promise<TaigaEpic> {
  assertEpicRefValid(input);
  if (input.epicId != null) return getEpicById(input.epicId);
  return getEpicByRefSlug(input.projectSlug!, input.epicRef!);
}

export async function createEpic(
  projectSlug: string,
  subject: string,
  description?: string,
  options?: CreateOptionalFields
): Promise<TaigaEpic> {
  const project = await getProjectBySlug(projectSlug);
  const enriched = await enrichCreateOptions(project.id, options, "epic");
  const body: Record<string, unknown> = {
    project: project.id,
    subject,
    ...(description != null ? { description } : {})
  };
  await applyCreateOptions(body, project.id, "epic", enriched);
  try {
    const res = await getClient().post<TaigaEpic>("/epics", body);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function updateEpic(
  input: EpicRefInput,
  fields: EpicUpdateFields
): Promise<TaigaEpic> {
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

  await patchWithOCC(
    () => getEpicById(epic.id),
    (current) =>
      getClient().patch(`/epics/${epic.id}`, {
        version: current.version,
        ...patchBody
      })
  );
  return getEpicById(epic.id);
}

export async function addEpicComment(
  input: number | EpicRefInput,
  comment: string
): Promise<void> {
  const epicId =
    typeof input === "number" ? input : (await resolveEpic(input)).id;
  await patchWithOCC(
    () => getEpicById(epicId),
    (current) =>
      getClient().patch(`/epics/${epicId}`, {
        version: current.version,
        comment
      })
  );
}

async function isStoryLinkedToEpic(
  epicId: number,
  userStoryId: number
): Promise<boolean> {
  try {
    const res = await getClient().get<Array<{ user_story: number }>>(
      `/epics/${epicId}/related_userstories`
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.some((r) => r.user_story === userStoryId);
  } catch {
    return false;
  }
}

function isDuplicateEpicLinkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status !== 400 && status !== 409) return false;
  const body = err.response?.data;
  const detail =
    typeof body === "object" && body !== null
      ? String((body as { detail?: string }).detail ?? "").toLowerCase()
      : "";
  return (
    detail.includes("already") ||
    detail.includes("duplicate") ||
    detail.includes("exist")
  );
}

export async function linkStoryToEpic(
  epicId: number,
  userStoryId: number
): Promise<void> {
  if (await isStoryLinkedToEpic(epicId, userStoryId)) {
    return;
  }
  try {
    await getClient().post(`/epics/${epicId}/related_userstories`, {
      epic: epicId,
      user_story: userStoryId
    });
  } catch (e) {
    if (isDuplicateEpicLinkError(e)) return;
    throw wrapAxiosError(e, { epicId, userStoryId });
  }
}

export async function unlinkStoryFromEpic(
  epicId: number,
  userStoryId: number
): Promise<void> {
  try {
    await getClient().delete(
      `/epics/${epicId}/related_userstories/${userStoryId}`
    );
  } catch (e) {
    throw wrapAxiosError(e, { epicId, userStoryId });
  }
}

export async function deleteEpic(epicId: number): Promise<void> {
  try {
    await getClient().delete(`/epics/${epicId}`);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

// --- List with filters ---

async function fetchList<T>(
  path: string,
  projectId: number,
  query: ListQuery,
  entityType: StatusEntityType,
  mapRow: (row: T) => unknown
): Promise<UserStoryListSummary[] | TaskListSummary[] | IssueListSummary[] | EpicListSummary[] | PaginatedResult<unknown>> {
  const params = await buildListParams(projectId, query, entityType);
  const headers =
    query.page != null
      ? paginationHeaders(query.page, query.pageSize)
      : undefined;

  try {
    const res = await getClient().get<T[]>(path, { params, headers });
    const rows = Array.isArray(res.data) ? res.data : [];
    const items = rows.map((r) => mapRow(r));

    if (query.page != null) {
      const meta = parsePaginationHeaders(res, query.page, query.pageSize);
      return { items, ...meta } as PaginatedResult<unknown>;
    }
    return items as UserStoryListSummary[];
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function listUserStories(
  projectSlug: string,
  queryOrMilestoneId: ListQuery | number = {}
): Promise<UserStoryListSummary[] | PaginatedResult<UserStoryListSummary>> {
  const query: ListQuery =
    typeof queryOrMilestoneId === "number"
      ? { milestoneId: queryOrMilestoneId }
      : queryOrMilestoneId;
  const project = await getProjectBySlug(projectSlug);
  const result = await fetchList<UserStoryListItem>(
    "/userstories",
    project.id,
    query,
    "user_story",
    (us) => ({
      id: us.id,
      ref: us.ref,
      subject: us.subject,
      status: us.status_extra_info?.name ?? null,
      milestone: us.milestone_name ?? null,
      is_closed: us.is_closed ?? false
    })
  );
  return result as UserStoryListSummary[] | PaginatedResult<UserStoryListSummary>;
}

export async function listTasks(
  projectSlug: string,
  queryOrUserStoryId: ListQuery | number = {}
): Promise<TaskListSummary[] | PaginatedResult<TaskListSummary>> {
  const query: ListQuery =
    typeof queryOrUserStoryId === "number"
      ? { userStoryId: queryOrUserStoryId }
      : queryOrUserStoryId;
  const project = await getProjectBySlug(projectSlug);
  const result = await fetchList<TaigaTask>(
    "/tasks",
    project.id,
    query,
    "task",
    (t) => ({
      id: t.id,
      ref: t.ref,
      subject: t.subject,
      status: t.status_extra_info?.name ?? null,
      is_closed: t.is_closed,
      user_story: t.user_story ?? null
    })
  );
  return result as TaskListSummary[] | PaginatedResult<TaskListSummary>;
}

export async function listIssues(
  projectSlug: string,
  query: ListQuery = {}
): Promise<IssueListSummary[] | PaginatedResult<IssueListSummary>> {
  const project = await getProjectBySlug(projectSlug);
  const result = await fetchList<TaigaIssue>(
    "/issues",
    project.id,
    query,
    "issue",
    (i) => ({
      id: i.id,
      ref: i.ref,
      subject: i.subject,
      status: i.status_extra_info?.name ?? null,
      is_closed: i.is_closed ?? i.status_extra_info?.is_closed ?? false
    })
  );
  return result as IssueListSummary[] | PaginatedResult<IssueListSummary>;
}

export async function listEpics(
  projectSlug: string,
  query: ListQuery = {}
): Promise<EpicListSummary[] | PaginatedResult<EpicListSummary>> {
  const project = await getProjectBySlug(projectSlug);
  const result = await fetchList<TaigaEpic>(
    "/epics",
    project.id,
    query,
    "epic",
    (e) => trimEpicListItem(e)
  );
  return result as EpicListSummary[] | PaginatedResult<EpicListSummary>;
}

// --- History / search / bundle ---

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

export async function getIssueHistory(issueId: number): Promise<TaigaHistoryEntry[]> {
  try {
    const res = await getClient().get<TaigaHistoryEntry[]>(`/history/issue/${issueId}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    throw wrapAxiosError(e);
  }
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
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function fetchStoryBundle(
  input: StoryRefInput,
  includeHistory: boolean
): Promise<StorySummary> {
  const story = await resolveStory(input);
  let projectId = story.project;
  if (projectId == null) {
    if (input.projectSlug) {
      projectId = (await getProjectBySlug(input.projectSlug)).id;
    } else {
      const full = await getStoryById(story.id);
      if (full.project == null) {
        throw new TaigaError(`Could not determine project for user story ${story.id}.`);
      }
      projectId = full.project;
    }
  }
  const tasks = await getTasksForStory(projectId, story.id);
  const pointDefs = await listPointsForProject(projectId);
  const pointsByRole = resolvePointsByRole(story.points, pointDefs as TaigaPoint[]);
  let history: HistoryEntrySummary[] | undefined;
  if (includeHistory) {
    history = trimHistory(await getStoryHistory(story.id));
  }
  return trimStoryWithTasks(story, tasks, history, pointsByRole);
}

// --- Bulk order ---

export interface StoryOrderEntry {
  storyId?: number;
  storyRef?: number;
  projectSlug?: string;
  order: number;
}

export async function updateStoryBacklogOrder(
  projectSlug: string,
  entries: StoryOrderEntry[]
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  const bulk_stories: { us_id: number; order: number }[] = [];
  for (const e of entries) {
    const story = e.storyId
      ? await getStoryById(e.storyId)
      : await getStoryByRefSlug(e.projectSlug ?? projectSlug, e.storyRef!);
    bulk_stories.push({ us_id: story.id, order: e.order });
  }
  try {
    await getClient().post("/userstories/bulk_update_backlog_order", {
      project_id: project.id,
      bulk_stories
    });
  } catch (err) {
    throw wrapAxiosError(err, { projectSlug });
  }
}

export async function updateStorySprintOrder(
  projectSlug: string,
  entries: StoryOrderEntry[]
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  const bulk_stories: { us_id: number; order: number }[] = [];
  for (const e of entries) {
    const story = e.storyId
      ? await getStoryById(e.storyId)
      : await getStoryByRefSlug(e.projectSlug ?? projectSlug, e.storyRef!);
    bulk_stories.push({ us_id: story.id, order: e.order });
  }
  try {
    await getClient().post("/userstories/bulk_update_sprint_order", {
      project_id: project.id,
      bulk_stories
    });
  } catch (err) {
    throw wrapAxiosError(err, { projectSlug });
  }
}

// --- Archive (soft close) ---

export async function archiveStory(input: StoryRefInput): Promise<TaigaUserStory> {
  return updateStory(input, { isClosed: true });
}

export async function archiveTask(input: TaskRefInput): Promise<TaigaTask> {
  return updateTask(input, { isClosed: true });
}

export async function archiveEpic(input: EpicRefInput): Promise<TaigaEpic> {
  return updateEpic(input, { isClosed: true });
}

export async function archiveIssue(input: IssueRefInput): Promise<TaigaIssue> {
  return updateIssue(input, { isClosed: true });
}

export {
  listProjectTemplates,
  createProject,
  updateProject,
  duplicateProject,
  deleteProject
} from "./projects.js";
export type {
  CreateProjectInput,
  UpdateProjectInput,
  DuplicateProjectInput
} from "./projects.js";

export {
  listIssueTypes,
  listPriorities,
  listSeverities,
  listRoles,
  getMilestone,
  getMilestoneById
} from "./metadata.js";

export { inviteMember } from "./memberships.js";
export type { InviteMemberInput } from "./memberships.js";

export {
  listProjectTags,
  createProjectTag,
  editProjectTag,
  deleteProjectTag,
  getProjectStats,
  getProjectIssueStats
} from "./tags.js";

export {
  listWikiPages,
  getWikiPage,
  createWikiPage,
  updateWikiPage,
  deleteWikiPage
} from "./wiki.js";

export {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook
} from "./webhooks.js";
export type { CreateWebhookInput, UpdateWebhookInput } from "./webhooks.js";
