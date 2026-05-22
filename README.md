# Taiga Cursor Connect (MCP)

MCP server that connects [Cursor](https://cursor.com) to [Taiga](https://taiga.io) via the REST API. Runs in Docker; Cursor spawns the container over stdio.

## Tools

| Tool | Description |
|------|-------------|
| `taiga_list_projects` | List projects (id, slug, name) |
| `taiga_list_user_stories` | List user stories in a project (optional milestone filter) |
| `taiga_search` | Search user stories, tasks, epics, and issues in a project by text |
| `taiga_get_story` | Fetch a user story by **id** or slug+ref, tasks, `points_by_role`, optional history |
| `taiga_get_story_history` | Activity history for a story (by id or slug+ref) |
| `taiga_get_task` | Fetch a task by internal id or project slug + task ref |
| `taiga_get_task_history` | Activity history for a task (by id or slug+ref) |
| `taiga_get_issue` | Fetch an issue by internal id or project slug + issue ref |
| `taiga_get_issue_history` | Activity history for an issue (by id or slug+ref) |
| `taiga_create_story` | Create a user story in a project |
| `taiga_create_task` | Create a task (optional parent `userStoryId`) |
| `taiga_create_issue` | Create an issue in a project |
| `taiga_comment_on_story` | Add a comment (by story id or project slug + story ref) |
| `taiga_comment_on_task` | Add a comment (by task id or project slug + task ref) |
| `taiga_comment_on_issue` | Add a comment (by issue id or project slug + issue ref) |
| `taiga_update_story` | Update story: status, milestone, assignee, tags, blocked, subject, description |
| `taiga_update_task` | Update task: status, milestone, assignee, tags, blocked, subject, description |
| `taiga_update_issue` | Update issue: status, milestone, assignee, tags, blocked, subject, description |

### Identifiers

- **Ref** — number shown in the Taiga UI (`#42`).
- **Id** — internal Taiga database id (returned by get/create tools).

Most read/write tools accept **either** id **or** `projectSlug` + ref. Updates accept `statusName` (UI label) or `statusId`, plus optional `assignedToId`, comma-separated `tags`, `isBlocked`, `blockedNote`, and `milestoneSlug` / `milestoneId` (stories, tasks, issues).

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
| MCP tools missing | Restart Cursor; rebuild image: `npm run docker:build` |

## Testing

Unit tests use Node’s built-in test runner (`node:test`) via `tsx`. They do not call a live Taiga instance.

```bash
npm test
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
