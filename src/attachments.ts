import { openAsBlob } from "node:fs";
import { basename } from "node:path";
import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import {
  getProjectBySlug,
  resolveEpic,
  resolveIssue,
  resolveStory,
  resolveTask
} from "./taiga-client.js";
import type {
  AttachmentEntityType,
  AttachmentSummary,
  EpicRefInput,
  IssueRefInput,
  StoryRefInput,
  TaskRefInput
} from "./types.js";

const ATTACHMENT_PATH: Record<AttachmentEntityType, string> = {
  user_story: "/userstories/attachments",
  task: "/tasks/attachments",
  issue: "/issues/attachments",
  epic: "/epics/attachments",
  wiki: "/wiki/attachments"
};

async function resolveObjectId(
  entityType: AttachmentEntityType,
  projectSlug: string,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput & { wikiId?: number }
): Promise<number> {
  switch (entityType) {
    case "user_story":
      return (await resolveStory({ projectSlug, ...refs })).id;
    case "task":
      return (await resolveTask({ projectSlug, ...refs })).id;
    case "issue":
      return (await resolveIssue({ projectSlug, ...refs })).id;
    case "epic":
      return (await resolveEpic({ projectSlug, ...refs })).id;
    case "wiki":
      if (refs.wikiId == null) {
        throw new TaigaError("wikiId is required for wiki attachments.");
      }
      return refs.wikiId;
    default:
      throw new TaigaError(`Unknown attachment entity type: ${entityType}`);
  }
}

function trimAttachment(a: {
  id: number;
  name?: string;
  size?: number;
  url?: string;
  attached_file?: string;
}): AttachmentSummary {
  return {
    id: a.id,
    name: a.name ?? a.attached_file ?? null,
    size: a.size ?? null,
    url: a.url ?? null
  };
}

export async function listAttachments(
  projectSlug: string,
  entityType: AttachmentEntityType,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput & { wikiId?: number }
): Promise<AttachmentSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  const objectId = await resolveObjectId(entityType, projectSlug, refs);
  try {
    const res = await getClient().get<
      Array<{ id: number; name?: string; size?: number; url?: string; attached_file?: string }>
    >(ATTACHMENT_PATH[entityType], {
      params: { project: project.id, object_id: objectId }
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map(trimAttachment);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, entityType });
  }
}

export async function uploadAttachment(
  projectSlug: string,
  entityType: AttachmentEntityType,
  filePath: string,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput & { wikiId?: number }
): Promise<AttachmentSummary> {
  const project = await getProjectBySlug(projectSlug);
  const objectId = await resolveObjectId(entityType, projectSlug, refs);
  const blob = await openAsBlob(filePath);
  const form = new FormData();
  form.append("project", String(project.id));
  form.append("object_id", String(objectId));
  form.append("attached_file", blob, basename(filePath));
  try {
    const client = getClient();
    const res = await client.post<{
      id: number;
      name?: string;
      size?: number;
      url?: string;
      attached_file?: string;
    }>(ATTACHMENT_PATH[entityType], form, {
      headers: {
        Authorization: client.defaults.headers.common.Authorization as string
      }
    });
    return trimAttachment(res.data);
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, entityType, filePath });
  }
}

export async function deleteAttachment(
  entityType: AttachmentEntityType,
  attachmentId: number
): Promise<void> {
  try {
    await getClient().delete(`${ATTACHMENT_PATH[entityType]}/${attachmentId}`);
  } catch (e) {
    throw wrapAxiosError(e, { entityType, attachmentId });
  }
}
