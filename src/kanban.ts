import {
  getClient,
  wrapAxiosError,
  TaigaError,
  patchWithOCC,
  paginationHeaders
} from "./http/client.js";
import { getProjectBySlug } from "./project-context.js";
import { buildStoryPatchBody } from "./patch-builders.js";
import { parsePaginationHeaders } from "./resolvers.js";
import {
  assertStoryInProject,
  getStoryById,
  getStoryByRefSlug,
  resolveStoryRef
} from "./story-resolve.js";
import { listUserStoryStatuses } from "./user-story-statuses.js";
import {
  listSwimlanesForProject,
  probeSwimlanesSupport
} from "./swimlanes.js";
import { normalizeTags } from "./trimmers.js";
import type {
  KanbanBoardSummary,
  KanbanCardSummary,
  KanbanColumnSummary,
  KanbanOrphanedCardSummary,
  StoryRefInput,
  SwimlaneSummary,
  UserStoryListItem,
  UserStoryStatusSummary
} from "./types.js";

export interface StoryOrderEntry {
  storyId?: number;
  storyRef?: number;
  projectSlug?: string;
  order: number;
}

export interface GetKanbanBoardOptions {
  includeClosed?: boolean;
  swimlaneId?: number;
}

export interface KanbanBoardInput {
  statuses: UserStoryStatusSummary[];
  stories: UserStoryListItem[];
  swimlanes: SwimlaneSummary[];
  swimlanesSupported: boolean;
  projectSlug: string;
  isKanbanActivated: boolean;
  includeClosed?: boolean;
  swimlaneId?: number;
}

/** Resolve status id from list payload (id or status_extra_info name). */
export function resolveStoryStatusId(
  story: UserStoryListItem,
  statusByName: Map<string, number>
): number | null {
  if (story.status != null) return story.status;
  const name = story.status_extra_info?.name?.trim().toLowerCase();
  if (name == null || name === "") return null;
  return statusByName.get(name) ?? null;
}

function assertStoryOrderEntry(
  entry: StoryOrderEntry,
  projectSlug: string
): void {
  if (entry.storyId == null && entry.storyRef == null) {
    throw new TaigaError(
      `Each kanban order entry requires storyId or storyRef (project ${projectSlug}).`
    );
  }
}

/** Pure grouping logic for tests and board assembly. */
export function buildKanbanBoardFromData(
  input: KanbanBoardInput
): KanbanBoardSummary {
  const swimlaneById = new Map(input.swimlanes.map((s) => [s.id, s.name]));
  const statusByName = new Map(
    input.statuses.map((s) => [s.name.trim().toLowerCase(), s.id])
  );
  let stories = input.stories;
  if (!input.includeClosed) {
    stories = stories.filter((s) => !(s.is_closed ?? false));
  }
  if (input.swimlaneId != null) {
    stories = stories.filter((s) => (s.swimlane ?? null) === input.swimlaneId);
  }

  const cardsByStatus = new Map<number, KanbanCardSummary[]>();
  const orphaned: KanbanOrphanedCardSummary[] = [];

  for (const s of stories) {
    const statusId = resolveStoryStatusId(s, statusByName);
    if (statusId == null) {
      orphaned.push({
        ref: s.ref,
        subject: s.subject,
        status_name: s.status_extra_info?.name ?? null
      });
      continue;
    }
    const card: KanbanCardSummary = {
      id: s.id,
      ref: s.ref,
      subject: s.subject,
      kanban_order: s.kanban_order ?? null,
      swimlane_id: s.swimlane ?? null,
      swimlane_name:
        s.swimlane != null ? (swimlaneById.get(s.swimlane) ?? null) : null,
      assigned_to: s.assigned_to_extra_info?.full_name_display ?? null,
      is_blocked: s.is_blocked ?? false,
      tags: normalizeTags(s.tags)
    };
    const list = cardsByStatus.get(statusId) ?? [];
    list.push(card);
    cardsByStatus.set(statusId, list);
  }

  const columns: KanbanColumnSummary[] = input.statuses.map((st) => {
    const cards = (cardsByStatus.get(st.id) ?? []).sort(
      (a, b) => (a.kanban_order ?? 0) - (b.kanban_order ?? 0)
    );
    return {
      id: st.id,
      name: st.name,
      order: st.order,
      color: st.color,
      wip_limit: st.wip_limit,
      is_closed: st.is_closed,
      cards
    };
  });

  return {
    project_slug: input.projectSlug,
    is_kanban_activated: input.isKanbanActivated,
    swimlanes_supported: input.swimlanesSupported,
    swimlanes: input.swimlanes,
    columns,
    orphaned_cards_count: orphaned.length,
    orphaned_cards: orphaned
  };
}

