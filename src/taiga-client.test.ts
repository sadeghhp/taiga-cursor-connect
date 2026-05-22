import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import {
  TaigaError,
  getClient,
  patchWithOCC,
  resetClient,
  resolveMilestoneId,
  resolvePointsByRole,
  resolveStatusId,
  setClientForTests,
  trimEpicDetail,
  trimHistory,
  trimStoryWithTasks,
  trimTaskDetail
} from "./taiga-client.js";
import type { TaigaHistoryEntry, TaigaMilestone, TaigaStatus, TaigaTask, TaigaUserStory } from "./types.js";

const ENV_KEYS = ["TAIGA_API_URL", "TAIGA_TOKEN"] as const;
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function mockAxiosClient(handlers: {
  get?: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }>;
  request?: (config: unknown) => Promise<{ data: unknown }>;
}): AxiosInstance {
  const instance = {
    get: mock.fn(handlers.get ?? (async () => ({ data: [] }))),
    patch: mock.fn(async () => ({ data: {} })),
    request: mock.fn(handlers.request ?? (async () => ({ data: {} }))),
    interceptors: {
      response: { use: mock.fn() }
    }
  };
  return instance as unknown as AxiosInstance;
}

describe("trimHistory", () => {
  it("returns newest entries first and caps at 50", () => {
    const entries: TaigaHistoryEntry[] = [];
    for (let i = 0; i < 60; i++) {
      entries.push({
        id: String(i),
        type: 1,
        created_at: new Date(1_600_000_000_000 + i * 60_000).toISOString(),
        comment: `comment ${i}`
      });
    }
    const trimmed = trimHistory(entries);
    assert.equal(trimmed.length, 50);
    assert.equal(trimmed[0]?.comment, "comment 59");
    assert.equal(trimmed[49]?.comment, "comment 10");
  });

  it("skips entries without comment or diff", () => {
    const trimmed = trimHistory([
      { id: "1", type: 0, created_at: "2020-01-01T00:00:00Z" },
      {
        id: "2",
        type: 1,
        created_at: "2020-01-02T00:00:00Z",
        comment: "hello"
      }
    ]);
    assert.equal(trimmed.length, 1);
    assert.equal(trimmed[0]?.comment, "hello");
  });

  it("keeps diff-only entries from values_diff", () => {
    const trimmed = trimHistory([
      {
        id: "1",
        type: 2,
        created_at: "2020-01-03T00:00:00Z",
        values_diff: { status: ["Open", "Done"] }
      }
    ]);
    assert.equal(trimmed.length, 1);
    assert.equal(trimmed[0]?.comment, null);
    assert.deepEqual(trimmed[0]?.changes, { status: ["Open", "Done"] });
  });

  it("uses diff when values_diff is absent", () => {
    const trimmed = trimHistory([
      {
        id: "2",
        type: 2,
        created_at: "2020-01-04T00:00:00Z",
        diff: { subject: ["A", "B"] }
      }
    ]);
    assert.deepEqual(trimmed[0]?.changes, { subject: ["A", "B"] });
  });

  it("sorts invalid created_at last among same-type entries", () => {
    const trimmed = trimHistory([
      {
        id: "bad",
        type: 1,
        created_at: "not-a-date",
        comment: "older invalid"
      },
      {
        id: "good",
        type: 1,
        created_at: "2020-01-05T00:00:00Z",
        comment: "newer valid"
      }
    ]);
    assert.equal(trimmed[0]?.comment, "newer valid");
    assert.equal(trimmed[1]?.comment, "older invalid");
  });
});

describe("resolvePointsByRole", () => {
  it("maps point ids to role names", () => {
    const labeled = resolvePointsByRole(
      { "1": 5, "2": 3 },
      [
        { id: 1, name: "UX", value: null },
        { id: 2, name: "Design", value: null }
      ]
    );
    assert.deepEqual(labeled, { UX: 5, Design: 3 });
  });

  it("returns null for empty points", () => {
    assert.equal(resolvePointsByRole(undefined, []), null);
  });

  it("falls back to point_<id> for unknown point ids", () => {
    const labeled = resolvePointsByRole({ "99": 2 }, []);
    assert.deepEqual(labeled, { point_99: 2 });
  });
});

