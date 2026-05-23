# Taiga Cursor Connect

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MCP server** that connects [Cursor](https://cursor.com) to [Taiga](https://taiga.io) over the REST API. Cursor spawns the server in Docker over stdio; the agent can list, read, create, and update backlog items without leaving the editor.

| | |
|---|---|
| **Protocol** | [Model Context Protocol](https://modelcontextprotocol.io) (stdio) |
| **Runtime** | Node 22 (Docker image or local `tsx`) |
| **Taiga** | Self-hosted or cloud; default `http://localhost:9000` |
| **Version** | 0.7.0 — **90 tools** |

## Why use this

- **Slug + ref workflow** — Most tools accept `projectSlug` and UI ref (`#42`) instead of internal Taiga ids.
- **Agent-friendly responses** — Trimmed JSON, human-readable `points_by_role`, paginated lists.
- **Safe writes** — Optimistic concurrency on PATCH with automatic retry on version conflicts; HTTP 429 backoff.
- **Plan-driven bulk import** — `taiga_bulk_sync_tasks_csv` syncs a CSV plan into stories/tasks with idempotency and `dryRun`.

## Quick start

1. **Token** — Log in to Taiga and copy `auth_token` (see [Get a Taiga auth token](#get-a-taiga-auth-token)).
2. **Image** — From the repo root: `npm run docker:build`
3. **Cursor** — Add the MCP block below to **Settings → MCP** (or `~/.cursor/mcp.json`), set `TAIGA_TOKEN`, restart Cursor.
4. **Try** — In chat: *“Use `taiga_list_projects` and summarize my projects.”*

```json
{
  "mcpServers": {
    "taiga": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e", "TAIGA_API_URL=http://host.docker.internal:9000/api/v1",
        "-e", "TAIGA_TOKEN=YOUR_AUTH_TOKEN_HERE",
        "-e", "TAIGA_MCP_LOG=info",
        "taiga-mcp:local"
      ]
    }
  }
}
```

Replace `YOUR_AUTH_TOKEN_HERE`. On macOS, `host.docker.internal` often works without `--add-host`; keep it for Linux.

Set `TAIGA_MCP_LOG=info` (optional) to see friendly tool-call logs on **stderr**. The MCP JSON-RPC stream uses **stdout** only — do not redirect stderr into stdout.

---

## Table of contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [Get a Taiga auth token](#get-a-taiga-auth-token)
  - [Build the Docker image](#build-the-docker-image)
  - [Configure Cursor MCP](#configure-cursor-mcp)
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

- [Docker](https://docs.docker.com/get-docker/)
- Taiga reachable at `http://localhost:9000` (or change URLs below)
- A Taiga auth token with permission to create projects (or an existing project)

## Setup

### Get a Taiga auth token

```bash
curl -s -X POST http://localhost:9000/api/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"type":"normal","username":"admin","password":"YOUR_PASSWORD"}' \
  | jq -r '.auth_token'
```

Tokens expire; repeat login when API calls return **HTTP 401**.

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

Add the [Quick start](#quick-start) JSON to Cursor. After saving, restart Cursor. If the server fails, check **Output → MCP**.

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
# TAIGA_TOKEN=<token>

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
        "TAIGA_TOKEN": "YOUR_AUTH_TOKEN_HERE"
      }
    }
  }
}
```

---

## Docker Compose

```bash
cp .env.example .env
# Set TAIGA_TOKEN

docker compose build
docker compose run --rm taiga-mcp
```

The process waits on stdio (normal for MCP). Prefer the [Cursor docker `run` config](#configure-cursor-mcp) for daily use.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TAIGA_API_URL` | Yes | API base, e.g. `http://host.docker.internal:9000/api/v1` in Docker |
| `TAIGA_TOKEN` | Yes | Bearer token from `POST /api/v1/auth` |
| `TAIGA_MCP_LOG` | No | MCP stderr logging: `off` (default), `info` (tool calls), or `debug` (+ HTTP retries) |

See [.env.example](.env.example). Never commit tokens to the repo.

---

## Testing

Unit tests use Node’s built-in runner (`node:test`) via `tsx`. They do **not** call a live Taiga instance.

```bash
npm test          # build + test
npm run test:watch
```

Optional live smoke (Taiga + token required):

```bash
npm run smoke
# or: TAIGA_API_URL=... TAIGA_TOKEN=... npx tsx scripts/smoke-mcp-tools.ts
```

Coverage includes Zod validation (`schemas.ts`), response trimming, optimistic-concurrency retry, and status/milestone resolution (mocked HTTP).

CI runs `npm test` on push and pull request (Node 22).

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Missing TAIGA_API_URL or TAIGA_TOKEN` | Set `-e` flags in MCP config or `.env` for local dev |
| HTTP 401 | Refresh token via `/auth` |
| Story not found | Confirm project **slug** (URL segment) and story **ref** |
| Status not found | Use exact Taiga label for `statusName`, or pass `statusId` |
| Cannot reach Taiga from container | Taiga on host port 9000; test: `docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl -s http://host.docker.internal:9000/api/v1/` |
| No projects | Use `taiga_create_project` or create in Taiga UI |
| Missing or stale tools | `npm run docker:build`, restart Cursor (reloads MCP tool list) |

---

## Security

- **`TAIGA_TOKEN`** grants API access within your Taiga permissions. Keep it in env vars or MCP config, not in git.
- **`taiga_bulk_sync_tasks_csv`** reads `csvPath` from the host (or paths visible in the container). Only pass trusted paths; a client with MCP access could trigger reads the process can open.
- **`taiga_upload_attachment`** reads `filePath` from the host the same way. Only pass trusted paths.
- Trust boundary: your machine, Docker mounts, and who can invoke MCP tools in Cursor.

---

## Architecture

```text
Cursor IDE  --stdio-->  docker run -i taiga-mcp  --HTTP-->  Taiga :9000 (host)
                              |
                         MCP SDK + Zod
                              |
                         taiga-client (axios)
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
| [docs/mcp-tool-catalog.md](docs/mcp-tool-catalog.md) | Alphabetic index of all 79 MCP tools |
| [docs/exchange-r1-bootstrap.md](docs/exchange-r1-bootstrap.md) | Milestone/epic/CSV bootstrap sequence |
| [docs/bulk-sync-example.md](docs/bulk-sync-example.md) | Bulk CSV sync prompts and output shape |

---

## License

[MIT](LICENSE) — Copyright (c) 2026 sadeghhp
