# Taiga MCP Server — Tools Reference

This document lists every tool exposed by the **Taiga Cursor Connect** MCP server ([`src/server.ts`](src/server.ts)). Tools are registered at server startup and invoked by Cursor (or any MCP client) over stdio.

**Total tools:** 90 · **Version:** 0.7.0 · **Default exposed:** 38 (`core` tier)

Configure tiers with `TAIGA_MCP_TOOL_TIERS` — see [docs/tool-tier-configuration.md](docs/tool-tier-configuration.md).

| Tier | Tools in tier | Loaded when |
|------|-------------:|-------------|
| `core` | 38 | Default (omit env var), `default`, or `core` |
| `extended` | 39 | `extended` (includes core → **77** total) |
| `advanced` | 13 | `advanced`, `all`, or `full` (includes all → **90** total) |

Most tools accept `projectSlug` and UI **ref** (`#42`) instead of internal Taiga ids. See the [main README](README.md) for setup, authentication, and usage examples.

---

## All tools (alphabetical)

| # | Tool | Tier | Description |
|--:|------|------|-------------|
| 1 | `taiga_archive_epic` | extended | Soft-close (archive) an epic by slug + ref or id |
| 2 | `taiga_archive_issue` | extended | Soft-close (archive) an issue by slug + ref or id |
| 3 | `taiga_archive_story` | extended | Soft-close (archive) a user story by slug + ref or id |
| 4 | `taiga_archive_task` | extended | Soft-close (archive) a task by slug + ref or id |
| 5 | `taiga_bulk_sync_tasks_csv` | extended | Sync a plan CSV into stories/tasks with idempotency and optional `dryRun` |
| 6 | `taiga_comment_on_epic` | core | Add a comment to an epic |
| 7 | `taiga_comment_on_issue` | core | Add a comment to an issue |
| 8 | `taiga_comment_on_story` | core | Add a comment to a user story |
| 9 | `taiga_comment_on_task` | core | Add a comment to a task |
| 10 | `taiga_create_epic` | core | Create an epic with tags, status, and milestone |
| 11 | `taiga_create_issue` | core | Create an issue with optional type, priority, and severity by name or id |
| 12 | `taiga_create_milestone` | extended | Create a sprint/milestone (slug, dates) |
| 13 | `taiga_create_project` | extended | Create a new project from a template and module flags |
| 14 | `taiga_create_project_tag` | core | Create a project tag with optional HEX color |
| 15 | `taiga_create_story` | core | Create a user story with epic, tags, due date, and estimate |
| 16 | `taiga_create_swimlane` | extended | Create a Kanban swimlane (when supported by the Taiga instance) |
| 17 | `taiga_create_task` | core | Create a task with optional parent story and tags |
| 18 | `taiga_create_user_story_status` | extended | Add a Kanban column with optional WIP limit |
| 19 | `taiga_create_webhook` | advanced | Register an outbound webhook on the project |
| 20 | `taiga_create_wiki_page` | extended | Create a wiki page (requires wiki module) |
| 21 | `taiga_delete_attachment` | advanced | Delete a file attachment by id |
| 22 | `taiga_delete_epic` | advanced | Permanently delete an epic (`confirm: true` required) |
| 23 | `taiga_delete_issue` | advanced | Permanently delete an issue (`confirm: true` required) |
| 24 | `taiga_delete_project` | advanced | Permanently delete a project (`confirm: true` required) |
| 25 | `taiga_delete_project_tag` | advanced | Remove a tag from the project |
| 26 | `taiga_delete_story` | advanced | Permanently delete a user story (`confirm: true` required) |
| 27 | `taiga_delete_swimlane` | extended | Delete a swimlane; optionally move cards to another swimlane |
| 28 | `taiga_delete_task` | advanced | Permanently delete a task (`confirm: true` required) |
| 29 | `taiga_delete_user_story_status` | extended | Delete a Kanban column by id |
| 30 | `taiga_delete_webhook` | advanced | Delete a webhook (`confirm: true` required) |
| 31 | `taiga_delete_wiki_page` | advanced | Delete a wiki page |
| 32 | `taiga_duplicate_project` | extended | Clone project structure into a new project |
| 33 | `taiga_edit_project_tag` | extended | Rename or recolor a project tag |
| 34 | `taiga_get_custom_attribute_values` | extended | Read custom attribute values on a story, task, issue, or epic |
| 35 | `taiga_get_epic` | core | Fetch epic detail by slug + ref or id |
| 36 | `taiga_get_issue` | core | Fetch issue detail by slug + ref or id |
| 37 | `taiga_get_issue_history` | extended | Fetch activity/history for an issue |
| 38 | `taiga_get_kanban_board` | core | Snapshot Kanban columns, cards, and swimlanes; filter closed cards or swimlane |
| 39 | `taiga_get_milestone` | core | Fetch a single milestone by slug or id |
| 40 | `taiga_get_project` | core | Fetch project detail and module flags |
| 41 | `taiga_get_project_issue_stats` | extended | Fetch trimmed issue metrics for a project |
| 42 | `taiga_get_project_stats` | extended | Fetch trimmed project metrics |
| 43 | `taiga_get_story` | core | Fetch story with tasks and `points_by_role`; optional history |
| 44 | `taiga_get_story_history` | extended | Fetch activity/history for a user story |
| 45 | `taiga_get_task` | core | Fetch task detail by slug + ref or id |
| 46 | `taiga_get_task_history` | extended | Fetch activity/history for a task |
| 47 | `taiga_get_wiki_page` | extended | Fetch a wiki page by slug |
| 48 | `taiga_invite_member` | extended | Invite a user by username/email with a project role |
| 49 | `taiga_link_story_to_epic` | core | Associate a user story with an epic |
| 50 | `taiga_list_attachments` | extended | List attachments on a story, task, issue, epic, or wiki page |
| 51 | `taiga_list_custom_attributes` | extended | List custom attribute definitions for an entity type |
| 52 | `taiga_list_epics` | core | List epics with filters and pagination |
| 53 | `taiga_list_issue_types` | core | List issue types (Bug, Question, etc.) |
| 54 | `taiga_list_issues` | core | List issues with filters and pagination |
| 55 | `taiga_list_members` | core | List project members (`user_id` for assignees) |
| 56 | `taiga_list_milestones` | core | List sprints/milestones in a project |
| 57 | `taiga_list_points` | core | List the story point scale for a project |
| 58 | `taiga_list_priorities` | core | List issue priorities |
| 59 | `taiga_list_project_tags` | core | List project tags and colors |
| 60 | `taiga_list_project_templates` | extended | List Scrum/Kanban templates for `taiga_create_project` |
| 61 | `taiga_list_projects` | core | List projects (id, slug, name) |
| 62 | `taiga_list_roles` | extended | List project roles (for invites) |
| 63 | `taiga_list_severities` | core | List issue severities |
| 64 | `taiga_list_statuses` | core | List statuses for user stories, tasks, issues, or epics |
| 65 | `taiga_list_swimlanes` | extended | List swimlanes or report `supported: false` when unavailable |
| 66 | `taiga_list_tasks` | core | List tasks with filters, parent story, and pagination |
| 67 | `taiga_list_user_stories` | core | List user stories with milestone, status, tags, epic filters, and pagination |
| 68 | `taiga_list_webhooks` | advanced | List outbound webhooks for a project |
| 69 | `taiga_list_wiki_pages` | extended | List wiki pages in a project |
| 70 | `taiga_move_story_on_kanban` | core | Move a card: change status, swimlane, and/or kanban order in one call |
| 71 | `taiga_reorder_user_story_statuses` | extended | Bulk-reorder Kanban columns |
| 72 | `taiga_search` | core | Full-text search within a project |
| 73 | `taiga_set_custom_attribute_values` | extended | Set custom attribute values on a story, task, issue, or epic |
| 74 | `taiga_set_story_blocked_by` | extended | Mark a story blocked using `blockedByThreadId` / blocked note |
| 75 | `taiga_test_webhook` | advanced | Send a test payload to a webhook URL |
| 76 | `taiga_unlink_story_from_epic` | core | Remove a user story from its epic |
| 77 | `taiga_update_epic` | core | Update epic status, tags, blocked state, milestone, etc. |
| 78 | `taiga_update_issue` | core | Update issue status, type, priority, severity, tags, assignee, etc. |
| 79 | `taiga_update_milestone` | extended | Update milestone name, dates, or closed state |
| 80 | `taiga_update_project` | extended | Update project name, description, module flags, and privacy |
| 81 | `taiga_update_story` | core | Update story status, tags, blocked state, milestone, assignee, etc. |
| 82 | `taiga_update_story_backlog_order` | extended | Bulk-update backlog order via JSON `[{storyRef, order}]` |
| 83 | `taiga_update_story_kanban_order` | core | Bulk-update Kanban card order within columns |
| 84 | `taiga_update_story_sprint_order` | extended | Bulk-update sprint board card order |
| 85 | `taiga_update_swimlane` | extended | Rename or reorder a swimlane |
| 86 | `taiga_update_task` | core | Update task status, parent story, tags, assignee, closed state, etc. |
| 87 | `taiga_update_user_story_status` | extended | Update a Kanban column by id or name (color, WIP limit, order) |
| 88 | `taiga_update_webhook` | advanced | Update webhook name, URL, or active flag |
| 89 | `taiga_update_wiki_page` | extended | Update wiki page subject and content |
| 90 | `taiga_upload_attachment` | extended | Upload a file from host `filePath` to a story, task, issue, epic, or wiki |

---

## Tools by category

| Category | Count | Tools |
|----------|------:|-------|
| Project lifecycle | 5 | create, update, duplicate, delete project; list templates |
| Discovery & metadata | 18 | list/get projects, stories, tasks, issues, epics, milestones, statuses, members, roles, points, issue metadata, tags, search |
| Read detail & stats | 13 | get story/task/issue/epic, histories, stats, wiki page, custom attributes |
| Create | 11 | milestone, epic, story, task, issue, tag, wiki, webhook, invite |
| Update, link & order | 14 | update entities, link/unlink epic, backlog/sprint/kanban order, blocked-by |
| Kanban & swimlanes | 11 | board snapshot, column CRUD/reorder, swimlane CRUD, move card |
| Comments | 4 | comment on story, task, issue, epic |
| Attachments | 3 | list, upload, delete |
| Bulk, archive & delete | 11 | CSV bulk sync, archive/delete entities and tags |
| Wiki | 1 | list wiki pages (other wiki tools in Read/Create/Update) |
| Webhooks | 5 | list, create, update, delete, test |

For parameter details and example prompts, see the [main README](README.md).
