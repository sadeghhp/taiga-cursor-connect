# Taiga Cursor Connect (MCP)

MCP server that connects [Cursor](https://cursor.com) to [Taiga](https://taiga.io) via the REST API. Runs in Docker; Cursor spawns the container over stdio.

## Tools (v0.5.0 — 46 tools)

### Discovery

| Tool | Description |
|------|-------------|
| `taiga_list_projects` | List projects (id, slug, name) |
| `taiga_get_project` | Project detail + modules (epics, issues, wiki) |
| `taiga_list_user_stories` | List stories; filters: `milestoneId`, `statusName`, `tags`, `epicId`, `page` |
| `taiga_list_tasks` | List tasks; filters + `userStoryId` |
| `taiga_list_issues` | List issues; filters + pagination |
| `taiga_list_epics` | List epics; filters + pagination |
| `taiga_list_milestones` | List sprints/milestones |
| `taiga_list_statuses` | Statuses for `user_story`, `task`, `issue`, `epic` |
| `taiga_list_members` | Members (`user_id` for assignee) |
| `taiga_list_points` | Story point scale |
| `taiga_search` | Full-text search in project |

### Read

| Tool | Description |
|------|-------------|
| `taiga_get_story` | Story + tasks + `points_by_role`; optional history |
| `taiga_get_story_history` | Story activity |
| `taiga_get_task` / `taiga_get_task_history` | Task detail / history |
| `taiga_get_issue` / `taiga_get_issue_history` | Issue detail / history |
| `taiga_get_epic` | Epic detail |

### Create

| Tool | Description |
|------|-------------|
| `taiga_create_milestone` | Create sprint (`slug`, dates) |
| `taiga_create_epic` | Create epic + `tags`, status, milestone |
| `taiga_create_story` | Create story + `epicId`, `tags`, `dueDate`, `estimateHours` |
| `taiga_create_task` | Create task + parent story, tags |
| `taiga_create_issue` | Create issue |

### Update / link / order

| Tool | Description |
|------|-------------|
| `taiga_update_milestone` | Name, dates, `closed` (gates) |
| `taiga_update_story` / `task` / `issue` / `epic` | Status, tags, blocked, `unassign`, milestone |
| `taiga_update_task` | Also `userStoryId` to move parent |
| `taiga_link_story_to_epic` / `taiga_unlink_story_from_epic` | Epic relations |
| `taiga_update_story_backlog_order` | JSON `[{storyRef, order}]` |
| `taiga_update_story_sprint_order` | Sprint board order |
| `taiga_set_story_blocked_by` | `blockedByThreadId` → blocked note |

### Comments

| Tool | Description |
|------|-------------|
| `taiga_comment_on_story` / `task` / `issue` / `epic` | Add comment |

### Bulk / archive / delete

| Tool | Description |
|------|-------------|
| `taiga_bulk_sync_tasks_csv` | Sync `plan/L5/tasks.csv`; `dryRun`, idempotency |
| `taiga_archive_*` | Soft-close story/task/epic/issue |
| `taiga_delete_*` | Hard delete (`confirm: true`) |

Exchange R1 bootstrap guide: [docs/exchange-r1-bootstrap.md](docs/exchange-r1-bootstrap.md)

### Identifiers

- **Ref** — number shown in the Taiga UI (`#42`).
- **Id** — internal Taiga database id (returned by get/create tools).

Most tools accept **either** id **or** `projectSlug` + ref. Updates accept `statusName`, `assignedToId`, `unassign: true`, comma-separated `tags`, `isBlocked`, `blockedNote`, and milestone fields. Pass `page` on list tools for paginated `{ items, total, page }` responses.

Writes use optimistic concurrency (`version` on PATCH) with automatic retry on version conflicts. HTTP 429 responses are retried with backoff.

`taiga_get_story` returns `points_by_role` (human-readable point names) in addition to raw `points` ids.

## Prerequisites

- Docker
- Taiga running at `http://localhost:9000` (or adjust URLs)
- At least one Taiga **project** and **user story**

## 1. Get a Taiga auth token

```bash
curl -s -X POST http://localhost:9000/api/v1/auth \
  -H "Content-Type: application/json" \
  -d '{"type":"normal","username":"admin","password":"YOUR_PASSWORD"}' \
  | jq -r '.auth_token'
```

Tokens expire; repeat login when you get HTTP 401.

## 2. Build the Docker image

Compile TypeScript on the host, then build the image (avoids npm issues inside Docker):

```bash
cd /path/to/taiga-cursor-connect
npm run docker:build
```

Or manually:

```bash
npm ci && npm run build && npm ci --omit=dev
docker build -t taiga-mcp:local .
```

The image copies host `node_modules` and `dist` (no `npm` inside Docker — avoids flaky in-container installs).

## 3. Configure Cursor MCP

Add to Cursor **Settings → MCP** (or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "taiga": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--add-host=host.docker.internal:host-gateway",
        "-e",
        "TAIGA_API_URL=http://host.docker.internal:9000/api/v1",
        "-e",
        "TAIGA_TOKEN=YOUR_AUTH_TOKEN_HERE",
        "taiga-mcp:local"
      ]
    }
  }
}
```

Replace `YOUR_AUTH_TOKEN_HERE` with your token.

Restart Cursor after saving. Check **Output → MCP** if the server fails to start.

On macOS, `host.docker.internal` usually works without `--add-host`; keep it for Linux compatibility.

## 4. Example prompts in Cursor

**Discover and fetch:**

```text
Use taiga_list_projects, then taiga_get_story for project <slug> story ref 1 with includeHistory true.
Summarize acceptance criteria and prior comments. Propose a plan; do not code until I approve.
```

**Search:**

```text
Use taiga_search on project <slug> with text "authentication" and open the best matching user story.
```

**Post progress (slug + ref, no id required):**

```text
Use taiga_comment_on_story with projectSlug <slug>, storyRef 1, and a short summary of what was implemented.
```

**Close a task:**

```text
Use taiga_update_task with projectSlug <slug>, taskRef 2, isClosed true.
Or set statusName to the exact label shown in Taiga (e.g. "Done").
```

## Recommended Taiga story format

```markdown
## User Story