async function fetchKanbanStories(
  projectId: number
): Promise<UserStoryListItem[]> {
  const all: UserStoryListItem[] = [];
  let page = 1;
  const pageSize = 100;

  try {
    while (true) {
      const res = await getClient().get<UserStoryListItem[]>("/userstories", {
        params: { project: projectId, page },
        headers: paginationHeaders(page, pageSize)
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      all.push(...rows);
      const meta = parsePaginationHeaders(res, page, pageSize);
      if (!meta.paginated || page * meta.pageSize >= meta.total) break;
      page += 1;
    }
    return all;
  } catch (e) {
    throw wrapAxiosError(e);
  }
}

export async function getKanbanBoard(
  projectSlug: string,
  options: GetKanbanBoardOptions = {}
): Promise<KanbanBoardSummary> {
  const project = await getProjectBySlug(projectSlug);
  if (!project.is_kanban_activated) {
    throw new TaigaError(
      `Kanban is not activated for project "${projectSlug}". Use taiga_update_project with isKanbanActivated true.`
    );
  }

  const [statuses, stories, swimSupport] = await Promise.all([
    listUserStoryStatuses(projectSlug),
    fetchKanbanStories(project.id),
    probeSwimlanesSupport(project.id)
  ]);

  const swimlanes = swimSupport.supported
    ? await listSwimlanesForProject(project.id, swimSupport)
    : [];

  return buildKanbanBoardFromData({
    statuses,
    stories,
    swimlanes,
    swimlanesSupported: swimSupport.supported,
    projectSlug,
    isKanbanActivated: true,
    includeClosed: options.includeClosed,
    swimlaneId: options.swimlaneId
  });
}

export async function updateStoryKanbanOrder(
  projectSlug: string,
  entries: StoryOrderEntry[]
): Promise<void> {
  const project = await getProjectBySlug(projectSlug);
  const bulk_stories: { us_id: number; order: number }[] = [];
  for (const e of entries) {
    assertStoryOrderEntry(e, projectSlug);
    const story = e.storyId
      ? await getStoryById(e.storyId)
      : await getStoryByRefSlug(e.projectSlug ?? projectSlug, e.storyRef!);
    await assertStoryInProject(story, project.id, projectSlug);
    bulk_stories.push({ us_id: story.id, order: e.order });
  }
  try {
    await getClient().post("/userstories/bulk_update_kanban_order", {
      project_id: project.id,
      bulk_stories
    });
  } catch (err) {
    throw wrapAxiosError(err, { projectSlug });
  }
}

export interface MoveStoryOnKanbanInput extends StoryRefInput {
  projectSlug: string;
  statusName?: string;
  statusId?: number;
  swimlaneId?: number;
  swimlaneName?: string;
  kanbanOrder?: number;
}

export async function moveStoryOnKanban(
  input: MoveStoryOnKanbanInput
): Promise<{
  id: number;
  ref: number;
  status: string | null;
  kanban_order: number | null;
  swimlane_id: number | null;
}> {
  const hasPatch =
    input.statusName != null ||
    input.statusId != null ||
    input.swimlaneId != null ||
    input.swimlaneName != null;
  if (!hasPatch && input.kanbanOrder == null) {
    throw new TaigaError(
      "Provide at least one of statusName, statusId, swimlaneId, swimlaneName, or kanbanOrder."
    );
  }

  if (hasPatch) {
    const story = await resolveStoryRef(input);
    const project = await getProjectBySlug(input.projectSlug);
    await assertStoryInProject(story, project.id, input.projectSlug);
    const patchBody = await buildStoryPatchBody(project.id, {
      statusName: input.statusName,
      statusId: input.statusId,
      swimlaneId: input.swimlaneId,
      swimlaneName: input.swimlaneName
    });
    await patchWithOCC(
      () => getStoryById(story.id),
      (current) =>
        getClient().patch(`/userstories/${story.id}`, {
          version: current.version,
          ...patchBody
        })
    );
  }

  if (input.kanbanOrder != null) {
    await updateStoryKanbanOrder(input.projectSlug, [
      {
        storyId: input.storyId,
        storyRef: input.storyRef,
        projectSlug: input.projectSlug,
        order: input.kanbanOrder
      }
    ]);
  }

  const story = await resolveStoryRef(input);

  return {
    id: story.id,
    ref: story.ref,
    status: story.status_extra_info?.name ?? null,
    kanban_order: story.kanban_order ?? null,
    swimlane_id: story.swimlane ?? null
  };
}
