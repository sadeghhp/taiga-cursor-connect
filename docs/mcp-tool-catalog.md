# MCP tool catalog (v0.7.0)

90 tools registered in [`src/server.ts`](../src/server.ts). See [README](../README.md) for parameters and examples.

## Project lifecycle

- `taiga_list_project_templates`
- `taiga_create_project`
- `taiga_update_project`
- `taiga_duplicate_project`
- `taiga_delete_project`

## Discovery and metadata

- `taiga_list_projects`
- `taiga_get_project`
- `taiga_list_user_stories`
- `taiga_list_tasks`
- `taiga_list_issues`
- `taiga_list_epics`
- `taiga_list_milestones`
- `taiga_get_milestone`
- `taiga_list_statuses`
- `taiga_list_members`
- `taiga_list_roles`
- `taiga_list_points`
- `taiga_list_issue_types`
- `taiga_list_priorities`
- `taiga_list_severities`
- `taiga_list_project_tags`
- `taiga_search`

## Read detail and stats

- `taiga_get_story`
- `taiga_get_story_history`
- `taiga_get_task`
- `taiga_get_task_history`
- `taiga_get_issue`
- `taiga_get_issue_history`
- `taiga_get_epic`
- `taiga_get_project_stats`
- `taiga_get_project_issue_stats`
- `taiga_get_wiki_page`
- `taiga_list_custom_attributes`
- `taiga_get_custom_attribute_values`

## Create

- `taiga_create_milestone`
- `taiga_create_epic`
- `taiga_create_story`
- `taiga_create_task`
- `taiga_create_issue`
- `taiga_create_project_tag`
- `taiga_create_wiki_page`
- `taiga_create_webhook`
- `taiga_invite_member`

## Update, link, order

- `taiga_update_milestone`
- `taiga_update_story`
- `taiga_update_task`
- `taiga_update_issue`
- `taiga_update_epic`
- `taiga_edit_project_tag`
- `taiga_set_custom_attribute_values`
- `taiga_update_wiki_page`
- `taiga_update_webhook`
- `taiga_link_story_to_epic`
- `taiga_unlink_story_from_epic`
- `taiga_update_story_backlog_order`
- `taiga_update_story_sprint_order`
- `taiga_update_story_kanban_order`
- `taiga_move_story_on_kanban`
- `taiga_set_story_blocked_by`

## Kanban columns and swimlanes

- `taiga_get_kanban_board`
- `taiga_create_user_story_status`
- `taiga_update_user_story_status`
- `taiga_delete_user_story_status`
- `taiga_reorder_user_story_statuses`
- `taiga_list_swimlanes`
- `taiga_create_swimlane`
- `taiga_update_swimlane`
- `taiga_delete_swimlane`

## Comments

- `taiga_comment_on_story`
- `taiga_comment_on_task`
- `taiga_comment_on_issue`
- `taiga_comment_on_epic`

## Attachments

- `taiga_list_attachments`
- `taiga_upload_attachment`
- `taiga_delete_attachment`

## Bulk, archive, delete

- `taiga_bulk_sync_tasks_csv`
- `taiga_archive_story`
- `taiga_archive_task`
- `taiga_archive_epic`
- `taiga_archive_issue`
- `taiga_delete_story`
- `taiga_delete_task`
- `taiga_delete_epic`
- `taiga_delete_issue`
- `taiga_delete_project_tag`
- `taiga_delete_wiki_page`
- `taiga_delete_webhook`

## Wiki list

- `taiga_list_wiki_pages`

## Webhooks

- `taiga_list_webhooks`
- `taiga_test_webhook`
