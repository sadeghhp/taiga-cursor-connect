import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import type { TaigaProject, WikiPageSummary } from "./types.js";

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

async function assertWikiEnabled(project: TaigaProject, projectSlug: string): Promise<void> {
  if (!project.is_wiki_activated) {
    throw new TaigaError(
      `Wiki module is not enabled on project "${projectSlug}". Enable via taiga_update_project.`,
      undefined,
      { projectSlug }
    );
  }
}

function trimWikiPage(w: {
  id: number;
  slug: string;
  subject: string;
  content?: string;
  version?: number;
}): WikiPageSummary {
  return {
    id: w.id,
    slug: w.slug,
    subject: w.subject,
    content: w.content ?? null,
    version: w.version ?? null
  };
}

export async function listWikiPages(projectSlug: string): Promise<WikiPageSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  await assertWikiEnabled(project, projectSlug);
  try {
    const res = await getClient().get<
      Array<{ id: number; slug: string; subject: string }>
    >("/wiki", { params: { project: project.id } });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((w) => trimWikiPage(w));
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function getWikiPage(
  projectSlug: string,
  wikiSlug: string
): Promise<WikiPageSummary> {
  const project = await getProjectBySlug(projectSlug);
  await assertWikiEnabled(project, projectSlug);
  try {
    const res = await getClient().get<{
      id: number;
      slug: string;
      subject: string;
      content?: string;
      version?: number;
    }>("/wiki/by_slug", {
      params: { slug: wikiSlug, project: project.id }
    });
    return trimWikiPage(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, wikiSlug });
  }
}

export async function createWikiPage(
  projectSlug: string,
  subject: string,
  content?: string
): Promise<WikiPageSummary> {
  const project = await getProjectBySlug(projectSlug);
  await assertWikiEnabled(project, projectSlug);
  try {
    const res = await getClient().post<{
      id: number;
      slug: string;
      subject: string;
      content?: string;
      version?: number;
    }>("/wiki", {
      project: project.id,
      subject,
      ...(content != null ? { content } : {})
    });
    return trimWikiPage(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export async function updateWikiPage(
  projectSlug: string,
  wikiSlug: string,
  fields: { subject?: string; content?: string }
): Promise<WikiPageSummary> {
  const page = await getWikiPage(projectSlug, wikiSlug);
  const body: Record<string, unknown> = { version: page.version };
  if (fields.subject != null) body.subject = fields.subject;
  if (fields.content != null) body.content = fields.content;
  try {
    const res = await getClient().patch<{
      id: number;
      slug: string;
      subject: string;
      content?: string;
      version?: number;
    }>(`/wiki/${page.id}`, body);
    return trimWikiPage(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, wikiSlug });
  }
}

export async function deleteWikiPage(
  projectSlug: string,
  wikiSlug: string
): Promise<void> {
  const page = await getWikiPage(projectSlug, wikiSlug);
  try {
    await getClient().delete(`/wiki/${page.id}`);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, wikiSlug });
  }
}
