#!/usr/bin/env npx tsx
/**
 * Smoke test against live Taiga (optional).
 * Requires: TAIGA_API_URL, TAIGA_TOKEN, TAIGA_PROJECT_SLUG (default taiga-cursor-connect)
 */
import "dotenv/config";
import { uploadAttachment, deleteAttachment } from "../src/attachments.js";
import {
  createProject,
  createUserStory,
  deleteProject,
  deleteUserStory,
  getProjectDetail,
  listEpics,
  listIssueTypes,
  listMilestones,
  listProjectTemplates,
  listProjects
} from "../src/taiga-client.js";
import { parsePlanCsv } from "../src/plan-sync.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const slug = process.env.TAIGA_PROJECT_SLUG ?? "taiga-cursor-connect";

async function main(): Promise<void> {
  console.log("taiga_list_projects...");
  const projects = await listProjects();
  console.log(`  ${projects.length} project(s)`);

  console.log("taiga_list_project_templates...");
  const templates = await listProjectTemplates();
  console.log(`  ${templates.length} template(s)`);

  console.log(`taiga_get_project ${slug}...`);
  const detail = await getProjectDetail(slug);
  console.log(`  epics=${detail.is_epics_activated} issues=${detail.is_issues_activated}`);

  console.log("taiga_list_issue_types...");
  const issueTypes = await listIssueTypes(slug);
  console.log(`  ${issueTypes.length} issue type(s)`);

  console.log("taiga_list_milestones...");
  const milestones = await listMilestones(slug);
  console.log(`  ${milestones.length} milestone(s)`);

  console.log("taiga_list_epics...");
  const epics = await listEpics(slug);
  const epicCount = Array.isArray(epics) ? epics.length : epics.items.length;
  console.log(`  ${epicCount} epic(s)`);

  console.log("taiga_create_project (smoke temp)...");
  const templateId = templates[0]?.id ?? 1;
  const created = await createProject({
    name: "MCP Smoke Temp",
    description: "auto-created by smoke-mcp-tools; safe to delete",
    templateId,
    isPrivate: true,
    isIssuesActivated: true
  });
  console.log(`  created slug=${created.slug} id=${created.id}`);
  await deleteProject(created.slug);
  console.log("  deleted temp project");

  console.log("taiga_upload_attachment (smoke)...");
  const story = await createUserStory(
    slug,
    "MCP attachment smoke",
    "Temporary story for attachment smoke test"
  );
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const fixturePath = join(repoRoot, "package.json");
  const attachment = await uploadAttachment(slug, "user_story", fixturePath, {
    projectSlug: slug,
    storyRef: story.ref
  });
  console.log(`  uploaded attachment id=${attachment.id} name=${attachment.name}`);
  await deleteAttachment("user_story", attachment.id);
  console.log("  deleted attachment");
  await deleteUserStory(story.id);
  console.log("  deleted temp story");

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
