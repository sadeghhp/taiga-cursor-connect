import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SchemaValidationError,
  assertIssueRefValid,
  assertIssueUpdateValid,
  assertStoryRefValid,
  assertStoryUpdateValid,
  assertTaskRefValid,
  assertTaskUpdateValid,
  parseTagsParam
} from "./schemas.js";

const idOrSlugRefMessage =
  "Provide either an internal id or both projectSlug and ref.";

describe("assertStoryRefValid", () => {
  it("accepts storyId alone", () => {
    assert.doesNotThrow(() => assertStoryRefValid({ storyId: 1 }));
  });

  it("accepts projectSlug and storyRef", () => {
    assert.doesNotThrow(() =>
      assertStoryRefValid({ projectSlug: "my-project", storyRef: 42 })
    );
  });

  it("rejects empty input", () => {
    assert.throws(
      () => assertStoryRefValid({}),
      (err: unknown) => {
        assert.ok(err instanceof SchemaValidationError);
        assert.equal(err.message, idOrSlugRefMessage);
        return true;
      }
    );
  });

  it("rejects slug without ref", () => {
    assert.throws(
      () => assertStoryRefValid({ projectSlug: "my-project" }),
      SchemaValidationError
    );
  });

  it("rejects ref without slug", () => {
    assert.throws(
      () => assertStoryRefValid({ storyRef: 42 }),
      SchemaValidationError
    );
  });
});

describe("assertTaskRefValid", () => {
  it("accepts taskId alone", () => {
    assert.doesNotThrow(() => assertTaskRefValid({ taskId: 9 }));
  });

  it("accepts projectSlug and taskRef", () => {
    assert.doesNotThrow(() =>
      assertTaskRefValid({ projectSlug: "my-project", taskRef: 7 })
    );
  });

  it("rejects empty input", () => {
    assert.throws(() => assertTaskRefValid({}), SchemaValidationError);
  });

  it("rejects slug without ref", () => {
    assert.throws(
      () => assertTaskRefValid({ projectSlug: "my-project" }),
      SchemaValidationError
    );
  });

  it("rejects ref without slug", () => {
    assert.throws(() => assertTaskRefValid({ taskRef: 7 }), SchemaValidationError);
  });
});

const updateRequiredMessage =
  "Provide at least one field to update (status, subject, description, milestone, assignee, tags, blocked, etc.).";

describe("assertIssueRefValid", () => {
  it("accepts issueId alone", () => {
    assert.doesNotThrow(() => assertIssueRefValid({ issueId: 3 }));
  });

  it("accepts projectSlug and issueRef", () => {
    assert.doesNotThrow(() =>
      assertIssueRefValid({ projectSlug: "my-project", issueRef: 15 })
    );
  });

  it("rejects invalid ref", () => {
    assert.throws(() => assertIssueRefValid({}), SchemaValidationError);
  });
});

describe("assertStoryUpdateValid", () => {
  it("accepts any single update field", () => {
    assert.doesNotThrow(() => assertStoryUpdateValid({ subject: "New title" }));
    assert.doesNotThrow(() => assertStoryUpdateValid({ milestoneSlug: "sprint-1" }));
    assert.doesNotThrow(() => assertStoryUpdateValid({ tags: "bug,api" }));
  });

  it("rejects empty update", () => {
    assert.throws(
      () => assertStoryUpdateValid({}),
      (err: unknown) => {
        assert.ok(err instanceof SchemaValidationError);
        assert.equal(err.message, updateRequiredMessage);
        return true;
      }
    );
  });

  it("rejects whitespace-only tags", () => {
    assert.throws(() => assertStoryUpdateValid({ tags: "   " }), SchemaValidationError);
  });
});

describe("assertTaskUpdateValid", () => {
  it("accepts any single update field", () => {
    assert.doesNotThrow(() => assertTaskUpdateValid({ isClosed: true }));
  });

  it("rejects empty update", () => {
    assert.throws(
      () => assertTaskUpdateValid({}),
      (err: unknown) => {
        assert.ok(err instanceof SchemaValidationError);
        assert.equal(err.message, updateRequiredMessage);
        return true;
      }
    );
  });
});

describe("assertIssueUpdateValid", () => {
  it("accepts common update fields", () => {
    assert.doesNotThrow(() => assertIssueUpdateValid({ statusName: "Done" }));
  });

  it("rejects empty update", () => {
    assert.throws(() => assertIssueUpdateValid({}), SchemaValidationError);
  });
});

describe("parseTagsParam", () => {
  it("splits comma-separated tags", () => {
    assert.deepEqual(parseTagsParam(" bug , api "), ["bug", "api"]);
  });

  it("returns undefined for empty or whitespace input", () => {
    assert.equal(parseTagsParam(undefined), undefined);
    assert.equal(parseTagsParam("  "), undefined);
  });
});

describe("SchemaValidationError", () => {
  it("sets name to SchemaValidationError", () => {
    const err = new SchemaValidationError("bad input");
    assert.equal(err.name, "SchemaValidationError");
    assert.equal(err.message, "bad input");
  });
});
