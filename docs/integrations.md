# Mitos Companion Plugin Integrations

Mitos provides explicit, verified integrations with the three most popular planning plugins in the Obsidian ecosystem:

## 1. Obsidian Calendar Plugin
- **Behavior:** The Calendar community plugin looks for daily notes according to the settings configured in `.obsidian/daily-notes.json` (or root `YYYY-MM-DD.md`).
- **Format support:** Mitos resolves the numeric Moment tokens `YYYY`, `YY`, `MM`, `M`, `DD`, and `D` in the configured `format` (e.g. `YYYY/MM/YYYY-MM-DD`). Formats using other tokens fall back to `YYYY-MM-DD` so a note is never written to a path the plugin would not open.
- **Mitos Bridge:** Whenever a note is saved with `publish_date = D`:
  1. Resolves daily note file path for date `D`.
  2. Idempotently appends:
     ```markdown
     - [[2026-11-25-rag-demo-dies-at-10k-docs]] — Your RAG demo dies at ten thousand documents.
     ```
  3. If the link already exists in the daily note, insertion is safely skipped.
  4. Clicking date `D` on the Calendar plugin immediately reveals the scheduled content.

## 2. Obsidian Kanban Plugin
- **Behavior:** The Kanban community plugin requires board files with frontmatter `kanban-plugin: board` and Markdown headers as lanes.
- **Mitos Bridge:**
  1. Locates or creates `content/_pipeline.md`.
  2. Maps note `status` to matching lane:
     - `idea` $\rightarrow$ `## Ideas` (or `Backlog`, `Inbox`)
     - `planned` $\rightarrow$ `## Scheduled` (or `Planned`, `Queued`)
     - `scripted` $\rightarrow$ `## Scripted`
     - `published` $\rightarrow$ `## Published`
  3. Uses `vault.process()` for atomic read-modify-write without disturbing user-added lanes or manual card arrangements.

## 3. Obsidian Dataview Plugin
- **Mitos Command:** `Mitos: Create Content Dashboard`
- **Output:** Creates `content/_dashboard.md` with:
  ```dataview
  TABLE 
    publish_date as "Publish Date",
    status as "Status",
    series_id as "Series",
    slop_score as "Slop Score"
  FROM "content"
  WHERE file.name != "_pipeline" AND file.name != "_dashboard"
  SORT publish_date ASC
  ```
