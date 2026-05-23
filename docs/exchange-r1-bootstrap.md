# Exchange R1 — Taiga bootstrap via MCP

Bootstrap Taiga structure for Exchange R1 using **only** the `user-taiga` MCP server (no Taiga UI for routine setup).

## Prerequisites

- Taiga running and reachable (`TAIGA_API_URL`, `TAIGA_TOKEN` in MCP config)
- Docker image `taiga-mcp:0.6.0` (or latest local build)
- Test project slug (e.g. `mcp-test`) via `TAIGA_PROJECT_SLUG`, or create one with `taiga_create_project`

Rebuild after code changes:

```bash
npm run docker:build
```

Restart Cursor MCP.

## Bootstrap sequence

0. **New project (optional)** — `taiga_list_project_templates` → `taiga_create_project` with `templateId`, module flags → record slug in `.cursor/taiga-project.md`
1. **Discover project** — `taiga_get_project` with `projectSlug`
2. **Create milestones** — `taiga_create_milestone` for each subphase slug:
   - `P1-A-Data-Identity`, `P1-B-…`, … `P1-E-GoLive`
   - `estimatedStart` / `estimatedFinish` as `YYYY-MM-DD`
3. **Create epics** — `taiga_create_epic` with subjects `[M05-E03] …` and tags `module:M05,…`
4. **Bulk sync tasks** — `taiga_bulk_sync_tasks_csv` with `csvPath` to your `plan/L5/tasks.csv`
5. **Verify** — `taiga_list_user_stories` with `milestoneId` + `tags` filter
6. **Order backlog** — `taiga_update_story_backlog_order` with JSON orders by `thread_id`
7. **Close gates** — `taiga_update_milestone` with `closed: true` for gate milestones

## CSV conventions (`plan/L5/tasks.csv`)

| Column | Taiga mapping |
|--------|----------------|
| `thread_id` | Subject prefix `T00042 — {title}` + `<!-- thread:T00042 -->` in description |
| `title` | Story/task subject suffix |
| `module`, `subphase`, `gate` | Tags: `module:M05`, `subphase:A`, `gate:M1.1`, `thread:T00042` |
| `estimate_h` | Nearest story point on create (computable role) |
| `blocked_by` | Task `isBlocked` + `blockedNote` = thread id (after all rows created) |
| `taiga_story_ref` / `taiga_task_ref` | Idempotency: skip create if set |

## Bulk sync tool

`taiga_bulk_sync_tasks_csv`:

- `projectSlug` (required)
- `csvPath` (absolute or path readable inside MCP container)
- `dryRun: true` — validate parsing only
- `delayMs` — default 200 between API calls
- `milestoneSlugMap` — JSON `{"A":"P1-A-Data-Identity",…}`

Returns per-row `story_ref`, `task_ref`, and `csv_patch` for backfill.

## Limitations

- **No native dependency graph** — `blocked_by` uses `is_blocked` + `blocked_note`, not Gantt links
- **Epic link** — `POST /epics/{id}/related_userstories`; requires `is_epics_activated` on project
- **CSV path in Docker** — mount workspace into MCP container or use host-accessible path
- **Points** — `estimate_h` maps to nearest discrete point value, not fractional hours
- **Project module flags** — use `taiga_update_project` (`isEpicsActivated`, etc.), not `/projects/{id}/modules` (that endpoint is VCS integration only)

## Agent prompt example

See [bulk-sync-example.md](./bulk-sync-example.md).
