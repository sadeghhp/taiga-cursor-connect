import type { AxiosResponse } from "axios";
import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import type {
  ListQuery,
  PaginatedResult,
  TaigaMilestone,
  TaigaStatus
} from "./types.js";

export type StatusEntityType = "user_story" | "task" | "issue" | "epic";

const STATUS_LIST_PATH: Record<StatusEntityType, string> = {
  user_story: "/userstory-statuses",
  task: "/task-statuses",
  issue: "/issue-statuses",
  epic: "/epic-statuses"
};

export async function resolveStatusId(
  projectId: number,
  entityType: StatusEntityType,
  statusName: string
): Promise<number> {
  const path = STATUS_LIST_PATH[entityType];
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

export async function resolveMilestoneByRef(
  projectId: number,
  projectSlug: string,
  milestoneSlug: string
): Promise<TaigaMilestone> {
  const id = await resolveMilestoneId(projectId, milestoneSlug);
  if (id == null) {
    throw new TaigaError(
      `No milestone "${milestoneSlug}" in project ${projectSlug}.`
    );
  }
  try {
    const res = await getClient().get<TaigaMilestone>(`/milestones/${id}`);
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, milestoneSlug });
  }
}

export async function buildListParams(
  projectId: number,
  query: ListQuery,
  entityType: StatusEntityType
): Promise<Record<string, string | number>> {
  const params: Record<string, string | number> = { project: projectId };
  if (query.milestoneId != null) params.milestone = query.milestoneId;
  if (query.epicId != null && entityType === "user_story") params.epic = query.epicId;
  if (query.userStoryId != null && entityType === "task") {
    params.user_story = query.userStoryId;
  }
  if (query.tags != null && query.tags.length > 0) {
    params.tags = query.tags.join(",");
  }
  if (query.statusName != null) {
    params.status = await resolveStatusId(projectId, entityType, query.statusName);
  }
  if (query.page != null) params.page = query.page;
  return params;
}

export function parsePaginationHeaders(
  res: AxiosResponse<unknown>,
  page?: number,
  pageSize?: number
): Omit<PaginatedResult<unknown>, "items"> {
  const h = res.headers as Record<string, string | undefined>;
  return {
    page: page ?? Number(h["x-pagination-current"] ?? 1),
    pageSize: pageSize ?? Number(h["x-paginated-by"] ?? 0),
    total: Number(h["x-pagination-count"] ?? 0),
    paginated: h["x-paginated"] === "True" || h["x-paginated"] === "true"
  };
}

export async function resolveProjectListItem(
  projectId: number,
  path: string,
  name: string,
  label: string
): Promise<number> {
  try {
    const res = await getClient().get<Array<{ id: number; name: string }>>(path, {
      params: { project: projectId }
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    const normalized = name.trim().toLowerCase();
    const matches = rows.filter((s) => s.name.trim().toLowerCase() === normalized);
    if (matches.length === 0) {
      throw new TaigaError(`No ${label} named "${name}" in project ${projectId}.`);
    }
    if (matches.length > 1) {
      throw new TaigaError(
        `Ambiguous ${label} name "${name}" (${matches.length} matches).`
      );
    }
    return matches[0].id;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}
