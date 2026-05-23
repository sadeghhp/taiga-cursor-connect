import pc from "picocolors";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type LogLevel = "off" | "info" | "debug";

const PREFIX = "[taiga-mcp]";
const MAX_STRING_LEN = 80;
const MAX_DEBUG_JSON = 400;

const REDACT_KEYS = new Set([
  "key",
  "password",
  "token",
  "auth_token",
  "TAIGA_TOKEN"
]);

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
  "entityType"
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

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key)) return "[redacted]";
  if (typeof value === "string" && value.length > MAX_STRING_LEN) {
    return truncate(value, MAX_STRING_LEN);
  }
  return value;
}

function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACT_KEYS.has(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (key === "description" && typeof value === "string") {
      out[key] = truncate(value, MAX_STRING_LEN);
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
    parts.push(`${key}=${String(redactValue(key, value))}`);
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
  const detail =
    levelAtLeast("debug") && args != null
      ? pc.dim(
          truncate(JSON.stringify(redactRecord(args as Record<string, unknown>)), MAX_DEBUG_JSON)
        )
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
  kind: "429" | "occ",
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

function toolHasInputSchema(rest: unknown[]): boolean {
  return rest.slice(0, -1).some(isZodShape);
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