describe("trimStoryWithTasks", () => {
  const baseStory: TaigaUserStory = {
    id: 10,
    ref: 42,
    subject: "Story",
    description: "Desc",
    version: 3,
    tags: [["bug", "#ff0000"], "feature"],
    points: { "1": 5 },
    status_extra_info: { name: "In progress", is_closed: false },
    assigned_to_extra_info: { full_name_display: "Alice" },
    milestone_slug: "sprint-1",
    is_blocked: true,
    blocked_note: "blocked",
    due_date: "2026-01-01",
    total_comments: 2,
    epics: [{ id: 1, ref: 1, subject: "Epic" }]
  };

  const baseTask: TaigaTask = {
    id: 20,
    ref: 7,
    subject: "Task",
    description: "Task desc",
    version: 1,
    is_closed: false,
    status_extra_info: { name: "New" },
    assigned_to_extra_info: { full_name_display: "Bob" },
    tags: ["task-tag"]
  };

  it("normalizes tags and maps tasks", () => {
    const summary = trimStoryWithTasks(
      baseStory,
      [baseTask],
      undefined,
      { UX: 5 }
    );
    assert.deepEqual(summary.tags, ["bug", "feature"]);
    assert.equal(summary.points_by_role?.UX, 5);
    assert.equal(summary.tasks.length, 1);
    assert.equal(summary.tasks[0]?.subject, "Task");
    assert.equal(summary.is_closed, false);
    assert.equal(summary.epics[0]?.subject, "Epic");
  });

  it("uses is_closed from status_extra_info when story flag missing", () => {
    const story = {
      ...baseStory,
      is_closed: undefined,
      status_extra_info: { name: "Done", is_closed: true }
    };
    const summary = trimStoryWithTasks(story, []);
    assert.equal(summary.is_closed, true);
  });

  it("includes history when provided", () => {
    const history = [
      {
        id: "h1",
        type: 1,
        created_at: "2020-01-01T00:00:00Z",
        comment: "note",
        changes: null
      }
    ];
    const summary = trimStoryWithTasks(baseStory, [], history);
    assert.deepEqual(summary.history, history);
  });
});

describe("trimTaskDetail", () => {
  it("includes user_story and extra_info fields", () => {
    const task: TaigaTask = {
      id: 5,
      ref: 12,
      subject: "Fix bug",
      description: "Details",
      version: 2,
      is_closed: true,
      user_story: 99,
      status_extra_info: { name: "Closed" },
      assigned_to_extra_info: { full_name_display: "Carol" },
      blocked_note: "waiting",
      tags: ["urgent"]
    };
    const detail = trimTaskDetail(task);
    assert.equal(detail.user_story, 99);
    assert.equal(detail.status, "Closed");
    assert.equal(detail.assigned_to, "Carol");
    assert.equal(detail.is_closed, true);
    assert.equal(detail.blocked_note, "waiting");
  });
});

describe("trimEpicDetail", () => {
  it("maps epic fields to summary", () => {
    const detail = trimEpicDetail({
      id: 8,
      ref: 3,
      subject: "Platform",
      description: "Big epic",
      version: 4,
      status_extra_info: { name: "In progress", is_closed: false },
      assigned_to_extra_info: { full_name_display: "Alex" },
      tags: ["roadmap"]
    });
    assert.equal(detail.ref, 3);
    assert.equal(detail.status, "In progress");
    assert.equal(detail.assigned_to, "Alex");
    assert.equal(detail.is_closed, false);
    assert.deepEqual(detail.tags, ["roadmap"]);
  });
});

