# Mitos 10-Step Manual Test Checklist

When testing inside a live Obsidian desktop or mobile application, follow this 10-step checklist:

## Pre-requisites
1. Run `npm run build && npm run dev:vault`
2. Open Obsidian $\rightarrow$ Open `test-vault` as a vault.
3. Ensure Mitos is enabled under **Settings $\rightarrow$ Community Plugins**.
4. In **Settings $\rightarrow$ Mitos**, configure your AI provider (Gemini / OpenAI / Ollama).

---

## Verification Steps

- [ ] **Step 1: Ribbon Icon Activation**  
  Click the sparkles ribbon icon on the left ribbon. The Mitos docked view opens in the right sidebar. On mobile, the right drawer expands cleanly.

- [ ] **Step 2: Command Palette Activation**  
  Press `Ctrl/Cmd + P` and run `Mitos: Open Content Panel`. Verify focus moves to the sidebar view.

- [ ] **Step 3: Editor Context Capture**  
  Highlight a line of code or technical text in any note. Press `Ctrl/Cmd + P` and run `Mitos: Brainstorm from Selection / Active Note`. Verify the sidebar opens with the selection pre-populated and a context character count badge displayed.

- [ ] **Step 4: Generate 3 Angles**  
  Enter a topic (e.g. *"Rust memory leak in async channels"*). Click **Generate Angles**. Verify:
  - 3 angle cards appear.
  - Scores and badges (`is-pass` / `is-fail`) render with appropriate contrast.
  - No DOM console warnings or errors.

- [ ] **Step 5: Memory De-duplication Check**  
  Enter the topic of an existing note already in `content/`. Verify the warning banner appears: `⚠️ Vault Memory Notice: Similar content found`.

- [ ] **Step 6: Single Note Creation**  
  On an angle card, pick a date and click **📅 Add to Calendar / Vault**. Verify:
  - Note appears under `content/{YYYY-MM-DD}-{slug}.md`.
  - Notice confirms addition.
  - Frontmatter has unquoted ISO `publish_date`.

- [ ] **Step 7: Calendar & Kanban Sync**  
  - Open the daily note for the date chosen in Step 6. Verify an idempotent wikilink entry was added.
  - Open `content/_pipeline.md`. Verify a `- [ ] [[...]]` card was added under `## Scheduled`.

- [ ] **Step 8: Series Arc Generation**  
  Switch Mitos panel to **Series Arc** mode. Select archetype `3_act_engineering_problem`. Enter a topic and click **Architect Series**. Verify:
  - 3 episodes appear with hooks, visual anchors, cliffhangers, and payoffs.
  - Cadence picker controls dates (e.g. 2-day cadence).

- [ ] **Step 9: Atomic Series Creation**  
  Click **✨ Create Series**. Verify:
  - Series index note is created in `content/series/{series-id}.md`.
  - All 3 episode notes are created in `content/` with closed `prev`/`next` wikilinks.
  - Kanban board receives all 3 episode cards.

- [ ] **Step 10: Dataview Dashboard Command**  
  Run `Mitos: Create Content Dashboard`. Open `content/_dashboard.md`. If Dataview plugin is installed, verify the query table renders properly.
