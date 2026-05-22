import { readFile } from "node:fs/promises";
import {
  createTask,
  createUserStory,
  getStoryById,
  getStoryByRefSlug,
  getTaskByRefSlug,
  searchProject,
  updateTask,
  type CreateOptionalFields
} from "./taiga-client.js";
import { TaigaError } from "./http/client.js";

export interface PlanCsvRow {
  thread_id: string;
  hierarchy_id: string;
  title: string;
  subphase: string;
  module: string;
  estimate_h: string;
  blocked_by: string;
  gate: string;
  ac_ids: string;
  taiga_story_ref: string;
  taiga_task_ref: string;
  status: string;
}

export interface BulkSyncOptions {
  projectSlug: string;
  csvPath: string;
  dryRun?: boolean;
  delayMs?: number;
  milestoneSlugMap?: Record<string, string>;
}

export interface BulkSyncRowResult {
  thread_id: string;
  story_ref: number | null;
  task_ref: number | null;
  story_id: number | null;
  task_id: number | null;
  action: "created" | "skipped" | "dry_run" | "error";
  error?: string;
}

export interface BulkSyncResult {
  rows: BulkSyncRowResult[];
  csv_patch: string;
  blocking_errors?: string[];
}

const THREAD_MARKER = (id: string) => `<!-- thread:${id} -->`;

/** Parse a Taiga ref column from CSV (positive integer only). */
export function parseTaigaRef(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parsePlanCsv(content: string): PlanCsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: PlanCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    if (!row.thread_id?.trim()) continue;
    rows.push(row as unknown as PlanCsvRow);
  }
  return rows;
}

function buildTags(row: PlanCsvRow): string[] {
  const tags: string[] = [];
  if (row.module) tags.push(`module:${row.module}`);
  if (row.subphase) tags.push(`subphase:${row.subphase}`);
  if (row.gate) tags.push(`gate:${row.gate}`);
  if (row.thread_id) tags.push(`thread:${row.thread_id}`);
  return tags;
}

function storySubject(row: PlanCsvRow): string {
  return `${row.thread_id} — ${row.title}`;
}

function taskSubject(row: PlanCsvRow): string {
  return `${row.thread_id} — ${row.title}`;
}

function descriptionWithMarker(row: PlanCsvRow): string {
  return `${row.title}\n\n${THREAD_MARKER(row.thread_id)}`;
}

function storyCreateOpts(
  row: PlanCsvRow,
  milestoneSlugMap?: Record<string, string>
): CreateOptionalFields {
  const createOpts: CreateOptionalFields = {
    tags: buildTags(row),
    milestoneSlug: milestoneSlugMap?.[row.subphase]
  };
  const est = Number(row.estimate_h);
  if (!Number.isNaN(est) && est > 0) {
    createOpts.estimateHours = est;
  }
  return createOpts;
}

function taskCreateOpts(
  storyOpts: CreateOptionalFields
): Pick<CreateOptionalFields, "tags" | "milestoneSlug" | "milestoneId"> {
  return {
    tags: storyOpts.tags,
    milestoneSlug: storyOpts.milestoneSlug,
    milestoneId: storyOpts.milestoneId
  };
}

