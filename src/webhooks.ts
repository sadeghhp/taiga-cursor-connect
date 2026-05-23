import { getClient, wrapAxiosError } from "./http/client.js";
import type { TaigaProject, WebhookSummary } from "./types.js";

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

function trimWebhook(w: {
  id: number;
  name: string;
  url: string;
  key?: string;
  project: number;
  active?: boolean;
}): WebhookSummary {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    active: w.active ?? true,
    project: w.project
  };
}

export async function listWebhooks(projectSlug: string): Promise<WebhookSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<
      Array<{ id: number; name: string; url: string; key?: string; project: number; active?: boolean }>
    >("/webhooks", { params: { project: project.id } });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(trimWebhook);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  key?: string;
}

export async function createWebhook(
  projectSlug: string,
  input: CreateWebhookInput
): Promise<WebhookSummary> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().post<{
      id: number;
      name: string;
      url: string;
      key?: string;
      project: number;
      active?: boolean;
    }>("/webhooks", {
      project: project.id,
      name: input.name,
      url: input.url,
      ...(input.key != null ? { key: input.key } : {})
    });
    return trimWebhook(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug });
  }
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  key?: string;
  active?: boolean;
}

export async function updateWebhook(
  webhookId: number,
  input: UpdateWebhookInput
): Promise<WebhookSummary> {
  const body: Record<string, unknown> = {};
  if (input.name != null) body.name = input.name;
  if (input.url != null) body.url = input.url;
  if (input.key != null) body.key = input.key;
  if (input.active != null) body.active = input.active;
  try {
    const res = await getClient().patch<{
      id: number;
      name: string;
      url: string;
      key?: string;
      project: number;
      active?: boolean;
    }>(`/webhooks/${webhookId}`, body);
    return trimWebhook(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { webhookId });
  }
}

export async function deleteWebhook(webhookId: number): Promise<void> {
  try {
    await getClient().delete(`/webhooks/${webhookId}`);
  } catch (e) {
    throw wrapAxiosError(e, { webhookId });
  }
}

export async function testWebhook(webhookId: number): Promise<{ ok: boolean; detail?: string }> {
  try {
    await getClient().post(`/webhooks/${webhookId}/test`, {});
    return { ok: true };
  } catch (e) {
    const wrapped = wrapAxiosError(e, { webhookId });
    return { ok: false, detail: wrapped.message };
  }
}
