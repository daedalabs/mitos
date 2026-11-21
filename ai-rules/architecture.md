# AI Rule: Engine-First Architecture

## 1. Zero-Obsidian Core Rule
All core logic (`src/core/*`) must remain strictly headless:
- **Never import `obsidian` inside `src/core/`**.
- All external dependencies (network access, vault filesystem, editor context) must be passed as injected interfaces:
  - `HttpClient`: `(options: HttpRequestOptions) => Promise<HttpResponse>`
  - `VaultLike`: `exists`, `read`, `write`, `delete`, `createFolder`, `getMarkdownFiles`, `process`

## 2. Thin UI Layer
The UI components (`src/view/*`, `BrainstormModal`, `MitosSettingTab`) are pure presentation and command dispatchers:
- No prompt construction in UI components.
- No direct parsing or JSON repair in UI components.
- Shared rendering: Modal and sidebar view must reuse `cards.ts` and `series-panel.ts`.

## 3. Safe Mobile & Desktop Lifecycle
- In `onload()`: Register views with `registerView`, initialize memory scanner.
- In `onunload()`: Clean up all leaves with `this.app.workspace.detachLeavesOfType(VIEW_TYPE_MITOS)`.
- In `activateView()`: Always handle nullability when the right sidebar is collapsed on mobile (`app.workspace.rightSplit.expand()`).

## 4. Model & Protocol Flexibility (Tokens and MCP)
- Support both token-based providers (Gemini, OpenAI) and token-free protocols (Ollama, Model Context Protocol / MCP).
- MCP communication must adhere to standard JSON-RPC 2.0 `tools/call`.
- Expose Mitos capabilities (`mitos_brainstorm_angles`, `mitos_plan_series`, `mitos_lint_script`) as standardized MCP tools in `src/core/mcp.ts`.
