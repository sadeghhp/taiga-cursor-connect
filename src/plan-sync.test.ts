import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parsePlanCsv,
  parseTaigaRef,
  resolveThreadRefs,
  taskBelongsToThread
} from "./plan-sync.js";
import type { TaigaTask } from "./types.js";
import type { BulkSyncRowResult, PlanCsvRow } from "./plan-sync.js";

describe("parsePlanCsv", () => {
  it("parses header and rows", () => {
    const csv = `thread_id,hierarchy_id,title,subphase,module,estimate_h,blocked_by,gate,ac_ids,taiga_story_ref,taiga_task_ref,status
T00001,M01-E01,First task,A,M01,4,,M1.1,,,,
T00002,M01-E02,Second,B,M02,2,T00001,M1.1,,,,
`;
    const rows = parsePlanCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.thread_id, "T00001");
    assert.equal(rows[1]?.blocked_by, "T00001");
  });
});

describe("parseTaigaRef", () => {
  it("parses positive integers", () => {
    assert.equal(parseTaigaRef("42"), 42);
    assert.equal(parseTaigaRef(" 7 "), 7);
  });

  it("rejects invalid refs", () => {
    assert.equal(parseTaigaRef(""), undefined);
    assert.equal(parseTaigaRef("0"), undefined);
    assert.equal(parseTaigaRef("abc"), undefined);
  });
});

describe("taskBelongsToThread", () => {
  it("matches thread marker in description", () => {
    const task: TaigaTask = {
      id: 1,
      ref: 2,
      subject: "Other",
      version: 1,
      is_closed: false,
      description: "text\n\n<!-- thread:T00001 -->"
    };
    assert.equal(taskBelongsToThread(task, "T00001"), true);
  });

  it("matches thread tag", () => {
    const task: TaigaTask = {
      id: 1,
      ref: 2,
      subject: "x",
      version: 1,
      is_closed: false,
      tags: ["thread:T00002"]
    };
    assert.equal(taskBelongsToThread(task, "T00002"), true);
  });
});

describe("resolveThreadRefs", () => {
  const row = (id: string, story: string, task: string): PlanCsvRow => ({
    thread_id: id,
    hierarchy_id: "",
    title: "",
    subphase: "",
    module: "",
    estimate_h: "",
    blocked_by: "",
    gate: "",
    ac_ids: "",
    taiga_story_ref: story,
    taiga_task_ref: task,
    status: ""
  });

  it("uses in-memory map first", () => {
    const map = new Map([["T00001", { storyRef: 1, taskRef: 2 }]]);
    const refs = resolveThreadRefs("T00001", map, new Map(), []);
    assert.deepEqual(refs, { storyRef: 1, taskRef: 2 });
  });

  it("falls back to CSV columns", () => {
    const rowsByThread = new Map([["T00002", row("T00002", "10", "20")]]);
    const refs = resolveThreadRefs("T00002", new Map(), rowsByThread, []);
    assert.deepEqual(refs, { storyRef: 10, taskRef: 20 });
  });

  it("falls back to sync results", () => {
    const results: BulkSyncRowResult[] = [
      {
        thread_id: "T00003",
        story_ref: 3,
        task_ref: 4,
        story_id: 30,
        task_id: 40,
        action: "skipped"
      }
    ];
    const refs = resolveThreadRefs("T00003", new Map(), new Map(), results);
    assert.deepEqual(refs, { storyRef: 3, taskRef: 4 });
  });
});
