/** Tool exposure tiers (see docs/tool-tier-configuration.md). */
export type ToolTier = "core" | "extended" | "advanced";

export const EXPECTED_TAIGA_TOOL_COUNT = 90;

export const ALL_TOOL_TIERS: readonly ToolTier[] = [
  "core",
  "extended",
  "advanced"
] as const;

const TIER_KEYWORDS: Record<string, ToolTier> = {
  core: "core",
  extended: "extended",
  advanced: "advanced"
};

/** Env token aliases (case-insensitive). */
const TIER_TOKEN_ALIASES: Record<string, ToolTier[] | "all"> = {
  default: ["core"],
  full: "all",
  all: "all"
};

/** Every MCP tool name → tier (90 tools). */
export const TOOL_TIER: Record<string, ToolTier> = {
  // core (38)
  taiga_list_projects: "core",
  taiga_get_project: "core",
  taiga_list_user_stories: "core",
  taiga_list_tasks: "core",
  taiga_list_issues: "core",
  taiga_list_epics: "core",
  taiga_list_milestones: "core",
  taiga_get_milestone: "core",
  taiga_list_statuses: "core",
  taiga_list_members: "core",
  taiga_list_points: "core",
  taiga_search: "core",
  taiga_get_story: "core",
  taiga_get_task: "core",
  taiga_get_issue: "core",
  taiga_get_epic: "core",
  taiga_create_story: "core",
  taiga_create_task: "core",
  taiga_create_issue: "core",
  taiga_create_epic: "core",
  taiga_update_story: "core",
  taiga_update_task: "core",
  taiga_update_issue: "core",
  taiga_update_epic: "core",
  taiga_comment_on_story: "core",
  taiga_comment_on_task: "core",
  taiga_comment_on_issue: "core",
  taiga_comment_on_epic: "core",
  taiga_link_story_to_epic: "core",
  taiga_unlink_story_from_epic: "core",
  taiga_get_kanban_board: "core",
  taiga_move_story_on_kanban: "core",
  taiga_update_story_kanban_order: "core",
  taiga_list_issue_types: "core",
  taiga_list_priorities: "core",
  taiga_list_severities: "core",
  taiga_list_project_tags: "core",
  taiga_create_project_tag: "core",

  // extended (39)
  taiga_list_project_templates: "extended",
  taiga_create_project: "extended",
  taiga_update_project: "extended",
  taiga_duplicate_project: "extended",
  taiga_create_milestone: "extended",
  taiga_update_milestone: "extended",
  taiga_list_roles: "extended",
  taiga_invite_member: "extended",
  taiga_get_story_history: "extended",
  taiga_get_task_history: "extended",
  taiga_get_issue_history: "extended",
  taiga_get_project_stats: "extended",
  taiga_get_project_issue_stats: "extended",
  taiga_edit_project_tag: "extended",
  taiga_archive_story: "extended",
  taiga_archive_task: "extended",
  taiga_archive_epic: "extended",
  taiga_archive_issue: "extended",
  taiga_bulk_sync_tasks_csv: "extended",
  taiga_update_story_backlog_order: "extended",
  taiga_update_story_sprint_order: "extended",
  taiga_set_story_blocked_by: "extended",
  taiga_create_user_story_status: "extended",
  taiga_update_user_story_status: "extended",
  taiga_delete_user_story_status: "extended",
  taiga_reorder_user_story_statuses: "extended",
  taiga_list_swimlanes: "extended",
  taiga_create_swimlane: "extended",
  taiga_update_swimlane: "extended",
  taiga_delete_swimlane: "extended",
  taiga_list_custom_attributes: "extended",
  taiga_get_custom_attribute_values: "extended",
  taiga_set_custom_attribute_values: "extended",
  taiga_list_wiki_pages: "extended",
  taiga_get_wiki_page: "extended",
  taiga_create_wiki_page: "extended",
  taiga_update_wiki_page: "extended",
  taiga_list_attachments: "extended",
  taiga_upload_attachment: "extended",

  // advanced (13)
  taiga_delete_project: "advanced",
  taiga_delete_story: "advanced",
  taiga_delete_task: "advanced",
  taiga_delete_epic: "advanced",
  taiga_delete_issue: "advanced",
  taiga_delete_project_tag: "advanced",
  taiga_delete_wiki_page: "advanced",
  taiga_delete_attachment: "advanced",
  taiga_list_webhooks: "advanced",
  taiga_create_webhook: "advanced",
  taiga_update_webhook: "advanced",
  taiga_delete_webhook: "advanced",
  taiga_test_webhook: "advanced"
};

export type ParseEnabledTiersResult = {
  /** Tiers after cumulative expansion (used for registration). */
  enabled: Set<ToolTier>;
  /** Tiers parsed from env before expansion. */
  requested: Set<ToolTier>;
  unknownTokens: string[];
};

