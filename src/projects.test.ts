import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { AxiosInstance } from "axios";
import { resetClient, setClientForTests } from "./http/client.js";
import { createProject, listProjectTemplates, trimProjectModules } from "./projects.js";
import type { TaigaProject } from "./types.js";

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

function mockClient(handlers: {
  get?: (url: string) => Promise<{ data: unknown }>;
  post?: (url: string, body?: unknown) => Promise<{ data: unknown }>;
}): AxiosInstance {
  return {
    get: mock.fn(handlers.get ?? (async () => ({ data: [] }))),
    post: mock.fn(handlers.post ?? (async () => ({ data: {} }))),
    patch: mock.fn(async () => ({ data: {} })),
    delete: mock.fn(async () => ({ data: {} })),
    interceptors: { response: { use: mock.fn() } },
    defaults: { headers: { common: { Authorization: "Bearer test-token" } } }
  } as unknown as AxiosInstance;
}

describe("trimProjectModules", () => {
  it("maps module flags from Taiga project", () => {
    const trimmed = trimProjectModules({
      id: 1,
      name: "Test",
      slug: "test",
      description: "d",
      is_epics_activated: true,
      is_issues_activated: true,
      is_wiki_activated: false,
      is_kanban_activated: true,
      is_backlog_activated: true,
      is_private: true
    } as TaigaProject);
    assert.equal(trimmed.is_epics_activated, true);
    assert.equal(trimmed.is_private, true);
  });
});

describe("listProjectTemplates", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });
  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("returns trimmed template list", async () => {
    setClientForTests(
      mockClient({
        get: async (url) => {
          assert.equal(url, "/project-templates");
          return {
            data: [
              {
                id: 1,
                name: "Scrum",
                slug: "scrum",
                is_epics_activated: false,
                is_issues_activated: true,
                is_wiki_activated: true
              }
            ]
          };
        }
      })
    );
    const templates = await listProjectTemplates();
    assert.equal(templates.length, 1);
    assert.equal(templates[0]?.name, "Scrum");
  });
});

describe("createProject", () => {
  beforeEach(() => {
    saveEnv();
    resetClient();
  });
  afterEach(() => {
    resetClient();
    restoreEnv();
  });

  it("POSTs creation_template and module flags", async () => {
    setClientForTests(
      mockClient({
        post: async (url, body) => {
          assert.equal(url, "/projects");
          assert.deepEqual(body, {
            name: "New App",
            description: "desc",
            creation_template: 1,
            is_private: true,
            is_epics_activated: true
          });
          return {
            data: {
              id: 9,
              name: "New App",
              slug: "new-app",
              is_epics_activated: true,
              is_private: true
            }
          };
        }
      })
    );
    const created = await createProject({
      name: "New App",
      description: "desc",
      templateId: 1,
      isPrivate: true,
      isEpicsActivated: true
    });
    assert.equal(created.slug, "new-app");
    assert.equal(created.is_epics_activated, true);
  });
});
