import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import {
  probeSwimlanesSupport,
  resolveSwimlaneId,
  deleteSwimlane,
  clearSwimlanesSupportCache
} from "./swimlanes.js";
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
  get?: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }>;
  delete?: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }>;
}): AxiosInstance {
  return {
    get: mock.fn(handlers.get ?? (async () => ({ data: [] }))),
    delete: mock.fn(handlers.delete ?? (async () => ({ data: {} }))),
    interceptors: { response: { use: mock.fn() } }
  } as unknown as AxiosInstance;
}

describe("probeSwimlanesSupport", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
    clearSwimlanesSupportCache();
  });

  afterEach(() => {
    restoreEnv();
    resetClient();
    clearSwimlanesSupportCache();
  });

  it("returns supported true on 200", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async () => ({ data: [{ id: 1, name: "Default", order: 1 }] })
      })
    );
    const result = await probeSwimlanesSupport(7);
    assert.equal(result.supported, true);
  });

  it("returns supported false on 404", async () => {
    const err = new AxiosError("Not found");
    err.response = {
      status: 404,
      data: {},
      statusText: "",
      headers: {},
      config: {} as never
    };
    setClientForTests(
      mockAxiosClient({
        get: async () => {
          throw err;
        }
      })
    );
    const result = await probeSwimlanesSupport(7);
    assert.equal(result.supported, false);
    assert.match(result.message ?? "", /not available/i);
  });

  it("returns supported false on 403", async () => {
    const err = new AxiosError("Forbidden");
    err.response = {
      status: 403,
      data: {},
      statusText: "",
      headers: {},
      config: {} as never
    };
    setClientForTests(
      mockAxiosClient({
        get: async () => {
          throw err;
        }
      })
    );
    const result = await probeSwimlanesSupport(7);
    assert.equal(result.supported, false);
  });
});

describe("resolveSwimlaneId", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
    clearSwimlanesSupportCache();
  });

  afterEach(() => {
    restoreEnv();
    resetClient();
    clearSwimlanesSupportCache();
  });

  it("matches swimlane name case-insensitively", async () => {
    setClientForTests(
      mockAxiosClient({
        get: async () => ({
          data: [
            { id: 10, name: "Frontend", order: 1 },
            { id: 11, name: "Backend", order: 2 }
          ]
        })
      })
    );
    const id = await resolveSwimlaneId(7, "frontend");
    assert.equal(id, 10);
  });

  it("throws when swimlanes unsupported", async () => {
    const err = new AxiosError("Not found");
    err.response = {
      status: 404,
      data: {},
      statusText: "",
      headers: {},
      config: {} as never
    };
    setClientForTests(
      mockAxiosClient({
        get: async () => {
          throw err;
        }
      })
    );
    await assert.rejects(
      () => resolveSwimlaneId(7, "Default"),
      (e: unknown) => {
        assert.ok(e instanceof TaigaError);
        return true;
      }
    );
  });
});

describe("deleteSwimlane", () => {
  beforeEach(() => {
    saveEnv();
    process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
    process.env.TAIGA_TOKEN = "test-token";
    resetClient();
    clearSwimlanesSupportCache();
  });

  afterEach(() => {
    restoreEnv();
    resetClient();
    clearSwimlanesSupportCache();
  });

  it("passes moveTo query param when deleting", async () => {
    let deleteUrl = "";
    let deleteParams: Record<string, unknown> | undefined;
    setClientForTests(
      mockAxiosClient({
        get: async (url) => {
          if (url.includes("/projects/by_slug")) {
            return { data: { id: 7, slug: "demo", name: "Demo" } };
          }
          if (url === "/swimlanes/5") {
            return { data: { id: 5, name: "Old", order: 1, project: 7 } };
          }
          if (url === "/swimlanes/10") {
            return { data: { id: 10, name: "Target", order: 2, project: 7 } };
          }
          return { data: [{ id: 1, name: "Default", order: 1 }] };
        },
        delete: async (url, config) => {
          deleteUrl = url;
          deleteParams = config?.params as Record<string, unknown>;
          return { data: {} };
        }
      })
    );
    await deleteSwimlane("demo", 5, 10);
    assert.equal(deleteUrl, "/swimlanes/5");
    assert.equal(deleteParams?.moveTo, 10);
  });
});
