import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import {
  buildKanbanBoardFromData,
  resolveStoryStatusId,
  updateStoryKanbanOrder
} from "./kanban.js";
import { resetClient, setClientForTests, TaigaError } from "./http/client.js";
import type { UserStoryListItem, UserStoryStatusSummary } from "./types.js";
const statuses: UserStoryStatusSummary[] = [
  {
    id: 1,
    name: "New",
    order: 1,
    color: "#fff",
    wip_limit: null,
    is_closed: false
  },
  {
    id: 2,
    name: "In progress",
    order: 2,
    color: "#aaa",
    wip_limit: 3,
    is_closed: false
  }
];

describe("buildKanbanBoardFromData", () => {
  it("groups stories by status and sorts by kanban_order", () => {
    const stories: UserStoryListItem[] = [
      {
        id: 10,
        ref: 1,
        subject: "Second",
        status: 2,
        kanban_order: 20,
        swimlane: 5,
        is_closed: false
      },
      {
        id: 11,
        ref: 2,
        subject: "First",
        status: 2,
        kanban_order: 10,
        swimlane: 5,
        is_closed: false
      },
      {
        id: 12,
        ref: 3,
        subject: "Backlog item",
        status: 1,
        kanban_order: 5,
        swimlane: null,
        is_closed: false
      }
    ];

    const board = buildKanbanBoardFromData({
      statuses,
      stories,
      swimlanes: [{ id: 5, name: "Default", order: 1 }],
      swimlanesSupported: true,
      projectSlug: "demo",
      isKanbanActivated: true
    });

    assert.equal(board.columns.length, 2);
    const inProgress = board.columns.find((c) => c.name === "In progress");
    assert.ok(inProgress);
    assert.equal(inProgress.cards.length, 2);
    assert.equal(inProgress.cards[0]?.ref, 2);
    assert.equal(inProgress.cards[1]?.ref, 1);
    assert.equal(inProgress.cards[0]?.swimlane_name, "Default");
    assert.equal(board.columns[0]?.cards[0]?.ref, 3);
  });

  it("excludes closed stories by default", () => {
    const stories: UserStoryListItem[] = [
      {
        id: 1,
        ref: 1,
        subject: "Open",
        status: 1,
        is_closed: false
      },
      {
        id: 2,
        ref: 2,
        subject: "Done",
        status: 2,
        is_closed: true
      }
    ];

    const board = buildKanbanBoardFromData({
      statuses,
      stories,
      swimlanes: [],
      swimlanesSupported: false,
      projectSlug: "demo",
      isKanbanActivated: true
    });

    const totalCards = board.columns.reduce((n, c) => n + c.cards.length, 0);
    assert.equal(totalCards, 1);
    assert.equal(board.columns[0]?.cards[0]?.subject, "Open");
  });

  it("filters by swimlaneId when set", () => {
    const stories: UserStoryListItem[] = [
      { id: 1, ref: 1, subject: "A", status: 1, swimlane: 1, is_closed: false },
      { id: 2, ref: 2, subject: "B", status: 1, swimlane: 2, is_closed: false }
    ];

    const board = buildKanbanBoardFromData({
      statuses,
      stories,
      swimlanes: [
        { id: 1, name: "Lane A", order: 1 },
        { id: 2, name: "Lane B", order: 2 }
      ],
      swimlanesSupported: true,
      projectSlug: "demo",
      isKanbanActivated: true,
      swimlaneId: 2
    });

    const totalCards = board.columns.reduce((n, c) => n + c.cards.length, 0);
    assert.equal(totalCards, 1);
    assert.equal(board.columns[0]?.cards[0]?.subject, "B");
  });

  it("resolves status from status_extra_info name when id missing", () => {
    const stories: UserStoryListItem[] = [
      {
        id: 1,
        ref: 1,
        subject: "By name",
        status_extra_info: { name: "In progress" },
        is_closed: false
      }
    ];

    const board = buildKanbanBoardFromData({
      statuses,
      stories,
      swimlanes: [],
      swimlanesSupported: false,
      projectSlug: "demo",
      isKanbanActivated: true
    });

    assert.equal(board.orphaned_cards_count, 0);
    const col = board.columns.find((c) => c.name === "In progress");
    assert.equal(col?.cards[0]?.subject, "By name");
  });

  it("reports orphaned cards when status cannot be resolved", () => {
    const stories: UserStoryListItem[] = [
      {
        id: 1,
        ref: 9,
        subject: "Unknown column",
        status_extra_info: { name: "Missing" },
        is_closed: false
      }
    ];

    const board = buildKanbanBoardFromData({
      statuses,
      stories,
      swimlanes: [],
      swimlanesSupported: false,
      projectSlug: "demo",
      isKanbanActivated: true
    });

    assert.equal(board.orphaned_cards_count, 1);
    assert.equal(board.orphaned_cards[0]?.ref, 9);
    assert.equal(board.columns.reduce((n, c) => n + c.cards.length, 0), 0);
  });
});

describe("resolveStoryStatusId", () => {
  it("prefers numeric status over name", () => {
    const byName = new Map([["new", 1]]);
    assert.equal(
      resolveStoryStatusId(
        { id: 1, ref: 1, subject: "x", status: 2 },
        byName
      ),
      2
    );
  });
});

describe("updateStoryKanbanOrder", () => {
  beforeEach(() => {
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
  });

  afterEach(() => {
    resetClient();
  });

  it("posts bulk_update_kanban_order payload", async () => {
    let postedBody: Record<string, unknown> | undefined;
    const client = {
      get: mock.fn(async (url: string) => {
        if (url.includes("/projects/by_slug")) {
          return { data: { id: 7, slug: "demo", name: "Demo" } };
        }
        if (url.includes("/userstories/by_ref")) {
          return { data: { id: 50, ref: 3, project: 7, version: 1 } };
        }
        return { data: {} };
      }),
      post: mock.fn(async (_url: string, body: unknown) => {
        postedBody = body as Record<string, unknown>;
        return { data: [] };
      }),
      interceptors: { response: { use: mock.fn() } }
    };
    setClientForTests(client as unknown as AxiosInstance);

    await updateStoryKanbanOrder("demo", [{ storyRef: 3, order: 42 }]);

    assert.deepEqual(postedBody?.project_id, 7);
    assert.deepEqual(postedBody?.bulk_stories, [{ us_id: 50, order: 42 }]);
  });

  it("rejects entries without story ref or id", async () => {
    setClientForTests({
      get: mock.fn(async () => ({
        data: { id: 7, slug: "demo", name: "Demo" }
      })),
      interceptors: { response: { use: mock.fn() } }
    } as unknown as AxiosInstance);

    await assert.rejects(
      () => updateStoryKanbanOrder("demo", [{ order: 1 }]),
      (e: unknown) => {
        assert.ok(e instanceof TaigaError);
        assert.match((e as TaigaError).message, /storyId or storyRef/);
        return true;
      }
    );
  });
});