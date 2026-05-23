import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import { resetClient, setClientForTests } from "./http/client.js";
import { setCustomAttributeValues } from "./custom-attributes.js";

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

describe("setCustomAttributeValues", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });
  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("merges attributes_values with OCC patch", async () => {
    let patchBody: Record<string, unknown> | undefined;
    const instance = {
      get: mock.fn(async (url: string) => {
        if (url === "/projects/by_slug") {
          return { data: { id: 1, slug: "p", name: "P" } };
        }
        if (url === "/userstories/by_ref") {
          return { data: { id: 10, ref: 1, subject: "S", version: 1, project: 1 } };
        }
        if (url === "/userstories/10") {
          return {
            data: {
              version: 2,
              attributes_values: { "1": "existing" }
            }
          };
        }
        throw new Error(`unexpected get ${url}`);
      }),
      patch: mock.fn(async (_url: string, body: Record<string, unknown>) => {
        patchBody = body;
        return { data: {} };
      }),
      post: mock.fn(),
      delete: mock.fn(),
      interceptors: { response: { use: mock.fn() } },
      defaults: { headers: { common: {} } }
    } as unknown as AxiosInstance;
    setClientForTests(instance);

    const result = await setCustomAttributeValues(
      "p",
      "user_story",
      { projectSlug: "p", storyRef: 1 },
      { "2": "new" }
    );

    assert.deepEqual(patchBody?.attributes_values, { "1": "existing", "2": "new" });
    assert.equal(patchBody?.version, 2);
    assert.deepEqual(result, { "1": "existing", "2": "new" });
  });
});
