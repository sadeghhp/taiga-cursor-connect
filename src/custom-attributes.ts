import { getClient, wrapAxiosError, TaigaError } from "./http/client.js";
import {
  resolveEpic,
  resolveIssue,
  resolveStory,
  resolveTask
} from "./taiga-client.js";
import type {
  CustomAttributeDefSummary,
  CustomAttributeEntityType,
  EpicRefInput,
  IssueRefInput,
  StoryRefInput,
  TaskRefInput,
  TaigaProject
} from "./types.js";

const CUSTOM_ATTR_PATH: Record<CustomAttributeEntityType, string> = {
  user_story: "/userstory-custom-attributes",
  task: "/task-custom-attributes",
  issue: "/issue-custom-attributes",
  epic: "/epic-custom-attributes"
};

const CUSTOM_ATTR_VALUES_PATH: Record<CustomAttributeEntityType, string> = {
  user_story: "/userstory-custom-attributes-values",
  task: "/task-custom-attributes-values",
  issue: "/issue-custom-attributes-values",
  epic: "/epic-custom-attributes-values"
};

const ENTITY_PARAM: Record<CustomAttributeEntityType, string> = {
  user_story: "user_story",
  task: "task",
  issue: "issue",
  epic: "epic"
};

const PATCH_PATH: Record<CustomAttributeEntityType, (id: number) => string> = {
  user_story: (id) => `/userstories/${id}`,
  task: (id) => `/tasks/${id}`,
  issue: (id) => `/issues/${id}`,
  epic: (id) => `/epics/${id}`
};

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

export async function listCustomAttributes(
  projectSlug: string,
  entityType: CustomAttributeEntityType
): Promise<CustomAttributeDefSummary[]> {
  const project = await getProjectBySlug(projectSlug);
  try {
    const res = await getClient().get<
      Array<{ id: number; name: string; type: string; description?: string }>
    >(CUSTOM_ATTR_PATH[entityType], { params: { project: project.id } });
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description ?? null
    }));
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, entityType });
  }
}

async function resolveEntityId(
  entityType: CustomAttributeEntityType,
  projectSlug: string,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput
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
    default:
      throw new TaigaError(`Unknown entity type: ${entityType}`);
  }
}

export async function getCustomAttributeValues(
  projectSlug: string,
  entityType: CustomAttributeEntityType,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput
): Promise<Record<string, unknown>> {
  const entityId = await resolveEntityId(entityType, projectSlug, refs);
  try {
    const res = await getClient().get<Array<{ id: number; attributes_values: Record<string, unknown> }>>(
      CUSTOM_ATTR_VALUES_PATH[entityType],
      { params: { [ENTITY_PARAM[entityType]]: entityId } }
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) return {};
    return rows[0].attributes_values ?? {};
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, entityType });
  }
}

export async function setCustomAttributeValues(
  projectSlug: string,
  entityType: CustomAttributeEntityType,
  refs: StoryRefInput & TaskRefInput & IssueRefInput & EpicRefInput,
  values: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const entityId = await resolveEntityId(entityType, projectSlug, refs);
  const path = PATCH_PATH[entityType](entityId);
  try {
    const current = await getClient().get<{ version: number }>(path);
    const version = current.data.version;
    const res = await getClient().patch<{ attributes_values?: Record<string, unknown> }>(
      path,
      { version, attributes_values: values }
    );
    return res.data.attributes_values ?? values;
  } catch (e) {
    throw wrapAxiosError(e, { projectSlug, entityType });
  }
}
