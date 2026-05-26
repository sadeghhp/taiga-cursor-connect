# Tool tiers — design and Cursor configuration

This document explains how to split the 90 Taiga MCP tools into **three importance tiers**, load only the tiers the user selects at **server startup**, and configure that from **Cursor MCP settings**.

## Why tiers?

- Fewer tools → smaller tool list in the model context → faster, more reliable tool choice.
- **Core** covers everyday backlog work (list, read, update, comment, search, Kanban moves).
- **Extended** adds project setup, metadata, archives, bulk CSV, swimlanes, wiki/attachments (non-destructive).
- **Advanced** adds destructive deletes, webhooks, and other high-risk or rare operations.

MCP registers tools **once per process**. Changing tiers requires **restarting** the MCP server (in Cursor: disable/re-enable the server or restart Cursor).

---

## Tier names and default

| # | Tier | Env keyword | Default |
|--:|------|-------------|---------|
| 1 | Most important (daily workflow) | `core` | **Yes** — loaded if `TAIGA_MCP_TOOL_TIERS` is unset |
| 2 | Project admin & power features | `extended` | No |
| 3 | Destructive & integrations | `advanced` | No |

**Environment variable:**

```bash
# Default — 38 tools
# (omit TAIGA_MCP_TOOL_TIERS)

TAIGA_MCP_TOOL_TIERS=extended                # 77 tools (core + extended)
TAIGA_MCP_TOOL_TIERS=advanced                # 90 tools (all tiers)
TAIGA_MCP_TOOL_TIERS=all                     # 90 tools (alias)
TAIGA_MCP_TOOL_TIERS=full                    # same as all
TAIGA_MCP_TOOL_TIERS=default                 # same as core
```

**Cumulative tiers:** requesting a higher tier automatically includes lower tiers.

| You set | Effective tiers | Tool count |
|---------|-----------------|----------:|
| *(unset)* / `default` / `core` | core | 38 |
| `extended` | core + extended | 77 |
| `advanced` / `all` / `full` | core + extended + advanced | 90 |

Parsing rules:

- Comma-separated, case-insensitive, trim whitespace.
- Unknown values → warning on stderr (or exit if `TAIGA_MCP_TOOL_TIERS_STRICT=true`).
- Empty / unset → `core` only.
- When expansion applies, stderr logs: `effective core,extended` (even if `TAIGA_MCP_LOG=off`).

---

## Tool assignment (90 tools)

### `core` (38 tools) — **default**

Discovery, read, create, update, comment, search, epic link, Kanban read/move.

| # | Tool |
|--:|------|
| 1 | `taiga_list_projects` |
| 2 | `taiga_get_project` |
| 3 | `taiga_list_user_stories` |
| 4 | `taiga_list_tasks` |
| 5 | `taiga_list_issues` |
| 6 | `taiga_list_epics` |
| 7 | `taiga_list_milestones` |
| 8 | `taiga_get_milestone` |
| 9 | `taiga_list_statuses` |
| 10 | `taiga_list_members` |
| 11 | `taiga_list_points` |
| 12 | `taiga_search` |
| 13 | `taiga_get_story` |
| 14 | `taiga_get_task` |
| 15 | `taiga_get_issue` |
| 16 | `taiga_get_epic` |
| 17 | `taiga_create_story` |
| 18 | `taiga_create_task` |
| 19 | `taiga_create_issue` |
| 20 | `taiga_create_epic` |
| 21 | `taiga_update_story` |
| 22 | `taiga_update_task` |
| 23 | `taiga_update_issue` |
| 24 | `taiga_update_epic` |
| 25 | `taiga_comment_on_story` |
| 26 | `taiga_comment_on_task` |
| 27 | `taiga_comment_on_issue` |
| 28 | `taiga_comment_on_epic` |
| 29 | `taiga_link_story_to_epic` |
| 30 | `taiga_unlink_story_from_epic` |
| 31 | `taiga_get_kanban_board` |
| 32 | `taiga_move_story_on_kanban` |
| 33 | `taiga_update_story_kanban_order` |
| 34 | `taiga_list_issue_types` |
| 35 | `taiga_list_priorities` |
| 36 | `taiga_list_severities` |
| 37 | `taiga_list_project_tags` |
| 38 | `taiga_create_project_tag` |