describe("patchWithOCC", () => {
  it("succeeds on first attempt", async () => {
    let patchCalls = 0;
    await patchWithOCC(
      async () => ({ version: 1 }),
      async () => {
        patchCalls++;
      }
    );
    assert.equal(patchCalls, 1);
  });

  it("retries on version conflict then succeeds", async () => {
    let patchCalls = 0;
    const conflict = new AxiosError("conflict");
    conflict.response = {
      status: 409,
      data: { detail: "version mismatch" },
      statusText: "",
      headers: {},
      config: {} as never
    };

    await patchWithOCC(
      async () => ({ version: 1 }),
      async () => {
        patchCalls++;
        if (patchCalls === 1) throw conflict;
      }
    );
    assert.equal(patchCalls, 2);
  });

  it("throws TaigaError after retries exhausted", async () => {
    const conflict = new AxiosError("conflict");
    conflict.response = { status: 409, data: { detail: "version" }, status: 409, statusText: "", headers: {}, config: {} as never };

    await assert.rejects(
      () =>
        patchWithOCC(
          async () => ({ version: 1 }),
          async () => {
            throw conflict;
          }
        ),
      (err: unknown) => {
        assert.ok(err instanceof TaigaError);
        return true;
      }
    );
  });
});

describe("resolveStatusId", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
  });

  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("matches status name case-insensitively with trim", async () => {
    const statuses: TaigaStatus[] = [
      { id: 10, name: "  In Progress  " },
      { id: 11, name: "Done" }
    ];
    setClientForTests(
      mockAxiosClient({
        get: async () => ({ data: statuses })
      })
    );
    const id = await resolveStatusId(1, "user_story", "in progress");
    assert.equal(id, 10);
  });

  it("throws when status not found", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async () => ({ data: [{ id: 1, name: "Done" }] })
      })
    );
    await assert.rejects(
      () => resolveStatusId(1, "task", "Missing"),
      (err: unknown) => {
        assert.ok(err instanceof TaigaError);
        assert.match((err as TaigaError).message, /No task status named "Missing"/);
        return true;
      }
    );
  });

  it("throws when status name is ambiguous", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async () => ({
          data: [
            { id: 1, name: "Open" },
            { id: 2, name: "open" }
          ]
        })
      })
    );
    await assert.rejects(
      () => resolveStatusId(1, "user_story", "open"),
      (err: unknown) => {
        assert.ok(err instanceof TaigaError);
        assert.match((err as TaigaError).message, /Ambiguous status name/);
        return true;
      }
    );
  });
});

describe("resolveMilestoneId", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://taiga.test/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
  });

  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("returns milestoneId when provided", async () => {
    const id = await resolveMilestoneId(1, undefined, 42);
    assert.equal(id, 42);
  });

  it("matches milestone by slug", async () => {
    const milestones: TaigaMilestone[] = [
      { id: 5, name: "Sprint 1", slug: "sprint-1" }
    ];
    setClientForTests(
      mockAxiosClient({
        get: async () => ({ data: milestones })
      })
    );
    const id = await resolveMilestoneId(1, "sprint-1");
    assert.equal(id, 5);
  });

  it("matches milestone by name case-insensitively", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async () => ({
          data: [{ id: 6, name: "Release 2", slug: "release-2" }]
        })
      })
    );
    const id = await resolveMilestoneId(1, "release 2");
    assert.equal(id, 6);
  });

  it("throws when milestone not found", async () => {
    setClientForTests(mockAxiosClient({ get: async () => ({ data: [] }) }));
    await assert.rejects(
      () => resolveMilestoneId(1, "missing"),
      (err: unknown) => {
        assert.ok(err instanceof TaigaError);
        assert.match((err as TaigaError).message, /No milestone/);
        return true;
      }
    );
  });
});

describe("getClient / requireConfig", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });

  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("throws TaigaError when env vars are missing", () => {
    delete process.env.TAIGA_API_URL;
    delete process.env.TAIGA_TOKEN;
    assert.throws(() => getClient(), (err: unknown) => {
      assert.ok(err instanceof TaigaError);
      assert.match((err as TaigaError).message, /Missing TAIGA_API_URL or TAIGA_TOKEN/);
      return true;
    });
  });
});
