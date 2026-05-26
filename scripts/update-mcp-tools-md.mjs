#!/usr/bin/env node
/**
 * Regenerates the alphabetical table in MCP_TOOLS.md with Tier column.
 * Run: node scripts/update-mcp-tools-md.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { pathToFileURL } = await import("node:url");
const { TOOL_TIER } = await import(
  pathToFileURL(join(root, "dist/tool-tiers.js")).href
);

const mdPath = join(root, "MCP_TOOLS.md");
const md = readFileSync(mdPath, "utf8");

const descRe =
  /^\|\s*\d+\s*\|\s*`(taiga_[a-z_]+)`\s*(?:\|\s*\w+\s*)?\|\s*(.+?)\s*\|$/;
const descriptions = new Map();
for (const line of md.split(/\r?\n/)) {
  const m = line.match(descRe);
  if (m) descriptions.set(m[1], m[2].trim());
}

const names = Object.keys(TOOL_TIER).sort();
const missing = names.filter((n) => !descriptions.has(n));
if (missing.length > 0) {
  console.error("Missing descriptions for:", missing.join(", "));
  process.exit(1);
}

const rows = names.map((name, i) => {
  const tier = TOOL_TIER[name];
  const desc = descriptions.get(name);
  return `| ${i + 1} | \`${name}\` | ${tier} | ${desc} |`;
});

const tableStart = md.indexOf("## All tools (alphabetical)");
const tableEnd = md.search(/\r?\n---\r?\n\r?\n## Tools by category/);
if (tableStart < 0 || tableEnd < 0) {
  console.error("Could not find table markers in MCP_TOOLS.md");
  process.exit(1);
}

const header = `## All tools (alphabetical)

| # | Tool | Tier | Description |
|--:|------|------|-------------|
${rows.join("\n")}
`;

const updated =
  md.slice(0, tableStart) + header + md.slice(tableEnd);
writeFileSync(mdPath, updated);
console.log(`Updated ${names.length} rows in MCP_TOOLS.md`);