### `extended` (39 tools)

Project lifecycle (non-delete), histories, stats, milestones, invites, archives, bulk sync, ordering, Kanban column/swimlane admin, custom attributes, wiki & attachments (non-delete).

| # | Tool |
|--:|------|
| 1 | `taiga_list_project_templates` |
| 2 | `taiga_create_project` |
| 3 | `taiga_update_project` |
| 4 | `taiga_duplicate_project` |
| 5 | `taiga_create_milestone` |
| 6 | `taiga_update_milestone` |
| 7 | `taiga_list_roles` |
| 8 | `taiga_invite_member` |
| 9 | `taiga_get_story_history` |
| 10 | `taiga_get_task_history` |
| 11 | `taiga_get_issue_history` |
| 12 | `taiga_get_project_stats` |
| 13 | `taiga_get_project_issue_stats` |
| 14 | `taiga_edit_project_tag` |
| 15 | `taiga_archive_story` |
| 16 | `taiga_archive_task` |
| 17 | `taiga_archive_epic` |
| 18 | `taiga_archive_issue` |
| 19 | `taiga_bulk_sync_tasks_csv` |
| 20 | `taiga_update_story_backlog_order` |
| 21 | `taiga_update_story_sprint_order` |
| 22 | `taiga_set_story_blocked_by` |
| 23 | `taiga_create_user_story_status` |
| 24 | `taiga_update_user_story_status` |
| 25 | `taiga_delete_user_story_status` |
| 26 | `taiga_reorder_user_story_statuses` |
| 27 | `taiga_list_swimlanes` |
| 28 | `taiga_create_swimlane` |
| 29 | `taiga_update_swimlane` |
| 30 | `taiga_delete_swimlane` |
| 31 | `taiga_list_custom_attributes` |
| 32 | `taiga_get_custom_attribute_values` |
| 33 | `taiga_set_custom_attribute_values` |
| 34 | `taiga_list_wiki_pages` |
| 35 | `taiga_get_wiki_page` |
| 36 | `taiga_create_wiki_page` |
| 37 | `taiga_update_wiki_page` |
| 38 | `taiga_list_attachments` |
| 39 | `taiga_upload_attachment` |

### `advanced` (13 tools)

Hard deletes, webhooks, delete attachment/wiki/tag.

| # | Tool |
|--:|------|
| 1 | `taiga_delete_project` |
| 2 | `taiga_delete_story` |
| 3 | `taiga_delete_task` |
| 4 | `taiga_delete_epic` |
| 5 | `taiga_delete_issue` |
| 6 | `taiga_delete_project_tag` |
| 7 | `taiga_delete_wiki_page` |
| 8 | `taiga_delete_attachment` |
| 9 | `taiga_list_webhooks` |
| 10 | `taiga_create_webhook` |
| 11 | `taiga_update_webhook` |
| 12 | `taiga_delete_webhook` |
| 13 | `taiga_test_webhook` |

---

## How to implement in this repo

### 1. Tier registry (`src/tool-tiers.ts`)

```typescript
export type ToolTier = "core" | "extended" | "advanced";

export const TOOL_TIER: Record<string, ToolTier> = {
  taiga_list_projects: "core",
  taiga_delete_story: "advanced",
  // ... all 90 names
};

export function parseEnabledTiers(raw?: string): Set<ToolTier> {
  const value = raw?.trim();
  if (!value) return new Set(["core"]);
  if (value.toLowerCase() === "all")
    return new Set(["core", "extended", "advanced"]);
  const tiers = value.split(",").map((s) => s.trim().toLowerCase());
  // validate and return Set<ToolTier>
}
```

### Conditional registration (`src/mcp-log.ts`)

Extend the existing `installToolLogging` wrapper so every `server.tool()` call includes a tier:

```typescript
const enabled = parseEnabledTiers(process.env.TAIGA_MCP_TOOL_TIERS);

server.tool = ((name: string, tier: ToolTier, ...rest: unknown[]) => {
  if (!enabled.has(tier)) return; // skip registration
  registeredToolCount += 1;
  // ... existing logging wrap ...
}) as typeof server.tool;
```

