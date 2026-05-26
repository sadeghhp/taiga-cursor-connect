# Changelog

## 0.7.0

### Tool tiers

- MCP tools are split into **`core`** (38), **`extended`** (39), and **`advanced`** (13).
- **Default:** only `core` is registered unless `TAIGA_MCP_TOOL_TIERS` is set.
- Higher tiers include lower (`extended` → core + extended; `advanced` → all 90).
- Aliases: `default` (= core), `all` / `full` (= all tiers).
- Set `TAIGA_MCP_TOOL_TIERS=all` to match pre-tier behavior (all 90 tools).

### Documentation

- [MCP_TOOLS.md](MCP_TOOLS.md) — tool catalog with tier column
- [docs/tool-tier-configuration.md](docs/tool-tier-configuration.md) — Cursor MCP setup
