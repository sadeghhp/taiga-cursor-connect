# Bulk sync example

## Agent prompt

```text
Use taiga_bulk_sync_tasks_csv with:
- projectSlug: mcp-test
- csvPath: /absolute/path/to/plan/L5/tasks.csv
- dryRun: true

Review the JSON result. If rows look correct, run again with dryRun false and milestoneSlugMap:
{"A":"P1-A-Data-Identity","B":"P1-B-Core-API","C":"P1-C-Integration"}

Apply csv_patch values back into tasks.csv columns taiga_story_ref and taiga_task_ref.
```

## Expected output shape

```json
{
  "rows": [
    {
      "thread_id": "T00001",
      "story_ref": 12,
      "task_ref": 45,
      "story_id": 101,
      "task_id": 202,
      "action": "created"
    }
  ],
  "csv_patch": "thread_id,taiga_story_ref,taiga_task_ref\nT00001,12,45\n..."
}
```

## Idempotency

Re-run with existing `taiga_story_ref` / `taiga_task_ref` → `action: "skipped"`.  
Or search by `<!-- thread:T00042 -->` marker when refs empty.
