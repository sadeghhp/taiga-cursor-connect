import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import { getProjectBySlug } from "./project-context.js";
import { assertEntityProject } from "./project-resource.js";
import { resolveStatusId } from "./resolvers.js";import type {
  TaigaUserStoryStatus,
  UserStoryStatusSummary
} from "./types.js";

function trimStatus(s: TaigaUserStoryStatus): UserStoryStatusSummary {
  return {
    id: s.id,
    name: s.name,
    order: s.order,
    color: s.color ?? null,
    wip_limit: s.wip_limit ?? null,
    is_closed: s.is_closed ?? false
  };
}

export async function listUserStoryStatuses(
  projectSlug: string
): Promise<UserStoryStatusSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaUserStoryStatus[]>(
      "/userstory-statuses",
      { params: { project: project.id } }
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(trimStatus).sort((a, b) => a.order - b.order);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface CreateUserStoryStatusInput {
  name: string;
  color?: string;
  order?: number;
  wipLimit?: number;
  isClosed?: boolean;
}

export async function createUserStoryStatus(
  projectSlug: string,
  input: CreateUserStoryStatusInput
): Promise<UserStoryStatusSummary> {
  const project = await getProjectBySlug(projectSlug);
  const body: Record<string, unknown> = {
    name: input.name,
    project: project.id
  };
  if (input.color != null) body.color = input.color;
  if (input.order != null) body.order = input.order;
  if (input.wipLimit != null) body.wip_limit = input.wipLimit;
  if (input.isClosed != null) body.is_closed = input.isClosed;
  try {
    const res = await getClient().post<TaigaUserStoryStatus>(
      "/userstory-statuses",
      body
    );
    return trimStatus(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface UpdateUserStoryStatusInput {
  statusId?: number;
  statusName?: string;
  name?: string;
  color?: string;
  order?: number;
  wipLimit?: number;
  isClosed?: boolean;
}

async function resolveStatusIdForUpdate(
  projectId: number,
  statusId?: number,
  statusName?: string
): Promise<number> {
  if (statusId != null) return statusId;
  if (statusName != null) {
    return resolveStatusId(projectId, "user_story", statusName);
  }
  throw new TaigaError("Provide statusId or statusName.");
}

async function getUserStoryStatusById(
  statusId: number
): Promise<TaigaUserStoryStatus> {
  try {
    const res = await getClient().get<TaigaUserStoryStatus>(
      `/userstory-statuses/${statusId}`
    );
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

async function assertUserStoryStatusInProject(
  statusId: number,
  projectId: number,
  projectSlug: string
): Promise<TaigaUserStoryStatus> {
  const status = await getUserStoryStatusById(statusId);
  assertEntityProject(
    status.project,
    projectId,
    "User story status",
    statusId,
    projectSlug
  );
  return status;
}

export async function updateUserStoryStatus(
  projectSlug: string,
  input: UpdateUserStoryStatusInput
): Promise<UserStoryStatusSummary> {
  const project = await getProjectBySlug(projectSlug);
  const id = await resolveStatusIdForUpdate(
    project.id,
    input.statusId,
    input.statusName
  );
  await assertUserStoryStatusInProject(id, project.id, projectSlug);
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name;
  if (input.color != null) body.color = input.color;
  if (input.order != null) body.order = input.order;
  if (input.wipLimit != null) body.wip_limit = input.wipLimit;
  if (input.isClosed != null) body.is_closed = input.isClosed;
  if (Object.keys(body).length === 0) {
    throw new TaigaError(
      "Provide at least one field to update (name, color, order, wipLimit, isClosed)."
    );
  }
  try {
    const res = await getClient().patch<TaigaUserStoryStatus>(
      `/userstory-statuses/${id}`,
      body
    );
    return trimStatus(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function deleteUserStoryStatus(
  projectSlug: string,
  statusId: number
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  await assertUserStoryStatusInProject(statusId, project.id, projectSlug);
  try {
    await getClient().delete(`/userstory-statuses/${statusId}`);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface StatusOrderEntry {
  statusId: number;
  order: number;
}

export async function reorderUserStoryStatuses(
  projectSlug: string,
  entries: StatusOrderEntry[]
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  for (const e of entries) {
    await assertUserStoryStatusInProject(e.statusId, project.id, projectSlug);
  }
  try {
    await getClient().post("/userstory-statuses/bulk_update_order", {
      project: project.id,
      bulk_userstory_statuses: entries.map((e) => [e.statusId, e.order])
    });
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}
