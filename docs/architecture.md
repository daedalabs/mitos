# Mitos Architecture & System Design

Mitos follows an **engine-first, decoupled architecture** that separates pure content generation and validation logic from Obsidian runtime APIs.

```
┌────────────────────────────────────────────────────────┐
│                   Obsidian UI Layer                    │
│   (MitosView, BrainstormModal, Cards, SettingsTab)     │
└───────────────────────────┬────────────────────────────┘
                            │
               Obsidian Adapters (I/O Injected)
               - createObsidianHttpClient()
               - createObsidianVault(app)
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Mitos Headless Core                  │
│                      (src/core/*)                      │
│                                                        │
│  • prompts.ts        • providers.ts      • parse.ts    │
│  • anti_slop.ts      • memory.ts         • notes.ts    │
│  • dates.ts          • context.ts        • series.ts   │
│  • calendar.ts       • kanban.ts         • dashboard.ts│
│  • mcp.ts            • actions.ts        • paths.ts    │
│  • text.ts                                             │
└────────────────────────────────────────────────────────┘
```

## 1. Headless Engine Core (`src/core/*`)
- Has **zero imports** from the `obsidian` package.
- All file operations run through `VaultLike`.
- All HTTP operations run through `HttpClient`.
- Enables running full unit test suites in pure Node/Vitest environments without Electron or headless browser harnesses.

## 2. Injected Obsidian Adapters (`src/obsidian-adapter.ts`)
- Bridges Obsidian's `requestUrl` to `HttpClient`.
- Bridges `app.vault`, `app.vault.adapter`, and `app.vault.process` to `VaultLike`.
- Wraps error status codes into structured `MitosError` types.

## 3. Shared Headless Actions (`src/core/actions.ts`)
- `createAngleNote()` is the single write path for standalone angle notes: collision resolution, note rendering, atomic write, and best-effort Calendar/Kanban fan-out.
- Both the docked sidebar and the quick capture modal call it, so note-writing behavior cannot drift between UI surfaces.
- Uses only `VaultLike`; no Obsidian imports.

## 4. UI Presentation Layer (`src/view/*`)
- **Docked Sidebar Panel (`src/view/mitos-view.ts`):** Primary workspace for brainstorming and series planning.
- **Quick Capture Modal (`src/main.ts`):** Keyboard-driven modal for quick capture.
- **Shared Card Component (`src/view/cards.ts`):** Single source of truth for rendering angle cards.
- **Series Panel (`src/view/series-panel.ts`):** Episode sequencer with date picker and cadence controls.

## 5. Model Context Protocol (MCP) Server (`src/mcp-server.ts` & `scripts/mcp-server.mjs`)
- Exposes standard Model Context Protocol (JSON-RPC 2.0 over stdio) tools:
  - `mitos_brainstorm_angles`: Generates 3 technical short-form angles using structured archetypes.
  - `mitos_plan_series`: Plans a cohesive 3-episode technical arc with narrative blueprints.
  - `mitos_lint_script`: Evaluates hooks and scripts against anti-slop criteria.
  - `mitos_save_angle_note`: Persists a generated angle note directly to the vault filesystem (`content/YYYY-MM-DD-slug.md`), runs `lintScriptForSlop` to record `slop_score` in frontmatter, and appends the card to `content/_pipeline.md` under `## Ideas`. Target vault configured via `vaultPath` or `MITOS_VAULT_PATH`.
  - `mitos_save_series`: Atomically persists a multi-part series plan with closed wikilink chains and updates the Kanban board.
- Bundled via esbuild into a standalone Node ESM executable (`scripts/mcp-server.mjs`).
- Uses `NodeFsVault` (`src/core/node-fs-vault.ts`) to execute atomic writes and Kanban updates headlessly without Obsidian runtime APIs.
- Allows Antigravity, Cursor, Claude Desktop, and other MCP clients to orchestrate Mitos headless pipelines.
