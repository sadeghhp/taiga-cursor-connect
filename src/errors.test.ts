import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTaigaError } from "./errors.js";
import { SchemaValidationError } from "./schemas.js";
import { TaigaError } from "./taiga-client.js";

describe("formatTaigaError", () => {
  it("includes HTTP status for TaigaError when present", () => {
    const msg = formatTaigaError(new TaigaError("Not found", 404));
    assert.equal(msg, "Not found (HTTP 404)");
  });

  it("returns message only for TaigaError without status", () => {
    assert.equal(formatTaigaError(new TaigaError("Config missing")), "Config missing");
  });

  it("returns message for SchemaValidationError", () => {
    assert.equal(
      formatTaigaError(new SchemaValidationError("Invalid ref")),
      "Invalid ref"
    );
  });

  it("returns message for generic Error", () => {
    assert.equal(formatTaigaError(new Error("boom")), "boom");
  });

  it("stringifies non-Error values", () => {
    assert.equal(formatTaigaError(42), "42");
  });
});
