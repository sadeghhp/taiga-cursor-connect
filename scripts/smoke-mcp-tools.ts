#!/usr/bin/env npx tsx
/**
 * Smoke test against live Taiga (optional).
 * Requires: TAIGA_API_URL, TAIGA_TOKEN, TAIGA_PROJECT_SLUG (default mcp-test)
 */
import "dotenv/config";
import {
  getProjectDetail,
  listMilestones,
  listProjects,
  listEpics
} from "../src/taiga-client.js";
import { parsePlanCsv } from "../src/plan-sync.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const slug = process.env.TAIGA_PROJECT_SLUG ?? "mcp-test";

async function main(): Promise<void> {
  console.log("taiga_list_projects...");
  const projects = await listProjects();
  console.log(`  ${projects.length} project(s)`);

  console.log(`taiga_get_project ${slug}...`);
  const detail = await getProjectDetail(slug);
  console.log(`  epics=${detail.is_epics_activated} issues=${detail.is_issues_activated}`);

  console.log("taiga_list_milestones...");
  const milestones = await listMilestones(slug);
  console.log(`  ${milestones.length} milestone(s)`);

  console.log("taiga_list_epics...");
  const epics = await listEpics(slug);
  const epicCount = Array.isArray(epics) ? epics.length : epics.items.length;
  console.log(`  ${epicCount} epic(s)`);

  const dir = dirname(fileURLToPath(import.meta.url));
  const sample = join(dir, "fixtures/tasks-sample.csv");
  const csv = await readFile(sample, "utf-8");
  const rows = parsePlanCsv(csv);
  console.log(`parsePlanCsv sample: ${rows.length} rows`);

  console.log("Smoke OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
