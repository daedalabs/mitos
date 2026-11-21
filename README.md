# Mitos (`daedalabs/mitos`)

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED.svg)](https://obsidian.md)
[![License: DaedaLabs Source-Available](https://img.shields.io/badge/license-DaedaLabs_Source--Available-purple.svg)](LICENSE)
[![CI](https://github.com/daedalabs/mitos/actions/workflows/ci.yml/badge.svg)](https://github.com/daedalabs/mitos/actions/workflows/ci.yml)

**Mitos** (*μίτος* — the guiding thread through the Daedalian labyrinth) is a headless AI brainstorming, multi-part series planner, and anti-slop content engine for Obsidian.

Built specifically for software engineers, technical creators, and developers making short-form technical content (YouTube Shorts, TikTok, Reels), Mitos pairs structured narrative archetypes with deterministic anti-slop linting, memory de-duplication, and atomic multi-note writes.

---

## ⚡ Key Capabilities

### 1. Multi-Angle Technical Ideation & Context Capture
* **Context-Seeded Ideation:** Open Mitos with an editor selection or active note to automatically seed technical context within a safe ~4,000 character token budget.
* **3 Tested Archetypes:**
  * **The Pain Point / Failure Scenario:** High-frustration gotcha, bug, or memory leak.
  * **The Contrarian Hot Take:** Debunking common engineering advice or naive tutorials.
  * **The Architecture Teardown:** Internal mechanics, memory layouts, or assembly execution.

### 2. Series Arc Planner (Multi-Part Video Blueprint)
* Architect cohesive, interconnected 3-episode arcs using narrative blueprints:
  * **3-Act Engineering Problem:** Tension $\rightarrow$ Mechanism $\rightarrow$ Benchmark & Tradeoffs.
  * **Deep Dive Breakdown:** Surface Level $\rightarrow$ Under the Hood $\rightarrow$ Production Pitfalls.
  * **Versus Comparison:** Head-to-Head Clash $\rightarrow$ Stress Testing $\rightarrow$ Decision Matrix.
* **Closed Link Integrity:** Automatically builds and validates closed `prev` / `next` wikilink chains, cliffhangers, and previous-episode payoffs before writing to disk.
* **All-or-Nothing Atomic Writes:** Pre-builds and validates all files in memory, rolling back created files immediately if any write fails.

### 3. Automated Anti-Slop Linter v2
* Configurable strictness profiles:
  * **Lenient:** $\le$ 18 words hook, 60 pass threshold.
  * **Standard (Default):** $\le$ 15 words hook, 70 pass threshold.
  * **Ruthless:** $\le$ 12 words hook, 85 pass threshold (zero mercy on filler).
* Flags 20+ generic AI clichés (*"delve"*, *"game-changer"*, *"unleash"*, *"revolutionize"*, *"tapestry"*, *"plethora"*).
* Rejects weak rhetorical openers (*"Have you ever wondered..."*).
* Enforces concrete proof anchors (demands terminal logs, benchmark metrics, code diffs, or numbers).

### 4. Vault Memory & De-duplication
* Folder-scoped scanner indexes your content folder using token Jaccard similarity ($\ge 0.6$).
* Alerts you before generating or scheduling a topic you have already covered.

### 5. Verified Companion Plugin Integrations
* **Obsidian Calendar:** Idempotently appends a scheduled wikilink entry (`- [[note]] — hook`) into your daily note for the target publish date.
* **Obsidian Kanban:** Appends cards (`- [ ] [[note]]`) into `content/_pipeline.md` under matching lanes (`Ideas`, `Scheduled`, etc.) via atomic `vault.process`. Bootstrap your vault automatically using `npm run setup:kanban` or the Obsidian command `Mitos: Bootstrap Kanban Pipeline`.
* **Obsidian Dataview:** Command `Mitos: Create Content Dashboard` creates `content/_dashboard.md` with ready-to-run queries.

### 6. Flexible Backends: API Tokens or Local MCP (No Tokens Required)
* **API Key Providers:** Direct, authenticated connections to Google Gemini (`gemini-2.5-flash`) or OpenAI / OpenRouter.
* **Local Ollama:** Connect to local models (`llama3`, `qwen2.5`, `mistral`) with zero external network traffic.
* **Model Context Protocol (MCP Server):** Connect Mitos directly to any MCP endpoint (JSON-RPC 2.0 / SSE / HTTP) to generate content via your existing MCP server infrastructure without paying for or configuring raw API tokens.
* **MCP Tool Definitions:** Mitos includes standard MCP tool definitions allowing coding agents (Antigravity, Cursor, Claude Desktop) to orchestrate Mitos workflows directly:
  * `mitos_brainstorm_angles`: Generates 3 technical short-form angles with concrete visual anchors and hook budgets.
  * `mitos_plan_series`: Architects 3-part interconnected series arcs with closed link integrity.
  * `mitos_lint_script`: Lints scripts and hooks for banned AI clichés, verbosity, and concrete proof.
  * `mitos_save_angle_note`: Persists a generated angle note directly to the vault filesystem (`content/YYYY-MM-DD-slug.md`), runs `lintScriptForSlop` to record `slop_score` in frontmatter, and appends the card to `content/_pipeline.md` under `## Ideas`. Configure the target vault via `vaultPath` or the `MITOS_VAULT_PATH` environment variable.
  * `mitos_save_series`: Atomically writes complete multi-episode series plans with closed wikilink chains and updates the Kanban board.

---

## 🔒 Security & Key Handling

* **Header-Based Authentication:** Gemini API keys are passed strictly via `x-goog-api-key` request headers (never in query parameters where they could be logged by proxies).
* **Local Storage:** API keys reside in your vault's private plugin storage (`.obsidian/plugins/mitos/data.json`). If syncing your vault across devices, ensure this directory is excluded or kept private.

---

## 🛠️ Development & Headless Testing

Mitos is built with an **engine-first, headless core** (`src/core/`) separated cleanly from Obsidian UI dependencies. All prompt construction, parsing, validation, and atomic writes run under Node and Vitest with zero Obsidian runtime requirements.

```bash
# Clone repository
git clone https://github.com/daedalabs/mitos.git
cd mitos

# Install dependencies
npm install

# Run unit tests
npm test

# Build production bundle (main.js and styles.css)
npm run build

# Bootstrap Kanban plugin and initial pipeline in vault (defaults to ./test-vault)
npm run setup:kanban

# Scaffold local test vault (includes Kanban bootstrap)
npm run dev:vault
```

---

## 📦 Data Contracts

### Standalone Content Note (`content/YYYY-MM-DD-slug.md`)
```markdown
---
title: "Your RAG demo dies at 10k documents"
hook: "Your RAG demo dies at ten thousand documents."
angle_type: pain_point
status: planned
publish_date: 2026-11-25
series_id: ""
episode: 0
series_total: 0
prev: ""
next: ""
visual_anchor: "terminal: p95 latency 2.4s → 9.1s as docs grow 1k → 10k"
slop_score: 85
tags:
  - content/short-form
  - content/pain-point
---
```

---

## 📄 License & Attribution

This project is licensed under the **Mitos Source-Available Software License** (see [LICENSE](LICENSE)).  
Copyright &copy; 2026 Deogenes Maranan / DaedaLabs.