As a user, I want … so that …

## Acceptance Criteria

- …

## Technical Notes

- Module: …
```

## Local development (without Docker)

```bash
cp .env.example .env
# Set TAIGA_API_URL=http://localhost:9000/api/v1 and TAIGA_TOKEN

npm install
npm run dev
```

Use `TAIGA_API_URL=http://localhost:9000/api/v1` when running on the host (not `host.docker.internal`).

## docker compose (optional)

```bash
cp .env.example .env
# Fill TAIGA_TOKEN

docker compose build
docker compose run --rm taiga-mcp
```

The process waits on stdio (normal for MCP).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Missing TAIGA_API_URL or TAIGA_TOKEN` | Pass `-e` flags in Cursor MCP config |
| HTTP 401 | Refresh token via `/auth` |
| Story not found | Check project **slug** (URL) and story **ref** (#number) |
| Status not found | Use exact Taiga status label for `statusName`, or pass `statusId` |
| Cannot reach Taiga from container | Ensure Taiga is on host port 9000; test: `docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl -s http://host.docker.internal:9000/api/v1/` |
| No projects | Create a project in Taiga UI first |
| MCP tools missing or no create tools | Rebuild image (`npm run docker:build`) and restart Cursor so MCP reloads tools |

## Testing

Unit tests use Node’s built-in test runner (`node:test`) via `tsx`. They do not call a live Taiga instance.

```bash
npm test
```

Optional live smoke (requires Taiga + token):

```bash
TAIGA_API_URL=http://localhost:9000/api/v1 TAIGA_TOKEN=... npx tsx scripts/smoke-mcp-tools.ts
```

For local iteration without rebuilding:

```bash
npm run test:watch
```

Coverage includes input validation (`schemas.ts`), response trimming, optimistic-concurrency retry logic, and status/milestone resolution (with a mocked HTTP client).

## Architecture

```text
Cursor IDE  --stdio-->  docker run -i taiga-mcp  --HTTP-->  Taiga :9000 (host)
```
