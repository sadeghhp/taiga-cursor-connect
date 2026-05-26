# Taiga Cursor Connect

### MCP server for [Taiga](https://taiga.io)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Taiga Cursor Connect** is a [Model Context Protocol](https://modelcontextprotocol.io) (**MCP**) server for **Taiga** — the open-source agile project management platform (user stories, tasks, issues, epics, Kanban, sprints). It exposes Taiga’s REST API as MCP **tools** so AI clients such as [Cursor](https://cursor.com) can manage your backlog from chat without opening the Taiga web UI.

This repository is **not** Taiga itself. It is the **bridge**: a small Node process (Docker or local) that Cursor launches over stdio. The agent calls tools like `taiga_list_projects`, `taiga_get_story`, and `taiga_update_task` against your Taiga instance (self-hosted or cloud).

| | |
|---|---|
| **What** | MCP server for Taiga (`taiga-mcp`) |
| **Works with** | [Cursor](https://cursor.com) and any MCP client over stdio |
| **Taiga API** | REST v1 — self-hosted or [Taiga Cloud](https://taiga.io) |
| **Protocol** | [MCP](https://modelcontextprotocol.io) (stdio) |
| **Runtime** | Node 22 (Docker image or local `tsx`) |
| **Tools** | 90 Taiga operations (default **38** via `core` tier) |
| **Version** | 0.7.0 |

## Why use this Taiga MCP server

- **Slug + ref workflow** — Most tools accept `projectSlug` and UI ref (`#42`) instead of internal Taiga ids.
- **Agent-friendly responses** — Trimmed JSON, human-readable `points_by_role`, paginated lists.
- **Safe writes** — Optimistic concurrency on PATCH with automatic retry on version conflicts; HTTP 429 backoff.
- **Auto-auth** — Log in with username/password or legacy tokens; access tokens refresh on 401 without manual copy-paste.
- **Plan-driven bulk import** — `taiga_bulk_sync_tasks_csv` syncs a CSV plan into stories/tasks with idempotency and `dryRun`.
- **Tool tiers** — Expose `core` (38 tools) by default, or enable `extended` / `advanced` via `TAIGA_MCP_TOOL_TIERS` in MCP config.

## Quick start

Connect **Taiga → MCP server → Cursor** in four steps:

1. **Taiga credentials** — Username/password or API token for your Taiga instance (see [Authentication](#authentication)).
2. **Build the MCP server image** — `npm run docker:build` (packages this Taiga MCP server for Docker).
3. **Register in Cursor** — Add the server under **Settings → MCP** (or `~/.cursor/mcp.json`), then restart Cursor.
4. **Try in chat** — *“Use `taiga_list_projects` and summarize my Taiga projects.”*

The MCP entry name (`taiga` below) is arbitrary; it is the label Cursor shows for this Taiga MCP server.

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
        "-e", "TAIGA_MCP_LOG=info",
        "taiga-mcp:local"
      ]
    }
  }
}
```

On macOS, `host.docker.internal` often works without `--add-host`; keep it for Linux.

Set `TAIGA_MCP_LOG=info` (optional) to see friendly tool-call logs on **stderr**. The MCP JSON-RPC stream uses **stdout** only — do not redirect stderr into stdout.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [Authentication](#authentication)
  - [Build the Docker image](#build-the-docker-image)
  - [Configure Cursor MCP](#configure-cursor-mcp)
- [Tool tiers](#tool-tiers)
- [Example prompts](#example-prompts)
- [MCP tools reference](#mcp-tools-reference)
- [Identifiers and conventions](#identifiers-and-conventions)
- [Recommended story format](#recommended-story-format)
- [Local development](#local-development)
- [Docker Compose](#docker-compose)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [License](#license)

---

## Prerequisites

You need a **running Taiga instance** and a way to run this **MCP server**:

- **Taiga** — Self-hosted (e.g. `http://localhost:9000`) or Taiga Cloud; the MCP server only talks to Taiga’s API
- **Taiga account** — Credentials with access to the projects you want the agent to manage
- **[Docker](https://docs.docker.com/get-docker/)** — Recommended for Cursor (or Node 22 for [local dev](#local-development))

## Setup

### Authentication

The connector authenticates on startup and **refreshes tokens automatically** when the API returns **401**.

**Recommended — username and password** (no manual token copy):

| Variable | Description |
|----------|-------------|
| `TAIGA_API_URL` | API base, e.g. `http://host.docker.internal:9000/api/v1` |
| `TAIGA_USERNAME` | Taiga username or email |
| `TAIGA_PASSWORD` | Taiga password |

If both username and `TAIGA_TOKEN` are set, **login wins**.

**Legacy — static token** (CI or when you prefer not to store a password):

| Variable | Description |
|----------|-------------|
| `TAIGA_TOKEN` | Bearer `auth_token` from `POST /api/v1/auth` |
| `TAIGA_REFRESH_TOKEN` | Optional; enables auto-refresh on 401 without password |

Obtain tokens once for the legacy path:

```bash
curl -s -X POST http://localhost:9000/api/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"type":"normal","username":"admin","password":"YOUR_PASSWORD"}' \
  | jq '{auth_token, refresh}'
```

### Build the Docker image

TypeScript is compiled on the host, then copied into the image (avoids flaky `npm` inside Docker):

```bash
cd /path/to/taiga-cursor-connect
npm run docker:build
```

Manual equivalent:

```bash
npm ci && npm run build && npm ci --omit=dev
docker build -t taiga-mcp:local .
```

The image uses prebuilt `node_modules` and `dist` from the host — no install step in the Dockerfile.

### Configure Cursor MCP

Register this **Taiga MCP server** in Cursor using the [Quick start](#quick-start) JSON. Cursor will spawn `taiga-mcp:local` and list its Taiga tools in the agent. After saving, restart Cursor. If the server fails, check **Output → MCP**.

---

## Tool tiers

Taiga Cursor Connect registers **90 MCP tools**. To keep the agent focused, those tools are split into three **tiers** (`core`, `extended`, `advanced`). You choose which tiers to load in Cursor; tools from disabled tiers are not offered to the model at all.

### Why tiers exist

- **Smaller tool list** — The model picks tools more reliably when it sees dozens of names instead of ninety.
- **Safer defaults** — Destructive operations (hard delete, webhooks) live in **advanced**, which is off unless you opt in.
- **Flexible setups** — Use **core** for daily work, add **extended** when bootstrapping projects or running bulk CSV sync, enable **advanced** only when you need deletes or integrations.

Tiers are **not** a Taiga permission system. They only control what the MCP server exposes to Cursor. Your Taiga user still needs API rights for whatever you call.

### How tiers work

1. On startup, the server reads **`TAIGA_MCP_TOOL_TIERS`** from the environment.
2. Each tool is assigned to exactly one tier (see [MCP_TOOLS.md](MCP_TOOLS.md)).
3. Tools in enabled tiers are registered with MCP; the rest are skipped.
4. The list does **not** change until you restart the MCP process.

**Cumulative tiers:** higher tiers automatically include lower ones.

| You set | What loads | Tool count |
|---------|------------|------------|
| *(nothing)* / `default` / `core` | **core** only | 38 |
| `extended` | **core** + **extended** | 77 |
| `advanced` | **core** + **extended** + **advanced** | 90 |
| `all` or `full` | Same as **advanced** | 90 |

You can still list tiers explicitly (e.g. `core,extended`); behavior is the same as `extended` alone.

### The three tiers

#### `core` (38 tools) — default

Everyday backlog work: discover projects, list and read stories/tasks/issues/epics, search, create and update work items, comment, link stories to epics, Kanban board read/move/reorder, and basic metadata (statuses, members, points, issue types, tags).

Typical tools: `taiga_list_projects`, `taiga_get_story`, `taiga_update_task`, `taiga_comment_on_story`, `taiga_search`, `taiga_move_story_on_kanban`.

Omitted unless you enable a higher tier: project creation, bulk CSV, archives, swimlane admin, wiki, attachments, hard deletes, webhooks.

#### `extended` (39 additional tools → 77 total)

Project and board administration without permanent delete: create/update/duplicate projects, milestones, member invites, activity histories, stats, archives, `taiga_bulk_sync_tasks_csv`, backlog/sprint ordering, Kanban column and swimlane CRUD, custom attributes, wiki pages, and file uploads.

Typical tools: `taiga_create_project`, `taiga_bulk_sync_tasks_csv`, `taiga_archive_story`, `taiga_upload_attachment`, `taiga_create_wiki_page`.

Requires **core** (included automatically when you set `extended`).

#### `advanced` (13 additional tools → 90 total)

High-impact operations: hard delete for projects, stories, tasks, epics, issues, tags, wiki pages, and attachments; full webhook CRUD and test.

Typical tools: `taiga_delete_story`, `taiga_delete_project`, `taiga_create_webhook`, `taiga_test_webhook`.

Requires **core** and **extended** (included automatically when you set `advanced`).

### Configure tiers in Cursor

Cursor does not provide a separate “tool tier” picker. Set the environment variable **`TAIGA_MCP_TOOL_TIERS`** on your MCP server in **Settings → MCP** or `~/.cursor/mcp.json`.

| Your goal | Value |
|-----------|--------|
| Default — daily Taiga work in chat | *(omit variable)* |
| Same as default | `default` or `core` |
| Projects, bulk import, wiki, attachments | `extended` |
| Everything including delete & webhooks | `advanced`, `all`, or `full` |

**Docker** — add a line to `args`:

```json
"-e", "TAIGA_MCP_TOOL_TIERS=extended"
```

**Full Docker example:**

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
        "-e", "TAIGA_MCP_TOOL_TIERS=extended",
        "taiga-mcp:local"
      ]
    }
  }
}
```

**Local dev** (`npx tsx`) — use `env`:

```json
"env": {
  "TAIGA_API_URL": "http://localhost:9000/api/v1",
  "TAIGA_USERNAME": "YOUR_USERNAME",
  "TAIGA_PASSWORD": "YOUR_PASSWORD",
  "TAIGA_MCP_TOOL_TIERS": "extended"
}
```

Optional: set `TAIGA_MCP_TOOL_TIERS_STRICT=true` to exit on typos in tier names instead of logging a warning.

### After changing tiers

1. Save MCP settings.
2. **Restart** the MCP server (toggle off/on in Cursor, or restart the IDE).

Verify with `TAIGA_MCP_LOG=info` — stderr shows something like:

```text
[taiga-mcp] ✓ ready v0.7.0 · http://host.docker.internal:9000/api/v1 · 77 tools · tiers=core,extended · log=info
```

### Upgrading from builds without tiers

Older images registered **all 90 tools** with no configuration. To restore that:

```json
"-e", "TAIGA_MCP_TOOL_TIERS=all"
```

Restart Cursor after changing MCP config. Details: [CHANGELOG.md](CHANGELOG.md).

### Two MCP servers (optional)

Run two entries against the same Docker image and enable the one you need:

| MCP name | `TAIGA_MCP_TOOL_TIERS` | When to use |
|----------|-------------------------|-------------|
| `taiga` | *(omit)* or `core` | Normal development |
| `taiga-full` | `all` | Deletes, webhooks, or full tool catalog |

Further reference: [MCP_TOOLS.md](MCP_TOOLS.md) (every tool + tier), [docs/tool-tier-configuration.md](docs/tool-tier-configuration.md) (design and edge cases).

---

## Example prompts

**Bootstrap a new project**

```text
Use taiga_list_project_templates, then taiga_create_project with templateId, name, description,
isEpicsActivated true, isIssuesActivated true. Write .cursor/taiga-project.md with the returned slug.
```

**Discover and fetch**

```text
Use taiga_list_projects, then taiga_get_story for project <slug> story ref 1 with includeHistory true.
Summarize acceptance criteria and prior comments. Propose a plan; do not code until I approve.
```

**Search**

```text
Use taiga_search on project <slug> with text "authentication" and open the best matching user story.
```

**Post progress (slug + ref)**

```text
Use taiga_comment_on_story with projectSlug <slug>, storyRef 1, and a short summary of what was implemented.
```

**Close a task**

```text
Use taiga_update_task with projectSlug <slug>, taskRef 2, isClosed true.
Or set statusName to the exact label shown in Taiga (e.g. "Done").
```

**Bulk plan sync**

```text
Use taiga_bulk_sync_tasks_csv with projectSlug <slug>, csvPath /absolute/path/to/plan/L5/tasks.csv, dryRun true.
Review the result; if correct, run again with dryRun false.
```

**Kanban board**

```text
Use taiga_get_kanban_board with projectSlug <slug> to snapshot columns and cards.
Use taiga_move_story_on_kanban with storyRef 12 and statusName Done to move a card.
Use taiga_update_story_kanban_order with orders JSON to reorder within a column.
Use taiga_create_user_story_status to add a WIP-limited column.
Use taiga_list_swimlanes when the Taiga instance supports swimlanes.
```

See [docs/bulk-sync-example.md](docs/bulk-sync-example.md) for CSV shape and idempotency.

---

## MCP tools reference

The tables below describe all **90** tools. Which ones Cursor can call depends on [tool tiers](#tool-tiers) and `TAIGA_MCP_TOOL_TIERS`. By default only **core** (38 tools) is registered.

### Discovery (18)

| Tool | Description |
|------|-------------|
| `taiga_list_projects` | List projects (id, slug, name) |
| `taiga_get_project` | Project detail + module flags |
| `taiga_list_project_templates` | Scrum/Kanban templates for `taiga_create_project` |
| `taiga_list_user_stories` | Stories; filters: `milestoneId`, `statusName`, `tags`, `epicId`, `page` |
| `taiga_list_tasks` | Tasks; filters + `userStoryId` |
| `taiga_list_issues` | Issues; filters + pagination |
| `taiga_list_epics` | Epics; filters + pagination |
| `taiga_list_milestones` | Sprints / milestones |
| `taiga_get_milestone` | Single milestone by slug or id |
| `taiga_list_statuses` | Statuses for `user_story`, `task`, `issue`, `epic`; user-story rows include `order`, `color`, `wip_limit` |
| `taiga_list_members` | Members (`user_id` for assignee) |
| `taiga_list_roles` | Project roles (for invites) |
| `taiga_list_points` | Story point scale |
| `taiga_list_issue_types` | Issue types (Bug, Question, …) |
| `taiga_list_priorities` | Issue priorities |
| `taiga_list_severities` | Issue severities |
| `taiga_list_project_tags` | Project tag colors |
| `taiga_search` | Full-text search in a project |

### Read (9)

| Tool | Description |
|------|-------------|
| `taiga_get_story` | Story + tasks + `points_by_role`; optional history |
| `taiga_get_story_history` | Story activity |
| `taiga_get_task` / `taiga_get_task_history` | Task detail / history |
| `taiga_get_issue` / `taiga_get_issue_history` | Issue detail / history |
| `taiga_get_epic` | Epic detail |
| `taiga_get_project_stats` / `taiga_get_project_issue_stats` | Trimmed project metrics |
| `taiga_get_wiki_page` | Wiki page by slug |
| `taiga_list_custom_attributes` | Custom attribute definitions per entity type |
| `taiga_get_custom_attribute_values` | Values on a story/task/issue/epic |

### Create (11)

| Tool | Description |
|------|-------------|
| `taiga_create_project` | New project from template + module flags |
| `taiga_duplicate_project` | Clone project structure |
| `taiga_create_milestone` | Sprint (`slug`, dates) |
| `taiga_create_epic` | Epic + tags, status, milestone |
| `taiga_create_story` | Story + `epicId`, `tags`, `dueDate`, `estimateHours` |
| `taiga_create_task` | Task + parent story, tags |
| `taiga_create_issue` | Issue + optional type/priority/severity by name or id |
| `taiga_create_project_tag` | Tag with optional HEX color |
| `taiga_create_wiki_page` | Wiki page (requires wiki module) |
| `taiga_create_webhook` | Outbound webhook |
| `taiga_invite_member` | Invite user by username/email + role |

### Update, link, and order (14)

| Tool | Description |
|------|-------------|
| `taiga_update_project` | Name, description, module flags, privacy |
| `taiga_update_milestone` | Name, dates, `closed` (gates) |
| `taiga_update_story` / `task` / `issue` / `epic` | Status, tags, blocked, `unassign`, milestone |
| `taiga_update_issue` | Also `typeName`/`priorityName`/`severityName` (or ids) |
| `taiga_update_task` | Also `userStoryId` to reparent |
| `taiga_edit_project_tag` | Rename/recolor tag |
| `taiga_set_custom_attribute_values` | Patch entity custom attribute values |
| `taiga_update_wiki_page` | Wiki subject/content |
| `taiga_update_webhook` | Webhook name, url, active |
| `taiga_link_story_to_epic` / `taiga_unlink_story_from_epic` | Epic relations |
| `taiga_update_story_backlog_order` | JSON `[{storyRef, order}]` |
| `taiga_update_story_sprint_order` | Sprint board order |
| `taiga_update_story_kanban_order` | Kanban card order within columns |
| `taiga_move_story_on_kanban` | One-shot status, swimlane, and/or kanban order |
| `taiga_set_story_blocked_by` | `blockedByThreadId` → blocked note |

### Kanban (11)

| Tool | Description |
|------|-------------|
| `taiga_get_kanban_board` | Snapshot: columns, cards, swimlanes; filters `includeClosed`, `swimlaneId` |
| `taiga_update_story_kanban_order` | Bulk kanban card order |
| `taiga_move_story_on_kanban` | Move card: status and/or swimlane and/or order |
| `taiga_create_user_story_status` | New Kanban column with optional WIP limit |
| `taiga_update_user_story_status` | Update column by id or name |
| `taiga_delete_user_story_status` | Delete column by id |
| `taiga_reorder_user_story_statuses` | Bulk column order |
| `taiga_list_swimlanes` | List swimlanes or `supported: false` |
| `taiga_create_swimlane` | Create swimlane |
| `taiga_update_swimlane` | Rename/reorder swimlane |
| `taiga_delete_swimlane` | Delete swimlane; optional `moveToSwimlaneId` |

Swimlanes require a Taiga backend that exposes `/api/v1/swimlanes`; the MCP feature-detects and degrades gracefully when absent.

### Comments (4)

| Tool | Description |
|------|-------------|
| `taiga_comment_on_story` / `task` / `issue` / `epic` | Add comment |

### Attachments (3)

| Tool | Description |
|------|-------------|
| `taiga_list_attachments` | List attachments on story/task/issue/epic/wiki |
| `taiga_upload_attachment` | Upload file from host `filePath` (multipart) |
| `taiga_delete_attachment` | Delete by attachment id |

### Bulk, archive, delete (11)

| Tool | Description |
|------|-------------|
| `taiga_bulk_sync_tasks_csv` | Sync `plan/L5/tasks.csv`; `dryRun`, idempotency |
| `taiga_archive_*` | Soft-close story / task / epic / issue |
| `taiga_delete_*` | Hard delete entity (`confirm: true`) |
| `taiga_delete_project` | Hard delete project (`confirm: true`) |
| `taiga_delete_project_tag` | Remove project tag |
| `taiga_delete_wiki_page` | Delete wiki page |
| `taiga_delete_webhook` | Delete webhook (`confirm: true`) |

### Webhooks (1)

| Tool | Description |
|------|-------------|
| `taiga_test_webhook` | Send test payload to webhook URL |

### Wiki list (1)

| Tool | Description |
|------|-------------|
| `taiga_list_wiki_pages` | List wiki pages in project |

---

## Identifiers and conventions

| Term | Meaning |
|------|---------|
| **Ref** | Number in the Taiga UI (`#42`) |
| **Id** | Internal Taiga database id (from get/create tools) |

