/**
 * Local dev entry: enables info-level MCP stderr logs unless TAIGA_MCP_LOG is already set.
 */
if (!process.env.TAIGA_MCP_LOG) {
  process.env.TAIGA_MCP_LOG = "info";
}

await import("../src/server.ts");
