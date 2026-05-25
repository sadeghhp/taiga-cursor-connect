import pc from "picocolors";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { basename } from "node:path";

export type LogLevel = "off" | "info" | "debug";

const PREFIX = "[taiga-mcp]";
const MAX_STRING_LEN = 80;
const MAX_DEBUG_TEXT_LEN = 40;
const MAX_DEBUG_JSON = 400;

const REDACT_KEYS = new Set([
  "key",
  "password",
  "token",
  "auth_token",
  "refresh",
  "TAIGA_TOKEN",
  "TAIGA_PASSWORD",
  "TAIGA_REFRESH_TOKEN",
  "TAIGA_USERNAME"
]);

/** Long or sensitive text fields — truncated heavily in debug output. */
const SENSITIVE_TEXT_KEYS = new Set(["description", "subject", "body", "url"]);

const SUMMARY_KEYS = [
  "projectSlug",
  "storyRef",
  "taskRef",
  "issueRef",
  "epicRef",
  "storyId",
  "taskId",
  "issueId",
  "epicId",
  "webhookId",
  "wikiId",
  "milestoneSlug",
  "milestoneId",
  "confirm",
  "dryRun",
  "page",
  "text",
  "statusName",
  "entityType",
  "csvPath",
  "filePath"
] as const;

type WriteFn = (line: string) => void;

let sink: WriteFn = (line) => console.error(line);

/** @internal Replace stderr writer (tests only). */
export function setLogSink(fn: WriteFn | null): void {
  sink = fn ?? ((line) => console.error(line));
}

/** Resolved log level from TAIGA_MCP_LOG (default off). */
export function getLogLevel(): LogLevel {
  const raw = process.env.TAIGA_MCP_LOG?.trim().toLowerCase();
  if (raw === "info" || raw === "debug") return raw;
  return "off";
}

function levelAtLeast(min: LogLevel): boolean {
  const level = getLogLevel();
  if (level === "off") return false;
  if (min === "info") return level === "info" || level === "debug";
  return level === "debug";
}

function write(line: string): void {
  if (getLogLevel() === "off") return;
  sink(`${PREFIX} ${line}`);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatSummaryValue(key: string, value: unknown): string {
  if (key === "csvPath" || key === "filePath") {
    return basename(String(value));
  }
  return String(redactValue(key, value));
}

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key)) return "[redacted]";
  if (SENSITIVE_TEXT_KEYS.has(key) && typeof value === "string") {
    return truncate(value, MAX_DEBUG_TEXT_LEN);
  }
  if (typeof value === "string" && value.length > MAX_STRING_LEN) {
    return truncate(value, MAX_STRING_LEN);
  }
  return value;
}

/** Redact tool args for debug JSON logging. */
export function redactToolArgs(args: unknown): Record<string, unknown> | undefined {
  if (args == null || typeof args !== "object" || Array.isArray(args)) {
    return undefined;
  }
  return redactRecord(args as Record<string, unknown>);
}

function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACT_KEYS.has(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (SENSITIVE_TEXT_KEYS.has(key) && typeof value === "string") {
      out[key] = truncate(value, MAX_DEBUG_TEXT_LEN);
      continue;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      out[key] = redactRecord(value as Record<string, unknown>);
      continue;
    }
    out[key] = redactValue(key, value);
  }
  return out;
}

/** Build a short, redacted summary of tool arguments for stderr logs. */
export function summarizeToolArgs(
  _name: string,
  args: unknown
): string | undefined {
  if (args == null || typeof args !== "object" || Array.isArray(args)) {
    return undefined;
  }
  const record = args as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of SUMMARY_KEYS) {
    const value = record[key];
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=${formatSummaryValue(key, value)}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Sanitize API host for display (no credentials in URL). */
export function sanitizeApiHost(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    url.username = "";
    url.password = "";
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return truncate(apiUrl, MAX_STRING_LEN);
  }
}

export function logConfigError(message: string): void {
  sink(`${PREFIX} ${pc.red("✗")} ${pc.red(message)}`);
}

