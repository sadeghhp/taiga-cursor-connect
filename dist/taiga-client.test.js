import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePointsByRole, trimHistory } from "./taiga-client.js";
describe("trimHistory", () => {
    it("returns newest entries first and caps at 50", () => {
        const entries = [];
        for (let i = 0; i < 60; i++) {
            entries.push({
                id: String(i),
                type: 1,
                created_at: `2020-06-15T${String(i).padStart(2, "0")}:00:00.000Z`,
                comment: `comment ${i}`
            });
        }
        const trimmed = trimHistory(entries);
        assert.equal(trimmed.length, 50);
        assert.equal(trimmed[0]?.comment, "comment 59");
        assert.equal(trimmed[49]?.comment, "comment 10");
    });
    it("skips entries without comment or diff", () => {
        const trimmed = trimHistory([
            { id: "1", type: 0, created_at: "2020-01-01T00:00:00Z" },
            {
                id: "2",
                type: 1,
                created_at: "2020-01-02T00:00:00Z",
                comment: "hello"
            }
        ]);
        assert.equal(trimmed.length, 1);
        assert.equal(trimmed[0]?.comment, "hello");
    });
});
describe("resolvePointsByRole", () => {
    it("maps point ids to role names", () => {
        const labeled = resolvePointsByRole({ "1": 5, "2": 3 }, [
            { id: 1, name: "UX", value: null },
            { id: 2, name: "Design", value: null }
        ]);
        assert.deepEqual(labeled, { UX: 5, Design: 3 });
    });
    it("returns null for empty points", () => {
        assert.equal(resolvePointsByRole(undefined, []), null);
    });
});
