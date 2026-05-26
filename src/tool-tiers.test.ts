import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  ALL_TOOL_TIERS,
  EXPECTED_TAIGA_TOOL_COUNT,
  TOOL_TIER,
  countToolsByTier,
  countToolsInRegistryForTiers,
  expandEnabledTiers,
  extractTaigaToolNamesFromServerSource,
  formatEnabledTiersLabel,
  isToolTierEnabled,
  parseEnabledTiers,
  resetEnabledTiersCache,
  resolveEnabledTiersFromEnv,
  validateToolTierRegistry,
  type ToolTier
} from "./tool-tiers.js";

const serverSourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "server.ts"
);

describe("tool-tiers", () => {
  afterEach(() => {
    delete process.env.TAIGA_MCP_TOOL_TIERS;
    delete process.env.TAIGA_MCP_TOOL_TIERS_STRICT;
    resetEnabledTiersCache();
  });

  it("maps exactly 90 taiga tools", () => {
    assert.equal(Object.keys(TOOL_TIER).length, EXPECTED_TAIGA_TOOL_COUNT);
  });

  it("tier counts match design (38 + 39 + 13)", () => {
    const counts = countToolsByTier();
    assert.equal(counts.core, 38);
    assert.equal(counts.extended, 39);
    assert.equal(counts.advanced, 13);
  });

  it("registry matches every taiga tool in server.ts", () => {
    const source = readFileSync(serverSourcePath, "utf8");
    const validation = validateToolTierRegistry(source);
    assert.equal(
      validation.serverTools.length,
      EXPECTED_TAIGA_TOOL_COUNT,
      `expected ${EXPECTED_TAIGA_TOOL_COUNT} tools in server.ts, found ${validation.serverTools.length}`
    );
    assert.deepEqual(
      validation.missingInRegistry,
      [],
      `missing TOOL_TIER entries: ${validation.missingInRegistry.join(", ")}`
    );
    assert.deepEqual(
      validation.orphanRegistryKeys,
      [],
      `orphan TOOL_TIER keys: ${validation.orphanRegistryKeys.join(", ")}`
    );
  });

  it("extractTaigaToolNamesFromServerSource finds unique names", () => {
    const source = readFileSync(serverSourcePath, "utf8");
    const names = extractTaigaToolNamesFromServerSource(source);
    assert.equal(names.length, EXPECTED_TAIGA_TOOL_COUNT);
    assert.equal(new Set(names).size, EXPECTED_TAIGA_TOOL_COUNT);
  });

  describe("expandEnabledTiers", () => {
    it("extended includes core", () => {
      const expanded = expandEnabledTiers(new Set<ToolTier>(["extended"]));
      assert.equal(formatEnabledTiersLabel(expanded), "core,extended");
      assert.equal(countToolsInRegistryForTiers(expanded), 77);
    });

    it("advanced includes core and extended", () => {
      const expanded = expandEnabledTiers(new Set<ToolTier>(["advanced"]));
      assert.equal(formatEnabledTiersLabel(expanded), "core,extended,advanced");
      assert.equal(countToolsInRegistryForTiers(expanded), 90);
    });
  });

  describe("parseEnabledTiers", () => {
    it("defaults to core when unset", () => {
      const { enabled, requested, unknownTokens } = parseEnabledTiers(undefined);
      assert.deepEqual([...requested], ["core"]);
      assert.deepEqual([...enabled], ["core"]);
      assert.equal(unknownTokens.length, 0);
      assert.equal(countToolsInRegistryForTiers(enabled), 38);
    });

    it("parses comma-separated tiers", () => {
      const { enabled } = parseEnabledTiers("core, extended , advanced");
      assert.deepEqual([...enabled], ALL_TOOL_TIERS);
      assert.equal(countToolsInRegistryForTiers(enabled), 90);
    });

    it("accepts all and full aliases", () => {
      for (const alias of ["ALL", "full", "Full"]) {
        const { enabled } = parseEnabledTiers(alias);
        assert.equal(enabled.size, 3);
        assert.equal(countToolsInRegistryForTiers(enabled), 90);
      }
    });

    it("accepts default alias as core", () => {
      const { enabled } = parseEnabledTiers("default");
      assert.deepEqual([...enabled], ["core"]);
    });

    it("expands extended alone to core+extended", () => {
      const { enabled, requested } = parseEnabledTiers("extended");
      assert.equal(formatEnabledTiersLabel(requested), "extended");
      assert.equal(formatEnabledTiersLabel(enabled), "core,extended");
      assert.equal(countToolsInRegistryForTiers(enabled), 77);
    });

    it("reports unknown tokens", () => {
      const { enabled, unknownTokens } = parseEnabledTiers("core,foo");
      assert.deepEqual([...enabled], ["core"]);
      assert.deepEqual(unknownTokens, ["foo"]);
    });

    it("falls back to core when only unknown tokens", () => {
      const { enabled, unknownTokens } = parseEnabledTiers("nope");
      assert.deepEqual([...enabled], ["core"]);
      assert.deepEqual(unknownTokens, ["nope"]);
    });
  });

  describe("isToolTierEnabled", () => {
    it("enables core tools only for core tier", () => {
      const enabled = new Set<ToolTier>(["core"]);
      assert.equal(isToolTierEnabled("taiga_list_projects", enabled), true);
      assert.equal(isToolTierEnabled("taiga_delete_story", enabled), false);
      assert.equal(isToolTierEnabled("taiga_bulk_sync_tasks_csv", enabled), false);
    });

    it("allows unmapped tool names (tests)", () => {
      const enabled = new Set<ToolTier>(["core"]);
      assert.equal(isToolTierEnabled("test_echo", enabled), true);
    });
  });

  describe("formatEnabledTiersLabel", () => {
    it("orders tiers core, extended, advanced", () => {
      const label = formatEnabledTiersLabel(
        new Set<ToolTier>(["advanced", "extended", "core"])
      );
      assert.equal(label, "core,extended,advanced");
    });
  });

  describe("resolveEnabledTiersFromEnv", () => {
    it("reads TAIGA_MCP_TOOL_TIERS with expansion", () => {
      process.env.TAIGA_MCP_TOOL_TIERS = "extended";
      resetEnabledTiersCache();
      const { enabled } = resolveEnabledTiersFromEnv();
      assert.equal(formatEnabledTiersLabel(enabled), "core,extended");
    });
  });
});
