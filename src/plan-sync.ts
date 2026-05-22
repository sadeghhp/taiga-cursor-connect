import { readFile } from "node:fs/promises";
import {
  createTask,
  createUserStory,
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
}

const THREAD_MARKER = (id: string) => `<!-- thread:${id} -->`;

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

export async function bulkSyncTasksCsv(
  options: BulkSyncOptions
): Promise<BulkSyncResult> {
  const content = await readFile(options.csvPath, "utf-8");
  const parsed = parsePlanCsv(content);
  const sorted = [...parsed].sort((a, b) =>
    a.thread_id.localeCompare(b.thread_id)
  );

  const threadToRefs = new Map<string, { storyRef: number; taskRef: number }>();
  const results: BulkSyncRowResult[] = [];
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
      let storyRef = row.taiga_story_ref
        ? Number(row.taiga_story_ref)
        : undefined;
      let taskRef = row.taiga_task_ref
        ? Number(row.taiga_task_ref)
        : undefined;

      if (!storyRef || !taskRef) {
        const existing = await findExistingByThread(
          options.projectSlug,
          row.thread_id
        );
        if (existing?.storyRef) storyRef = existing.storyRef;
        if (existing?.taskRef) taskRef = existing.taskRef;
      }

      const createOpts: CreateOptionalFields = {
        tags: buildTags(row),
        milestoneSlug: options.milestoneSlugMap?.[row.subphase]
      };
      const est = Number(row.estimate_h);
      if (!Number.isNaN(est) && est > 0) {
        createOpts.estimateHours = est;
      }

      if (options.dryRun) {
        result.action = "dry_run";
        results.push(result);
        continue;
      }

      if (storyRef && taskRef) {
        result.story_ref = storyRef;
        result.task_ref = taskRef;
        result.action = "skipped";
        threadToRefs.set(row.thread_id, { storyRef, taskRef });
        results.push(result);
        await sleep(delayMs);
        continue;
      }

      const story = await createUserStory(
        options.projectSlug,
        storySubject(row),
        descriptionWithMarker(row),
        createOpts
      );
      const task = await createTask(options.projectSlug, taskSubject(row), {
        description: descriptionWithMarker(row),
        userStoryId: story.id,
        tags: createOpts.tags,
        milestoneSlug: createOpts.milestoneSlug,
        estimateHours: createOpts.estimateHours
      });

      result.story_ref = story.ref;
      result.task_ref = task.ref;
      result.story_id = story.id;
      result.task_id = task.id;
      result.action = "created";
      threadToRefs.set(row.thread_id, {
        storyRef: story.ref,
        taskRef: task.ref
      });
    } catch (e) {
      result.action = "error";
      result.error = e instanceof TaigaError ? e.message : String(e);
    }

    results.push(result);
    await sleep(delayMs);
  }

  // Apply blocked_by after all rows exist
  if (!options.dryRun) {
    for (const row of sorted) {
      if (!row.blocked_by?.trim()) continue;
      const blocker = threadToRefs.get(row.blocked_by.trim());
      const target = threadToRefs.get(row.thread_id);
      if (!blocker || !target?.taskRef) continue;
      try {
        await updateTask(
          {
            projectSlug: options.projectSlug,
            taskRef: target.taskRef
          },
          {
            isBlocked: true,
            blockedNote: row.blocked_by.trim()
          }
        );
      } catch {
        // best-effort
      }
      await sleep(delayMs);
    }
  }

  const header =
    "thread_id,taiga_story_ref,taiga_task_ref";
  const patchLines = results.map(
    (r) =>
      `${r.thread_id},${r.story_ref ?? ""},${r.task_ref ?? ""}`
  );

  return {
    rows: results,
    csv_patch: [header, ...patchLines].join("\n")
  };
}