export function logAuthReady(opts: { mode: "login" | "token"; username?: string }): void {
  if (!levelAtLeast("info")) return;
  const modeLabel = opts.mode === "login" ? "login" : "token";
  const user =
    opts.username != null && opts.username !== ""
      ? ` · ${pc.dim(opts.username)}`
      : "";
  write(`${pc.green("✓")} auth ${pc.yellow(modeLabel)}${user}`);
}

export function logReady(opts: {
  version: string;
  apiHost: string;
  toolCount: number;
}): void {
  if (!levelAtLeast("info")) return;
  const level = getLogLevel();
  write(
    `${pc.green("✓")} ready ${pc.dim(`v${opts.version}`)} · ${pc.cyan(sanitizeApiHost(opts.apiHost))} · ${opts.toolCount} tools · log=${pc.yellow(level)}`
  );
}

export function logToolStart(name: string, args: unknown): void {
  if (!levelAtLeast("info")) return;
  const summary = summarizeToolArgs(name, args);
  const redacted = redactToolArgs(args);
  const detail =
    levelAtLeast("debug") && redacted != null
      ? pc.dim(truncate(JSON.stringify(redacted), MAX_DEBUG_JSON))
      : summary
        ? pc.dim(summary)
        : "";
  write(`${pc.blue("→")} ${name}${detail ? ` ${detail}` : ""}`);
}

export function logToolEnd(
  name: string,
  ms: number,
  opts: { isError: boolean }
): void {
  if (!levelAtLeast("info")) return;
  const duration = pc.dim(`${ms.toFixed(0)}ms`);
  if (opts.isError) {
    write(`${pc.red("✗")} ${name} ${duration}`);
  } else {
    write(`${pc.green("✓")} ${name} ${duration}`);
  }
}

export function logHttpRetry(
  kind: "401" | "429" | "occ",
  attempt: number,
  max: number,
  method: string,
  path: string
): void {
  if (!levelAtLeast("debug")) return;
  const label = kind === "429" ? "rate limit" : "version conflict";
  write(
    `${pc.yellow("…")} retry ${label} ${method} ${path} (${attempt}/${max})`
  );
}

function isToolErrorResult(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "isError" in result &&
    (result as { isError?: boolean }).isError === true
  );
}

function isZodShape(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).some((v) => {
    if (v == null || typeof v !== "object") return false;
    return "_def" in v || "parse" in v || "safeParse" in v;
  });
}

function isToolAnnotations(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.values(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every((v) => v == null || typeof v !== "object");
}

function toolHasInputSchema(rest: unknown[]): boolean {
  for (const item of rest.slice(0, -1)) {
    if (typeof item === "string") continue;
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    if (isZodShape(item)) return true;
    if (Object.keys(item as object).length === 0) return true;
    if (!isToolAnnotations(item)) return true;
  }
  return false;
}

let registeredToolCount = 0;

/** Number of tools registered after installToolLogging (for startup banner). */
export function getRegisteredToolCount(): number {
  return registeredToolCount;
}

/** Wrap server.tool so every handler emits stderr logs without touching each tool. */
export function installToolLogging(server: McpServer): void {
  const register = server.tool.bind(server);

  server.tool = ((name: string, ...rest: unknown[]) => {
    registeredToolCount += 1;
    const callback = rest[rest.length - 1] as (...args: unknown[]) => Promise<unknown>;
    const hasSchema = toolHasInputSchema(rest);

    const wrapped = async (...handlerArgs: unknown[]) => {
      const toolArgs = hasSchema ? handlerArgs[0] : undefined;
      const start = performance.now();
      logToolStart(name, toolArgs);
      try {
        const result = await callback(...handlerArgs);
        logToolEnd(name, performance.now() - start, {
          isError: isToolErrorResult(result)
        });
        return result;
      } catch (err) {
        logToolEnd(name, performance.now() - start, { isError: true });
        throw err;
      }
    };

    const head = rest.slice(0, -1);
    return (register as (n: string, ...r: unknown[]) => ReturnType<typeof register>)(
      name,
      ...head,
      wrapped
    );
  }) as typeof server.tool;
}