async function findExistingByThread(
  projectSlug: string,
  threadId: string
): Promise<{ storyRef?: number; taskRef?: number } | null> {
  const hits = await searchProject(projectSlug, threadId);
  const story = hits.find((h) => h.type === "user_story");
  const task = hits.find((h) => h.type === "task");
  if (!story && !task) return null;
  return {
    storyRef: story?.ref,
    taskRef: task?.ref
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function registerThreadRefs(
  map: Map<string, { storyRef: number; taskRef: number }>,
  threadId: string,
  storyRef: number,
  taskRef: number
): void {
  map.set(threadId, { storyRef, taskRef });
}

export function resolveThreadRefs(
  threadId: string,
  threadToRefs: Map<string, { storyRef: number; taskRef: number }>,
  rowsByThread: Map<string, PlanCsvRow>,
  results: BulkSyncRowResult[]
): { storyRef: number; taskRef: number } | undefined {
  const cached = threadToRefs.get(threadId);
  if (cached) return cached;

  const row = rowsByThread.get(threadId);
  if (row) {
    const fromCsv = parseTaigaRef(row.taiga_story_ref);
    const fromCsvTask = parseTaigaRef(row.taiga_task_ref);
    if (fromCsv && fromCsvTask) {
      return { storyRef: fromCsv, taskRef: fromCsvTask };
    }
  }

  const result = results.find((r) => r.thread_id === threadId);
  if (result?.story_ref != null && result?.task_ref != null) {
    return { storyRef: result.story_ref, taskRef: result.task_ref };
  }

  return undefined;
}

export async function bulkSyncTasksCsv(
  options: BulkSyncOptions
): Promise<BulkSyncResult> {
  const content = await readFile(options.csvPath, "utf-8");
  const parsed = parsePlanCsv(content);
  const sorted = [...parsed].sort((a, b) =>
    a.thread_id.localeCompare(b.thread_id)
  );
  const rowsByThread = new Map(sorted.map((r) => [r.thread_id, r]));

  const threadToRefs = new Map<string, { storyRef: number; taskRef: number }>();
  const results: BulkSyncRowResult[] = [];
  const blockingErrors: string[] = [];
  const delayMs = options.delayMs ?? 200;

  for (const row of sorted) {
    const result: BulkSyncRowResult = {
      thread_id: row.thread_id,
      story_ref: null,
      task_ref: null,
      story_id: null,
      task_id: null,
      action: "dry_run"
    };

    try {
      let storyRef = parseTaigaRef(row.taiga_story_ref);
      let taskRef = parseTaigaRef(row.taiga_task_ref);

      if (!storyRef || !taskRef) {
        const existing = await findExistingByThread(
          options.projectSlug,
          row.thread_id
        );
        if (existing?.storyRef) storyRef = existing.storyRef;
        if (existing?.taskRef) taskRef = existing.taskRef;
      }

      const storyOpts = storyCreateOpts(row, options.milestoneSlugMap);
      const taskOpts = taskCreateOpts(storyOpts);

      if (options.dryRun) {
        result.action = "dry_run";
        results.push(result);
        continue;
      }

      if (storyRef && taskRef) {
        result.story_ref = storyRef;
        result.task_ref = taskRef;
        result.action = "skipped";
        registerThreadRefs(threadToRefs, row.thread_id, storyRef, taskRef);
        results.push(result);
        await sleep(delayMs);
        continue;
      }

      if (storyRef && !taskRef) {
        const story = await getStoryByRefSlug(options.projectSlug, storyRef);
        const task = await createTask(
          options.projectSlug,
          taskSubject(row),
          {
            description: descriptionWithMarker(row),
            userStoryId: story.id,
            ...taskOpts
          }
        );
        result.story_ref = story.ref;
        result.task_ref = task.ref;
        result.story_id = story.id;
        result.task_id = task.id;
        result.action = "created";
        registerThreadRefs(threadToRefs, row.thread_id, story.ref, task.ref);
      } else if (taskRef && !storyRef) {
        const task = await getTaskByRefSlug(options.projectSlug, taskRef);
        let storyRefResolved: number;
        if (task.user_story != null) {
          const story = await getStoryById(task.user_story);
          storyRefResolved = story.ref;
          result.story_id = story.id;
        } else {
          const story = await createUserStory(
            options.projectSlug,
            storySubject(row),
            descriptionWithMarker(row),
            storyOpts
          );
          await updateTask(
            { projectSlug: options.projectSlug, taskRef: task.ref },
            { userStoryId: story.id }
          );
          storyRefResolved = story.ref;
          result.story_id = story.id;
        }
        result.story_ref = storyRefResolved;
        result.task_ref = task.ref;
        result.task_id = task.id;
        result.action = "created";
        registerThreadRefs(
          threadToRefs,
          row.thread_id,
          storyRefResolved,
          task.ref
        );
      } else {
        const story = await createUserStory(
          options.projectSlug,
          storySubject(row),
          descriptionWithMarker(row),
          storyOpts
        );
        const task = await createTask(options.projectSlug, taskSubject(row), {
          description: descriptionWithMarker(row),
          userStoryId: story.id,
          ...taskOpts
        });

        result.story_ref = story.ref;
        result.task_ref = task.ref;
        result.story_id = story.id;
        result.task_id = task.id;
        result.action = "created";
        registerThreadRefs(threadToRefs, row.thread_id, story.ref, task.ref);
      }
    } catch (e) {
      result.action = "error";
      result.error = e instanceof TaigaError ? e.message : String(e);
    }

    results.push(result);
    await sleep(delayMs);
  }

  if (!options.dryRun) {
    for (const row of sorted) {
      const blockerId = row.blocked_by?.trim();
      if (!blockerId) continue;

      const blocker = resolveThreadRefs(
        blockerId,
        threadToRefs,
        rowsByThread,
        results
      );
      const target = resolveThreadRefs(
        row.thread_id,
        threadToRefs,
        rowsByThread,
        results
      );

      if (!blocker) {
        blockingErrors.push(
          `${row.thread_id}: blocker ${blockerId} has no story/task refs`
        );
        continue;
      }
      if (!target?.taskRef) {
        blockingErrors.push(
          `${row.thread_id}: no task ref to mark blocked`
        );
        continue;
      }

      try {
        await updateTask(
          {
            projectSlug: options.projectSlug,
            taskRef: target.taskRef
          },
          {
            isBlocked: true,
            blockedNote: blockerId
          }
        );
      } catch (e) {
        const msg = e instanceof TaigaError ? e.message : String(e);
        blockingErrors.push(`${row.thread_id}: ${msg}`);
      }
      await sleep(delayMs);
    }
  }

  const header = "thread_id,taiga_story_ref,taiga_task_ref";
  const patchLines = results.map(
    (r) => `${r.thread_id},${r.story_ref ?? ""},${r.task_ref ?? ""}`
  );

  return {
    rows: results,
    csv_patch: [header, ...patchLines].join("\n"),
    ...(blockingErrors.length > 0 ? { blocking_errors: blockingErrors } : {})
  };
}
