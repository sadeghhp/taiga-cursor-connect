import type {
  EpicDetailSummary,
  EpicListSummary,
  EpicSummary,
  HistoryEntrySummary,
  IssueListSummary,
  IssueSummary,
  SearchResultSummary,
  StorySummary,
  TaigaEpic,
  TaigaHistoryEntry,
  TaigaIssue,
  TaigaPoint,
  TaigaSearchResults,
  TaigaTask,
  TaigaUserStory,
  TaskSummary
} from "./types.js";

const HISTORY_CAP = 50;

export function normalizeTags(
  tags?: Array<string | [string, string | null]>
): string[] {
  if (!tags?.length) return [];
  return tags.map((t) => (Array.isArray(t) ? t[0] : t));
}

function trimTask(task: TaigaTask): TaskSummary {
  return {
    id: task.id,
    ref: task.ref,
    subject: task.subject,
    description: task.description ?? null,
    status: task.status_extra_info?.name ?? null,
    assigned_to: task.assigned_to_extra_info?.full_name_display ?? null,
    is_closed: task.is_closed,
    version: task.version,
    blocked_note: task.blocked_note ?? null,
    tags: task.tags ?? []
  };
}

function trimEpics(story: TaigaUserStory): EpicSummary[] {
  return (story.epics ?? []).map((e) => ({
    id: e.id,
    ref: e.ref,
    subject: e.subject
  }));
}

function historyTimestamp(entry: TaigaHistoryEntry): number {
  const raw = entry.created_at;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

export function trimHistory(entries: TaigaHistoryEntry[]): HistoryEntrySummary[] {
  const candidates: { ts: number; entry: HistoryEntrySummary }[] = [];
  for (const raw of entries) {
    const comment = raw.comment?.trim();
    const diff = raw.values_diff ?? raw.diff;
    const hasDiff =
      diff != null &&
      typeof diff === "object" &&
      Object.keys(diff as object).length > 0;
    if (!comment && !hasDiff) continue;

    candidates.push({
      ts: historyTimestamp(raw),
      entry: {
        id: raw.id,
        type: raw.type,
        created_at: raw.created_at ?? null,
        user: raw.user?.name ?? raw.user?.username ?? null,
        comment: comment || null,
        changes: hasDiff ? (diff as Record<string, unknown>) : null
      }
    });
  }
  candidates.sort((a, b) => b.ts - a.ts);
  return candidates.slice(0, HISTORY_CAP).map((c) => c.entry);
}

/** Taiga story.points is { roleId: pointDefinitionId }. */
export function resolvePointsByRole(
  points: Record<string, number> | undefined,
  defs: TaigaPoint[],
  roles?: Array<{ id: number; name: string }>
): Record<string, number> | null {
  if (!points || Object.keys(points).length === 0) return null;
  const pointById = new Map(defs.map((p) => [String(p.id), p]));
  const roleById = new Map((roles ?? []).map((r) => [String(r.id), r.name]));
  const out: Record<string, number> = {};
  for (const [roleId, pointId] of Object.entries(points)) {
    const def = pointById.get(String(pointId));
    const roleLabel = roleById.get(roleId) ?? `role_${roleId}`;
    out[roleLabel] = def?.value ?? pointId;
  }
  return out;
}

export function trimIssueDetail(issue: TaigaIssue): IssueSummary {
  return {
    id: issue.id,
    ref: issue.ref,
    subject: issue.subject,
    description: issue.description ?? null,
    status: issue.status_extra_info?.name ?? null,
    assigned_to: issue.assigned_to_extra_info?.full_name_display ?? null,
    milestone: issue.milestone_slug ?? issue.milestone_name ?? null,
    version: issue.version,
    tags: normalizeTags(issue.tags),
    is_blocked: issue.is_blocked ?? false,
    blocked_note: issue.blocked_note ?? null,
    is_closed:
      issue.is_closed ?? issue.status_extra_info?.is_closed ?? false,
    priority: issue.priority ?? null,
    severity: issue.severity ?? null
  };
}

export function trimEpicDetail(epic: TaigaEpic): EpicDetailSummary {
  return {
    id: epic.id,
    ref: epic.ref,
    subject: epic.subject,
    description: epic.description ?? null,
    status: epic.status_extra_info?.name ?? null,
    assigned_to: epic.assigned_to_extra_info?.full_name_display ?? null,
    is_closed: epic.is_closed ?? epic.status_extra_info?.is_closed ?? false,
    version: epic.version,
    tags: normalizeTags(epic.tags)
  };
}

export function trimEpicListItem(epic: TaigaEpic): EpicListSummary {
  return {
    id: epic.id,
    ref: epic.ref,
    subject: epic.subject,
    status: epic.status_extra_info?.name ?? null,
    is_closed: epic.is_closed ?? epic.status_extra_info?.is_closed ?? false
  };
}

export function trimStoryWithTasks(
  story: TaigaUserStory,
  tasks: TaigaTask[],
  history?: HistoryEntrySummary[],
  pointsByRole?: Record<string, number> | null
): StorySummary {
  const summary: StorySummary = {
    id: story.id,
    ref: story.ref,
    subject: story.subject,
    description: story.description,
    status: story.status_extra_info?.name ?? null,
    assigned_to: story.assigned_to_extra_info?.full_name_display ?? null,
    milestone: story.milestone_slug ?? story.milestone_name ?? null,
    version: story.version,
    tags: normalizeTags(story.tags),
    points: story.points ?? null,
    points_by_role: pointsByRole ?? null,
    is_blocked: story.is_blocked ?? false,
    blocked_note: story.blocked_note ?? null,
    due_date: story.due_date ?? null,
    total_comments: story.total_comments ?? null,
    epics: trimEpics(story),
    is_closed:
      story.is_closed ?? story.status_extra_info?.is_closed ?? false,
    kanban_order: story.kanban_order ?? null,
    swimlane_id: story.swimlane ?? null,
    tasks: tasks.map(trimTask)
  };
  if (history != null) summary.history = history;
  return summary;
}

export function trimTaskDetail(
  task: TaigaTask
): TaskSummary & { user_story: number | null } {
  return {
    ...trimTask(task),
    user_story: task.user_story ?? null
  };
}

export function trimSearchResults(data: TaigaSearchResults): SearchResultSummary[] {
  const out: SearchResultSummary[] = [];
  for (const us of data.user_stories ?? []) {
    out.push({ type: "user_story", id: us.id, ref: us.ref, subject: us.subject });
  }
  for (const t of data.tasks ?? []) {
    out.push({ type: "task", id: t.id, ref: t.ref, subject: t.subject });
  }
  for (const e of data.epics ?? []) {
    out.push({ type: "epic", id: e.id, ref: e.ref, subject: e.subject });
  }
  for (const i of data.issues ?? []) {
    out.push({ type: "issue", id: i.id, ref: i.ref, subject: i.subject });
  }
  return out;
}
