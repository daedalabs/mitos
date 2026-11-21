# Mitos Development Instructions for AI Agents & Contributors

These instructions apply to any human developer or AI coding agent working in this repository, regardless of model provider, editor, or orchestration tool. They require no provider-specific plugin, API, or skill loader.

## 1. Product & Sources of Truth

- Read `README.md`, `docs/architecture.md`, `docs/data-contracts.md`, and the modular rules in `ai-rules/` before modifying behavior.
- Use `docs/development.md` and `docs/manual-test.md` for implementation and verification workflows.
- Keep the entire brainstorming, series planning, and linter workflow usable without requiring external vendor tools.

## 2. Implementation Boundaries & Architecture

- **Engine-First Headless Core (`src/core/*`):** Never import `obsidian` inside `src/core/`. All external interactions (network, vault filesystem, dialogs) must be injected via `HttpClient` and `VaultLike` interfaces. Use `NodeFsVault` (`src/core/node-fs-vault.ts`) for headless Node.js filesystem access.
- **Obsidian Adapters (`src/obsidian-adapter.ts`):** Only adapter and view layers (`src/view/*`, `src/main.ts`) may import Obsidian APIs.
- **Zero `innerHTML` Security Rule:** Never inject model-derived or user-supplied strings via `innerHTML`. Use `createEl()`, `createSpan()`, or text nodes to prevent XSS inside Electron.
- **Atomic Multi-Note Writes:** All multi-file transactions (series arcs, index notes) must be written through atomic pipelines with rollback on failure. Never leave half-written series or dangling notes.
- **MCP Server & Persistence:** The MCP server exposes `mitos_save_angle_note` (and `mitos_save_series`) so coding agents can persist compliant markdown notes directly to the vault and insert cards into `content/_pipeline.md` under `## Ideas`. The vault path is configured via tool parameter `vaultPath` or the `MITOS_VAULT_PATH` environment variable.
- **Attribution & Error Handling:** Use the structured `MitosError` taxonomy with actionable user-facing messages.

## 3. Delivery & Verification

- Before committing or finishing any task, run the full verification battery:
  ```bash
  npm run typecheck
  npm run build
  npm test
  ```
- To bootstrap fresh vaults with the Obsidian Kanban community plugin and pipeline board:
  ```bash
  npm run setup:kanban [targetVaultPath]
  ```
- All unit tests must pass cleanly under Node with zero Obsidian application dependencies.
- Retain required notices and update `THIRD_PARTY_NOTICES.md` whenever adding new dependencies.
