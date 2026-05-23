import { getClient, wrapAxiosError } from "./http/client.js";
import { resolveProjectListItem } from "./resolvers.js";
import type { IdNameSummary, MilestoneSummary, TaigaMilestone, TaigaProject } from "./types.js";

async function getProjectBySlug(slug: string): Promise<TaigaProject> {
  try {
    const res = await getClient().get<TaigaProject>("/projects/by_slug", {
      params: { slug }
    });
    return res.data;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug: slug });
  }
}

function trimMilestone(m: TaigaMilestone): MilestoneSummary {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    closed: m.closed ?? false,
    estimated_start: m.estimated_start ?? null,
    estimated_finish: m.estimated_finish ?? null
  };
}

export async function getMilestone(
  projectSlug: string,
  milestoneSlug: string
): Promise<MilestoneSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<TaigaMilestone[]>("/milestones", {
      params: { project: project.id }
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    const normalized = milestoneSlug.trim().toLowerCase();
    const matches = rows.filter(
      (m) =>
        m.slug.trim().toLowerCase() === normalized ||
        m.name.trim().toLowerCase() === normalized
    );
    if (matches.length === 0) {
      throw wrapAxiosError(
        new Error(`No milestone named or slugged "${milestoneSlug}" in project ${projectSlug}.`),
        { projectSlug, milestoneSlug }
      );
    }
    return trimMilestone(matches[0]);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, milestoneSlug });
  }
}

export async function getMilestoneById(milestoneId: number): Promise<MilestoneSummary> {
  try {
    const res = await getClient().get<TaigaMilestone>(`/milestones/${milestoneId}`);
    return trimMilestone(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { milestoneId });
  }
}

async function listProjectScoped(
  projectSlug: string,
  path: string
): Promise<IdNameSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<Array<{ id: number; name: string }>>(path, {
      params: { project: project.id }
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((r) => ({ id: r.id, name: r.name }));
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function listIssueTypes(projectSlug: string): Promise<IdNameSummary[]> {
  return listProjectScoped(projectSlug, "/issue-types");
}

export async function listPriorities(projectSlug: string): Promise<IdNameSummary[]> {
  return listProjectScoped(projectSlug, "/priorities");
}

export async function listSeverities(projectSlug: string): Promise<IdNameSummary[]> {
  return listProjectScoped(projectSlug, "/severities");
}

export async function listRoles(projectSlug: string): Promise<IdNameSummary[]> {
  return listProjectScoped(projectSlug, "/roles");
}

export async function resolveIssueTypeId(
  projectId: number,
  name: string
): Promise<number> {
  return resolveProjectListItem(projectId, "/issue-types", name, "issue type");
}

export async function resolvePriorityId(
  projectId: number,
  name: string
): Promise<number> {
  return resolveProjectListItem(projectId, "/priorities", name, "priority");
}

export async function resolveSeverityId(
  projectId: number,
  name: string
): Promise<number> {
  return resolveProjectListItem(projectId, "/severities", name, "severity");
}

export async function resolveRoleId(
  projectId: number,
  name: string
): Promise<number> {
  return resolveProjectListItem(projectId, "/roles", name, "role");
}

export interface IssueMetadataFields {
  typeId?: number;
  typeName?: string;
  priorityId?: number;
  priorityName?: string;
  severityId?: number;
  severityName?: string;
}

export async function applyIssueMetadataToBody(
  body: Record<string, unknown>,
  projectId: number,
  fields: IssueMetadataFields
): Promise<void> {
  if (fields.typeId != null) body.type = fields.typeId;
  else if (fields.typeName != null) {
    body.type = await resolveIssueTypeId(projectId, fields.typeName);
  }
  if (fields.priorityId != null) body.priority = fields.priorityId;
  else if (fields.priorityName != null) {
    body.priority = await resolvePriorityId(projectId, fields.priorityName);
  }
  if (fields.severityId != null) body.severity = fields.severityId;
  else if (fields.severityName != null) {
    body.severity = await resolveSeverityId(projectId, fields.severityName);
  }
}

export function hasIssueMetadataFields(fields: IssueMetadataFields): boolean {
  return (
    fields.typeId != null ||
    fields.typeName != null ||
    fields.priorityId != null ||
    fields.priorityName != null ||
    fields.severityId != null ||
    fields.severityName != null
  );
}
