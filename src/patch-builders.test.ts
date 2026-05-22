import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCreateOptions,
  hasStoryEpicMutation,
  hasStoryPatchFields,
  omitStoryEpicFields
} from "./patch-builders.js";

describe("omitStoryEpicFields / hasStoryPatchFields", () => {
  it("epic-only fields are not patch fields", () => {
    const stripped = omitStoryEpicFields({ epicId: 9, unlinkEpic: true });
    assert.equal(hasStoryPatchFields({ epicId: 9 }), false);
    assert.equal(hasStoryEpicMutation({ epicId: 9 }), true);
    assert.deepEqual(stripped, {});
  });

  it("detects non-epic patch fields", () => {
    assert.equal(hasStoryPatchFields({ subject: "x" }), true);
    assert.equal(hasStoryEpicMutation({ subject: "x" }), false);
  });
});

describe("applyCreateOptions", () => {
  it("does not set points on task bodies", async () => {
    const body: Record<string, unknown> = { project: 1, subject: "t" };
    await applyCreateOptions(body, 1, "task", {
      points: { "1": 5 },
      dueDate: "2026-01-01",
      estimateHours: 3
    });
    assert.equal(body.points, undefined);
    assert.equal(body.due_date, undefined);
  });

  it("sets points and dueDate on user stories", async () => {
    const body: Record<string, unknown> = { project: 1, subject: "s" };
    await applyCreateOptions(body, 1, "user_story", {
      points: { "1": 5 },
      dueDate: "2026-01-01"
    });
    assert.deepEqual(body.points, { "1": 5 });
    assert.equal(body.due_date, "2026-01-01");
  });
});
