import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import { reorderUserStoryStatuses, deleteUserStoryStatus } from "./user-story-statuses.js";
import { resetClient, setClientForTests, TaigaError } from "./http/client.js";

const ENV_KEYS = ["TAIGA_API_URL", "TAIGA_TOKEN"] as const;
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function mockAxiosClient(handlers: {
  get?: (url: string) => Promise<{ data: unknown }>;
  post?: (url: string, body: unknown) => Promise<{ data: unknown }>;
}): AxiosInstance {
  return {
    get: mock.fn(handlers.get ?? (async () => ({ data: {} }))),
    post: mock.fn(handlers.post ?? (async () => ({ data: {} }))),
    interceptors: { response: { use: mock.fn() } }
  } as unknown as AxiosInstance;
}

describe("reorderUserStoryStatuses", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
  });

  afterEach(() => {
    restoreEnv();
    resetClient();
  });

  it("posts bulk_userstory_statuses pairs", async () => {
    let postedBody: Record<string, unknown> | undefined;
    setClientForTests(
      mockAxiosClient({
        get: async (url) => {
          if (url.includes("/projects/by_slug")) {
            return { data: { id: 7, slug: "demo", name: "Demo" } };
          }
          if (url === "/userstory-statuses/1") {
            return {
              data: { id: 1, name: "New", order: 1, project: 7, is_closed: false }
            };
          }
          if (url === "/userstory-statuses/2") {
            return {
              data: { id: 2, name: "Done", order: 2, project: 7, is_closed: false }
            };
          }
          return { data: [] };
        },
        post: async (_url, body) => {
          postedBody = body as Record<string, unknown>;
          return { data: {} };
        }
      })
    );

    await reorderUserStoryStatuses("demo", [
      { statusId: 1, order: 10 },
      { statusId: 2, order: 5 }
    ]);

    assert.deepEqual(postedBody?.project, 7);
    assert.deepEqual(postedBody?.bulk_userstory_statuses, [
      [1, 10],
      [2, 5]
    ]);
  });
});

describe("deleteUserStoryStatus", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
  });

  afterEach(() => {
    restoreEnv();
    resetClient();
  });

  it("rejects status from another project", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async (url) => {
          if (url.includes("/projects/by_slug")) {
            return { data: { id: 7, slug: "demo", name: "Demo" } };
          }
          if (url === "/userstory-statuses/99") {
            return {
              data: {
                id: 99,
                name: "Other",
                order: 1,
                project: 999,
                is_closed: false
              }
            };
          }
          return { data: {} };
        }
      })
    );

    await assert.rejects(
      () => deleteUserStoryStatus("demo", 99),
      (e: unknown) => {
        assert.ok(e instanceof TaigaError);
        assert.match((e as TaigaError).message, /does not belong to project/);
        return true;
      }
    );
  });
});
