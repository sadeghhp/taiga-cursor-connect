import { getClient, wrapAxiosError } from "./http/client.js";
import type {
  ProjectCreateSummary,
  ProjectDetailSummary,
  ProjectTemplateSummary,
  TaigaProject
} from "./types.js";

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

export function trimProjectModules(p: TaigaProject): ProjectCreateSummary {
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
    is_private: p.is_private ?? false
  };
}

export async function listProjectTemplates(): Promise<ProjectTemplateSummary[]> {
  try {
    const res = await getClient().get<
      Array<{
        id: number;
        name: string;
        slug: string;
        description?: string;
        is_epics_activated?: boolean;
        is_issues_activated?: boolean;
        is_wiki_activated?: boolean;
      }>
    >("/project-templates");
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description ?? null,
      is_epics_activated: t.is_epics_activated ?? false,
      is_issues_activated: t.is_issues_activated ?? false,
      is_wiki_activated: t.is_wiki_activated ?? false
    }));
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export interface CreateProjectInput {
  name: string;
  description: string;
  templateId?: number;
  isPrivate?: boolean;
  isEpicsActivated?: boolean;
  isIssuesActivated?: boolean;
  isWikiActivated?: boolean;
  isKanbanActivated?: boolean;
  isBacklogActivated?: boolean;
}

export async function createProject(
  input: CreateProjectInput
): Promise<ProjectCreateSummary> {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description
  };
  if (input.templateId != null) body.creation_template = input.templateId;
  if (input.isPrivate != null) body.is_private = input.isPrivate;
  if (input.isEpicsActivated != null) body.is_epics_activated = input.isEpicsActivated;
  if (input.isIssuesActivated != null) body.is_issues_activated = input.isIssuesActivated;
  if (input.isWikiActivated != null) body.is_wiki_activated = input.isWikiActivated;
  if (input.isKanbanActivated != null) body.is_kanban_activated = input.isKanbanActivated;
  if (input.isBacklogActivated != null) body.is_backlog_activated = input.isBacklogActivated;
  try {
    const res = await getClient().post<TaigaProject>("/projects", body);
    return trimProjectModules(res.data);
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  isEpicsActivated?: boolean;
  isIssuesActivated?: boolean;
  isWikiActivated?: boolean;
  isKanbanActivated?: boolean;
  isBacklogActivated?: boolean;
  isPrivate?: boolean;
}

export async function updateProject(
  projectSlug: string,
  input: UpdateProjectInput
): Promise<ProjectCreateSummary> {
  const project = await getProjectBySlug(projectSlug);
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name;
  if (input.description != null) body.description = input.description;
  if (input.isEpicsActivated != null) body.is_epics_activated = input.isEpicsActivated;
  if (input.isIssuesActivated != null) body.is_issues_activated = input.isIssuesActivated;
  if (input.isWikiActivated != null) body.is_wiki_activated = input.isWikiActivated;
  if (input.isKanbanActivated != null) body.is_kanban_activated = input.isKanbanActivated;
  if (input.isBacklogActivated != null) body.is_backlog_activated = input.isBacklogActivated;
  if (input.isPrivate != null) body.is_private = input.isPrivate;
  try {
    const res = await getClient().patch<TaigaProject>(`/projects/${project.id}`, body);
    return trimProjectModules(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface DuplicateProjectInput {
  name: string;
  description: string;
  isPrivate?: boolean;
}

export async function duplicateProject(
  projectSlug: string,
  input: DuplicateProjectInput
): Promise<ProjectCreateSummary> {
  const project = await getProjectBySlug(projectSlug);
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description
  };
  if (input.isPrivate != null) body.is_private = input.isPrivate;
  try {
    const res = await getClient().post<TaigaProject>(
      `/projects/${project.id}/duplicate`,
      body
    );
    return trimProjectModules(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function deleteProject(projectSlug: string): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  try {
    await getClient().delete(`/projects/${project.id}`);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export function trimProjectDetailExtended(p: TaigaProject): ProjectDetailSummary {
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
