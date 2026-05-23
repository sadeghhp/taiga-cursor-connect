import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import { resetClient, setClientForTests } from "./http/client.js";
import { resolveProjectListItem } from "./resolvers.js";

const ENV_KEYS = ["TAIGA_API_URL", "TAIGA_TOKEN"] as const;
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(): void {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.TAIGA_API_URL = "http://localhost:9000/api/v1";
  process.env.TAIGA_TOKEN = "test-token";
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveProjectListItem", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });
  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("matches name case-insensitively", async () => {
    const instance = {
      get: mock.fn(async () => ({
        data: [
          { id: 7, name: "Bug" },
          { id: 8, name: "Question" }
        ]
      })),
      interceptors: { response: { use: mock.fn() } }
    } as unknown as AxiosInstance;
    setClientForTests(instance);
    const id = await resolveProjectListItem(3, "/issue-types", " bug ", "issue type");
    assert.equal(id, 7);
  });
});
