import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getLogLevel,
  logReady,
  logToolEnd,
  logToolStart,
  setLogSink,
  summarizeToolArgs
} from "./mcp-log.js";

describe("mcp-log", () => {
  const lines: string[] = [];

  afterEach(() => {
    setLogSink(null);
    delete process.env.TAIGA_MCP_LOG;
    delete process.env.NO_COLOR;
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
  });

  describe("stderr output", () => {
    it("produces no lines when level is off", () => {
      captureLogs();
      logToolStart("taiga_list_projects", {});
      logToolEnd("taiga_list_projects", 12, { isError: false });
      logReady({ version: "0.7.0", apiHost: "http://localhost:9000/api/v1", toolCount: 90 });
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

    it("marks failed tools at info", () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();
      logToolEnd("taiga_get_story", 10, { isError: true });
      assert.match(lines[0], /✗ taiga_get_story/);
    });

    it("logReady includes version and tool count", () => {
      process.env.TAIGA_MCP_LOG = "info";
      captureLogs();
      logReady({
        version: "0.7.0",
        apiHost: "http://localhost:9000/api/v1",
        toolCount: 90
      });
      assert.equal(lines.length, 1);
      assert.match(lines[0], /ready/);
      assert.match(lines[0], /v0\.7\.0/);
      assert.match(lines[0], /90 tools/);
    });

    it("omits ANSI codes when NO_COLOR is set", () => {
      process.env.TAIGA_MCP_LOG = "info";
      process.env.NO_COLOR = "1";
      captureLogs();
      logToolEnd("taiga_get_story", 10, { isError: true });
      assert.ok(!/\x1b\[[0-9;]*m/u.test(lines[0]));
    });
  });
});
