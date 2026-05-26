import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getActiveToolTiersLabel,
  getLogLevel,
  getRegisteredToolCount,
  installToolLogging,
  logReady,
  logToolEnd,
  logToolStart,
  redactToolArgs,
  setLogSink,
  summarizeToolArgs
} from "./mcp-log.js";
import { resetEnabledTiersCache } from "./tool-tiers.js";
import { PACKAGE_VERSION } from "./version.js";

type RegisteredTools = Record<
  string,
  { handler: (...args: unknown[]) => Promise<unknown> }
>;

describe("mcp-log", () => {
  const lines: string[] = [];

  afterEach(() => {
    setLogSink(null);
    delete process.env.TAIGA_MCP_LOG;
    delete process.env.TAIGA_MCP_TOOL_TIERS;
    delete process.env.TAIGA_MCP_TOOL_TIERS_STRICT;
    delete process.env.NO_COLOR;
    resetEnabledTiersCache();
    lines.length = 0;
  });

  function captureLogs(): void {
    setLogSink((line) => lines.push(line));
  }

  describe("getLogLevel", () => {
    it("defaults to off", () => {
      assert.equal(getLogLevel(), "off");
    });

    it("accepts info and debug", () => {
      process.env.TAIGA_MCP_LOG = "info";
      assert.equal(getLogLevel(), "info");
      process.env.TAIGA_MCP_LOG = "debug";
      assert.equal(getLogLevel(), "debug");
    });
  });

  describe("summarizeToolArgs", () => {
    it("omits sensitive keys from summary", () => {
      const summary = summarizeToolArgs("taiga_create_webhook", {
        projectSlug: "demo",
        key: "secret-key-value",
        url: "https://example.com/hook"
      });
      assert.ok(summary?.includes("projectSlug=demo"));
      assert.ok(!summary?.includes("secret-key-value"));
      assert.ok(!summary?.includes("key="));
    });

    it("truncates long descriptions", () => {
      const summary = summarizeToolArgs("taiga_create_story", {
        description: "x".repeat(200)
      });
      assert.equal(summary, undefined);
    });

    it("summarizes common refs", () => {
      const summary = summarizeToolArgs("taiga_get_story", {
        projectSlug: "taiga-cursor-connect",
        storyRef: 42
      });
      assert.equal(summary, "projectSlug=taiga-cursor-connect storyRef=42");
    });

    it("summarizes file paths as basename only", () => {
      const summary = summarizeToolArgs("taiga_bulk_sync_tasks_csv", {
        projectSlug: "demo",
        csvPath: "/home/user/plans/tasks.csv"
      });
      assert.equal(summary, "projectSlug=demo csvPath=tasks.csv");
    });
  });

  describe("redactToolArgs", () => {
    it("truncates sensitive text fields for debug output", () => {
      const redacted = redactToolArgs({
        subject: "s".repeat(100),
        description: "d".repeat(100),
        projectSlug: "demo"
      });
      assert.ok(redacted);
      assert.equal(String(redacted.subject).length, 40);
      assert.equal(String(redacted.description).length, 40);
      assert.equal(redacted.projectSlug, "demo");
    });

    it("redacts nested sensitive keys", () => {
      const redacted = redactToolArgs({
        meta: { token: "secret", id: 1 }
      });
      assert.deepEqual(redacted?.meta, { token: "[redacted]", id: 1 });
    });

    it("redacts auth token fields", () => {
      const redacted = redactToolArgs({
        auth_token: "eyJ.access",
        refresh: "eyJ.refresh",
        TAIGA_PASSWORD: "secret"
      });
      assert.equal(redacted?.auth_token, "[redacted]");
      assert.equal(redacted?.refresh, "[redacted]");
      assert.equal(redacted?.TAIGA_PASSWORD, "[redacted]");
    });
  });

  describe("stderr output", () => {
    it("produces no lines when level is off", () => {
      captureLogs();
      logToolStart("taiga_list_projects", {});
      logToolEnd("taiga_list_projects", 12, { isError: false });
      logReady({
        version: PACKAGE_VERSION,
        apiHost: "http://localhost:9000/api/v1",
        toolCount: 90
      });
      assert.equal(lines.length, 0);
    });

    it("logs tool start and end at info", () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();
      logToolStart("taiga_get_project", { projectSlug: "demo" });
      logToolEnd("taiga_get_project", 25.4, { isError: false });
      assert.equal(lines.length, 2);
      assert.match(lines[0], /→ taiga_get_project/);
      assert.match(lines[0], /projectSlug=demo/);
      assert.match(lines[1], /✓ taiga_get_project/);
      assert.match(lines[1], /25ms/);
    });

    it("does not leak long subject text at debug", () => {
      process.env.TAIGA_MCP_LOG = "debug";
      captureLogs();
      logToolStart("taiga_create_story", {
        projectSlug: "demo",
        subject: "x".repeat(200)
      });
      assert.ok(!lines[0]?.includes("x".repeat(50)));
      assert.match(lines[0], /subject/);
    });

    it("marks failed tools at info", () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();
      logToolEnd("taiga_get_story", 10, { isError: true });
      assert.match(lines[0], /✗ taiga_get_story/);
    });

    it("logReady includes version, tool count, and tiers", () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();
      logReady({
        version: PACKAGE_VERSION,
        apiHost: "http://localhost:9000/api/v1",
        toolCount: 38,
        enabledTiers: "core"
      });
      assert.equal(lines.length, 1);
      assert.match(lines[0], /ready/);
      assert.match(lines[0], new RegExp(`v${PACKAGE_VERSION.replace(/\./g, "\\.")}`));
      assert.match(lines[0], /38 tools/);
      assert.match(lines[0], /tiers=core/);
    });

    it("omits ANSI codes when NO_COLOR is set", () => {
      process.env.TAIGA_MCP_LOG = "info";
      process.env.NO_COLOR = "1";
      captureLogs();
      logToolEnd("taiga_get_story", 10, { isError: true });
      assert.ok(!/\x1b\[[0-9;]*m/u.test(lines[0]));
    });
  });

  describe("installToolLogging", () => {
    it("wraps registered tools and logs handler lifecycle", async () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();

      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("test_echo", { msg: z.string() }, async ({ msg }) => ({
        content: [{ type: "text" as const, text: msg }]
      }));

      assert.equal(getRegisteredToolCount(), 1);

      const tools = (server as unknown as { _registeredTools: RegisteredTools })
        ._registeredTools;
      await tools.test_echo.handler({ msg: "hi" }, {});

      assert.equal(lines.length, 2);
      assert.match(lines[0], /→ test_echo/);
      assert.match(lines[1], /✓ test_echo/);
    });

    it("treats empty schema as tool args for logging", async () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();

      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("test_noargs", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));

      const tools = (server as unknown as { _registeredTools: RegisteredTools })
        ._registeredTools;
      await tools.test_noargs.handler({}, {});

      assert.match(lines[0], /→ test_noargs/);
    });

    it("logs tool errors returned as isError results", async () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();

      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("test_fail", {}, async () => ({
        content: [{ type: "text" as const, text: "bad" }],
        isError: true
      }));

      const tools = (server as unknown as { _registeredTools: RegisteredTools })
        ._registeredTools;
      await tools.test_fail.handler({}, {});

      assert.match(lines[1], /✗ test_fail/);
    });

    it("skips taiga tools outside enabled tiers", () => {
      process.env.TAIGA_MCP_TOOL_TIERS = "core";
      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("taiga_list_projects", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));
      server.tool("taiga_delete_story", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));

      assert.equal(getRegisteredToolCount(), 1);
      assert.equal(getActiveToolTiersLabel(), "core");

      const tools = (server as unknown as { _registeredTools: RegisteredTools })
        ._registeredTools;
      assert.ok(tools.taiga_list_projects);
      assert.equal(tools.taiga_delete_story, undefined);
    });

    it("registers all tiers when TAIGA_MCP_TOOL_TIERS=all", () => {
      process.env.TAIGA_MCP_TOOL_TIERS = "all";
      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("taiga_list_projects", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));
      server.tool("taiga_delete_story", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));

      assert.equal(getRegisteredToolCount(), 2);
    });

    it("registers core+extended when only extended is requested", () => {
      process.env.TAIGA_MCP_TOOL_TIERS = "extended";
      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);

      server.tool("taiga_list_projects", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));
      server.tool("taiga_delete_story", {}, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));
      server.tool("taiga_bulk_sync_tasks_csv", { projectSlug: z.string() }, async () => ({
        content: [{ type: "text" as const, text: "ok" }]
      }));

      assert.equal(getRegisteredToolCount(), 2);
      assert.equal(getActiveToolTiersLabel(), "core,extended");
    });

    it("warns when tier expansion changes effective set", () => {
      process.env.TAIGA_MCP_TOOL_TIERS = "extended";
      captureLogs();
      const server = new McpServer({ name: "test", version: "0" });
      installToolLogging(server);
      assert.match(lines[0] ?? "", /effective core,extended/);
    });
  });
});

describe("PACKAGE_VERSION", () => {
  it("matches package.json version", () => {
    assert.match(PACKAGE_VERSION, /^\d+\.\d+\.\d+$/);
  });
});