Then change each registration from:

```typescript
server.tool("taiga_list_projects", {}, handler);
```

to:

```typescript
server.tool("taiga_list_projects", "core", {}, handler);
```

**Alternative (less invasive):** keep `server.tool(name, schema, handler)` and look up `TOOL_TIER[name]` inside the wrapper so only the registry file lists tiers.

### 3. Startup banner

Log enabled tiers and count (already have `toolCount` in `logReady`):

```text
[taiga-mcp] ✓ ready v0.7.0 · … · 38 tools · tiers=core · log=off
```

### Tests

- `parseEnabledTiers` unit tests (default, multi, `all`, invalid, cumulative expansion).
- `validateToolTierRegistry` ensures every `server.ts` tool is in `TOOL_TIER` (and no orphans).

### Docs

- `.env.example` — `TAIGA_MCP_TOOL_TIERS` examples
- `README.md` — migration note and Cursor examples
- `MCP_TOOLS.md` — tier column (regenerate: `npm run docs:mcp-tools` after adding tools)
- `CHANGELOG.md` — release notes

---

## Cursor MCP configuration

Cursor does **not** have a built-in “tool category” dropdown. You choose tiers by passing **environment variables** in the MCP server definition (`Settings → MCP` or `~/.cursor/mcp.json`). Restart or reload MCP after changes.

### Default — core only (~38 tools)

```json
{
  "mcpServers": {
    "taiga": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "TAIGA_API_URL=http://host.docker.internal:9000/api/v1",
        "-e", "TAIGA_USERNAME=YOUR_USERNAME",
        "-e", "TAIGA_PASSWORD=YOUR_PASSWORD",
        "taiga-mcp:local"
      ]
    }
  }
}
```

Omit `TAIGA_MCP_TOOL_TIERS` → server uses `core` only.

### Core + extended (77 tools)

```json
"-e", "TAIGA_MCP_TOOL_TIERS=core,extended"
```

Or in `env` block (local `npx tsx`):

```json
"env": {
  "TAIGA_API_URL": "http://localhost:9000/api/v1",
  "TAIGA_USERNAME": "YOUR_USERNAME",
  "TAIGA_PASSWORD": "YOUR_PASSWORD",
  "TAIGA_MCP_TOOL_TIERS": "core,extended"
}
```

### All tools (90)

```json
"-e", "TAIGA_MCP_TOOL_TIERS=all"
```

### Multiple MCP entries (different presets)

You can register **two servers** that point at the same image but different tiers — enable one or both in Cursor:

```json
{
  "mcpServers": {
    "taiga": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "TAIGA_API_URL=http://host.docker.internal:9000/api/v1",
        "-e", "TAIGA_USERNAME=YOUR_USERNAME",
        "-e", "TAIGA_PASSWORD=YOUR_PASSWORD",
        "-e", "TAIGA_MCP_TOOL_TIERS=core",
        "taiga-mcp:local"
      ]
    },
    "taiga-full": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "TAIGA_API_URL=http://host.docker.internal:9000/api/v1",
        "-e", "TAIGA_USERNAME=YOUR_USERNAME",
        "-e", "TAIGA_PASSWORD=YOUR_PASSWORD",
        "-e", "TAIGA_MCP_TOOL_TIERS=all",
        "taiga-mcp:local"
      ]
    }
  }
}
```

Use **one** entry for daily work; turn on `taiga-full` only when you need deletes or webhooks.

---

## Behavior notes

| # | Topic | Behavior |
|--:|-------|----------|
| 1 | When tiers apply | At process start only |
| 2 | Change tiers | Edit MCP config → restart MCP / Cursor |
| 3 | Agent calls disabled tool | Tool not in list — model cannot invoke it |
| 4 | Tier implies dependency | e.g. `core` includes `taiga_create_project_tag`; `extended` includes `taiga_edit_project_tag` |
| 5 | Security | `advanced` still requires `confirm: true` on deletes; tiers are not a permission boundary |

---

Restart the MCP server (or Cursor) after changing `TAIGA_MCP_TOOL_TIERS`.