let cachedEnabled: Set<ToolTier> | undefined;

/** Higher tiers implicitly include all lower tiers. */
export function expandEnabledTiers(enabled: Set<ToolTier>): Set<ToolTier> {
  const out = new Set(enabled);
  if (out.has("advanced")) {
    out.add("core");
    out.add("extended");
  } else if (out.has("extended")) {
    out.add("core");
  }
  return out;
}

function parseTierTokens(raw?: string): {
  requested: Set<ToolTier>;
  unknownTokens: string[];
} {
  const value = raw?.trim();
  if (!value) {
    return { requested: new Set(["core"]), unknownTokens: [] };
  }

  const lower = value.toLowerCase();
  if (lower === "all" || lower === "full") {
    return { requested: new Set(ALL_TOOL_TIERS), unknownTokens: [] };
  }

  const requested = new Set<ToolTier>();
  const unknownTokens: string[] = [];

  for (const part of value.split(",")) {
    const token = part.trim().toLowerCase();
    if (!token) continue;

    const alias = TIER_TOKEN_ALIASES[token];
    if (alias === "all") {
      for (const tier of ALL_TOOL_TIERS) requested.add(tier);
      continue;
    }
    if (alias) {
      for (const tier of alias) requested.add(tier);
      continue;
    }

    const tier = TIER_KEYWORDS[token];
    if (tier) {
      requested.add(tier);
    } else {
      unknownTokens.push(part.trim());
    }
  }

  if (requested.size === 0) {
    return { requested: new Set(["core"]), unknownTokens };
  }

  return { requested, unknownTokens };
}

/** Parse TAIGA_MCP_TOOL_TIERS (default: core only; higher tiers include lower). */
export function parseEnabledTiers(raw?: string): ParseEnabledTiersResult {
  const { requested, unknownTokens } = parseTierTokens(raw);
  return {
    requested,
    enabled: expandEnabledTiers(requested),
    unknownTokens
  };
}

/** Enabled tiers for this process (expanded; set when installToolLogging runs). */
export function getEnabledTiers(): Set<ToolTier> {
  if (!cachedEnabled) {
    cachedEnabled = resolveEnabledTiersFromEnv().enabled;
  }
  return cachedEnabled;
}

/** @internal Reset cache (tests). */
export function resetEnabledTiersCache(): void {
  cachedEnabled = undefined;
}

export function resolveEnabledTiersFromEnv(): ParseEnabledTiersResult {
  return parseEnabledTiers(process.env.TAIGA_MCP_TOOL_TIERS);
}

export function formatEnabledTiersLabel(enabled: Set<ToolTier>): string {
  const ordered = ALL_TOOL_TIERS.filter((t) => enabled.has(t));
  return ordered.join(",");
}

export function getToolTier(name: string): ToolTier | undefined {
  return TOOL_TIER[name];
}

/** Whether a tool should be registered for the current tier config. */
export function isToolTierEnabled(name: string, enabled: Set<ToolTier>): boolean {
  const tier = getToolTier(name);
  if (tier == null) return true;
  return enabled.has(tier);
}

export function countToolsInRegistryForTiers(enabled: Set<ToolTier>): number {
  return Object.values(TOOL_TIER).filter((tier) => enabled.has(tier)).length;
}

export function countToolsByTier(): Record<ToolTier, number> {
  const counts: Record<ToolTier, number> = {
    core: 0,
    extended: 0,
    advanced: 0
  };
  for (const tier of Object.values(TOOL_TIER)) {
    counts[tier] += 1;
  }
  return counts;
}

const SERVER_TOOL_NAME_RE =
  /(?:server\.tool\(\s*|^\s*)["'](taiga_[a-z_]+)["']/gm;

/** Extract `taiga_*` tool names registered in server.ts source. */
export function extractTaigaToolNamesFromServerSource(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(SERVER_TOOL_NAME_RE)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

export type ToolTierRegistryValidation = {
  serverTools: string[];
  missingInRegistry: string[];
  orphanRegistryKeys: string[];
};

/** Compare server.ts registrations to TOOL_TIER (for tests). */
export function validateToolTierRegistry(
  serverSource: string
): ToolTierRegistryValidation {
  const serverTools = extractTaigaToolNamesFromServerSource(serverSource);
  const registryKeys = new Set(Object.keys(TOOL_TIER));
  const serverSet = new Set(serverTools);

  const missingInRegistry = serverTools.filter((n) => !registryKeys.has(n));
  const orphanRegistryKeys = [...registryKeys]
    .filter((n) => !serverSet.has(n))
    .sort();

  return { serverTools, missingInRegistry, orphanRegistryKeys };
}