Most tools accept **either** id **or** `projectSlug` + ref.

**Common update fields:** `statusName`, `assignedToId`, `unassign: true`, comma-separated `tags`, `isBlocked`, `blockedNote`, milestone fields. List tools accept `page` and return `{ items, total, page }`.

`taiga_get_story` includes `points_by_role` (readable point names) alongside raw `points` ids.

---

## Recommended story format

Structured descriptions help agents parse acceptance criteria:

```markdown
## User Story

As a user, I want … so that …

## Acceptance Criteria

- …

## Technical Notes

- Module: …
```

---

## Local development

Without Docker:

```bash
cp .env.example .env
# TAIGA_API_URL=http://localhost:9000/api/v1
# TAIGA_USERNAME=admin
# TAIGA_PASSWORD=<password>
# or: TAIGA_TOKEN=<token>

npm install
npm run dev
```

Use `http://localhost:9000/api/v1` on the host — not `host.docker.internal`.

Production-style run after build:

```bash
npm run build && npm start
```

Wire Cursor to stdio directly (example):

```json
{
  "mcpServers": {
    "taiga": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/taiga-cursor-connect/src/server.ts"],
      "env": {
        "TAIGA_API_URL": "http://localhost:9000/api/v1",
        "TAIGA_USERNAME": "YOUR_USERNAME",
        "TAIGA_PASSWORD": "YOUR_PASSWORD"
      }
    }
  }
}
```

