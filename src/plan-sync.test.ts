import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlanCsv } from "./plan-sync.js";

describe("parsePlanCsv", () => {
  it("parses header and rows", () => {
    const csv = `thread_id,hierarchy_id,title,subphase,module,estimate_h,blocked_by,gate,ac_ids,taiga_story_ref,taiga_task_ref,status
T00001,M01-E01,First task,A,M01,4,,M1.1,,,,
T00002,M01-E02,Second,B,M02,2,T00001,M1.1,,,,
`;
    const rows = parsePlanCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.thread_id, "T00001");
    assert.equal(rows[1]?.blocked_by, "T00001");
  });
});
