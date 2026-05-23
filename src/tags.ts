import { getClient, wrapAxiosError } from "./http/client.js";
import { getProjectBySlug } from "./project-context.js";
import type { ProjectStatsSummary, TagColorSummary } from "./types.js";

export async function listProjectTags(projectSlug: string): Promise<TagColorSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<Record<string, string | null>>(
      `/projects/${project.id}/tags_colors`
    );
    const data = res.data ?? {};
    return Object.entries(data).map(([tag, color]) => ({ tag, color: color ?? null }));
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function createProjectTag(
  projectSlug: string,
  tag: string,
  color?: string
): Promise<TagColorSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    await getClient().post(`/projects/${project.id}/create_tag`, {
      tag,
      ...(color != null ? { color } : {})
    });
    return { tag, color: color ?? null };
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function editProjectTag(
  projectSlug: string,
  fromTag: string,
  toTag: string,
  color?: string
): Promise<TagColorSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    await getClient().post(`/projects/${project.id}/edit_tag`, {
      from_tag: fromTag,
      to_tag: toTag,
      ...(color != null ? { color } : {})
    });
    return { tag: toTag, color: color ?? null };
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function deleteProjectTag(
  projectSlug: string,
  tag: string
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  try {
    await getClient().post(`/projects/${project.id}/delete_tag`, { tag });
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function getProjectStats(
  projectSlug: string
): Promise<ProjectStatsSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<Record<string, unknown>>(
      `/projects/${project.id}/stats`
    );
    const d = res.data ?? {};
    return {
      assigned_points: Number(d.assigned_points ?? 0),
      closed_points: Number(d.closed_points ?? 0),
      defined_points: Number(d.defined_points ?? 0),
      milestone_count: Array.isArray(d.milestones) ? d.milestones.length : 0
    };
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function getProjectIssueStats(
  projectSlug: string
): Promise<Record<string, unknown>> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<Record<string, unknown>>(
      `/projects/${project.id}/issues_stats`
    );
    return res.data ?? {};
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}