---

## Docker Compose

```bash
cp .env.example .env
# Set TAIGA_USERNAME + TAIGA_PASSWORD, or TAIGA_TOKEN

docker compose build
docker compose run --rm taiga-mcp
```

The process waits on stdio (normal for MCP). Prefer the [Cursor docker `run` config](#configure-cursor-mcp) for daily use.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TAIGA_API_URL` | Yes | API base, e.g. `http://host.docker.internal:9000/api/v1` in Docker |
| `TAIGA_USERNAME` | Yes* | Taiga username or email (login mode) |
| `TAIGA_PASSWORD` | Yes* | Taiga password (login mode) |
| `TAIGA_TOKEN` | Yes* | Bearer `auth_token` (token mode) |
| `TAIGA_REFRESH_TOKEN` | No | Refresh token for auto-renewal on 401 in token mode |
| `TAIGA_MCP_LOG` | No | MCP stderr logging: `off` (default), `info` (tool calls), or `debug` (+ HTTP retries) |
| `TAIGA_MCP_TOOL_TIERS` | No | Tiers: `core` (default), `extended`, `advanced`; aliases `default`, `all`, `full`. Higher tiers include lower. Comma-separated to combine explicitly. |
| `TAIGA_MCP_TOOL_TIERS_STRICT` | No | If `true`/`1`, exit on unknown tier names in `TAIGA_MCP_TOOL_TIERS` |

\* Provide **either** `TAIGA_USERNAME` + `TAIGA_PASSWORD` **or** `TAIGA_TOKEN`.

See [.env.example](.env.example). Never commit credentials or tokens to the repo.

---

## Testing

Unit tests use Node’s built-in runner (`node:test`) via `tsx`. They do **not** call a live Taiga instance.

```bash
npm test          # build + test
npm run test:watch
```

Optional live smoke (Taiga + credentials required):

```bash
npm run smoke
# or: TAIGA_API_URL=... TAIGA_USERNAME=... TAIGA_PASSWORD=... npx tsx scripts/smoke-mcp-tools.ts
```

Coverage includes Zod validation (`schemas.ts`), response trimming, optimistic-concurrency retry, and status/milestone resolution (mocked HTTP).

CI runs `npm test` on push and pull request (Node 22).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Missing Taiga credentials` | Set `TAIGA_USERNAME`+`TAIGA_PASSWORD` or `TAIGA_TOKEN` in MCP config / `.env` |
| `TAIGA_PASSWORD is required when TAIGA_USERNAME is set` | Set both username and password, or remove `TAIGA_USERNAME` and use `TAIGA_TOKEN` only |
| `TAIGA_USERNAME is required when TAIGA_PASSWORD is set` | Set both env vars, or remove `TAIGA_PASSWORD` |
| HTTP 401 / auth errors at startup | Invalid `TAIGA_TOKEN` — fix token or use login mode; with token mode, add `TAIGA_REFRESH_TOKEN` |
| HTTP 401 / auth errors during use | With login mode, check username/password; with token mode, add `TAIGA_REFRESH_TOKEN` or switch to login mode |
| Story not found | Confirm project **slug** (URL segment) and story **ref** |
| Status not found | Use exact Taiga label for `statusName`, or pass `statusId` |
| Cannot reach Taiga from container | Taiga on host port 9000; test: `docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl -s http://host.docker.internal:9000/api/v1/` |
| No projects | Use `taiga_create_project` or create in Taiga UI |
| Missing or stale tools | `npm run docker:build`, restart Cursor (reloads MCP tool list) |
| Fewer tools than before (e.g. no delete/webhook) | Default is `core` only; set `TAIGA_MCP_TOOL_TIERS=all` for all 90 tools |
| Agent cannot find a tool | Enable its tier (`extended` or `advanced`) or use `all`; restart MCP |

---

## Security

- **Credentials** (`TAIGA_PASSWORD`, `TAIGA_TOKEN`, `TAIGA_REFRESH_TOKEN`) grant API access within your Taiga permissions. They live in MCP config or `.env` as plaintext—do not commit them to git. Prefer username/password only on trusted machines; token+refresh avoids storing a password.
- **`taiga_bulk_sync_tasks_csv`** reads `csvPath` from the host (or paths visible in the container). Only pass trusted paths; a client with MCP access could trigger reads the process can open.
- **`taiga_upload_attachment`** reads `filePath` from the host the same way. Only pass trusted paths.
- Trust boundary: your machine, Docker mounts, and who can invoke MCP tools in Cursor.

---

## Architecture

This repo implements the **Taiga MCP server** (`taiga-mcp`). It does not run Taiga; it proxies MCP tool calls to your existing Taiga API.

```text
Cursor (MCP client)
    |  stdio — MCP tools e.g. taiga_get_story
    v
Taiga MCP server (this repo — Docker image taiga-mcp:local)
    |  HTTPS — Taiga REST API /api/v1
    v
Taiga (your instance — stories, tasks, issues, Kanban, …)
```

```text
src/
  server.ts           MCP tool definitions
  taiga-client.ts   Core Taiga REST calls
  projects.ts       Project lifecycle (create, update, duplicate)
  metadata.ts       Issue types, priorities, severities, roles
  memberships.ts    Member invites
  tags.ts           Project tags and stats
  custom-attributes.ts  Custom attribute defs and values
  wiki.ts           Wiki CRUD
  attachments.ts    File attachments (multipart)
  webhooks.ts       Webhook CRUD and test
  schemas.ts        Input validation
  plan-sync.ts      CSV bulk sync
  patch-builders.ts, resolvers.ts, trimmers.ts
```

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/Taiga REST API.md](docs/Taiga%20REST%20API.md) | Taiga API notes used by this server |
| [MCP_TOOLS.md](MCP_TOOLS.md) | Alphabetic table of all 90 MCP tools with descriptions |
| [docs/mcp-tool-catalog.md](docs/mcp-tool-catalog.md) | Category-grouped tool index (links to MCP_TOOLS.md) |
| [docs/tool-tier-configuration.md](docs/tool-tier-configuration.md) | Tool tiers (`core` / `extended` / `advanced`) and Cursor config |
| [CHANGELOG.md](CHANGELOG.md) | Release notes (tier default change in 0.7.0) |
| [docs/exchange-r1-bootstrap.md](docs/exchange-r1-bootstrap.md) | Milestone/epic/CSV bootstrap sequence |
| [docs/bulk-sync-example.md](docs/bulk-sync-example.md) | Bulk CSV sync prompts and output shape |

---

## License

[MIT](LICENSE) — Copyright (c) 2026 sadeghhp
