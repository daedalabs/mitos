# Mitos Data Contracts & Note Schemas

## 1. Standalone Content Note

**Location:** `content/{YYYY-MM-DD}-{slug}.md`  
**Collision handling:** Appends `-2`, `-3` when filename exists.

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

# Your RAG demo dies at 10k documents

> **Target Hook (0-3s):**  
> "Your RAG demo dies at ten thousand documents."

## Core Tension & Problem
Naive vector search degrades rapidly once index size exceeds cache boundaries.

## Visual Proof Anchor
terminal: p95 latency 2.4s → 9.1s as docs grow 1k → 10k

## Script Draft
- [ ] Write 35-second spoken copy
- [ ] Verify no banned AI clichés
- [ ] Run `Mitos: Lint Current Note for AI Slop`

## Forward Connection / Open Loop
"Tomorrow: How tiered indexing drops latency back down to 30ms."
```

## 2. Series Index Note

**Location:** `content/series/{series-id}.md`

```markdown
---
type: series
title: "RAG at scale, in 3 acts"
series_id: rag-at-scale
archetype: 3_act_engineering_problem
episodes: 3
cadence_days: 2
status: planned
tags:
  - content/series
---

# RAG at scale, in 3 acts

- **Premise:** How naive vector search collapses under load, and the architectural fix.
- **Archetype:** 3_act_engineering_problem

## Episode Outline
1. [[2026-11-25-rag-demo-dies-at-10k-docs|Ep 1: The 10k Document Wall]]
2. [[2026-11-27-tiered-vector-indexing|Ep 2: The Two-Tiered Index]]
3. [[2026-11-29-benchmarking-100k-embeddings|Ep 3: The 100k Benchmark]]
```

## 3. Episode Notes in a Series

Each episode contains:
- `series_id`: Matches the series index note. If an index filename collides and is suffixed (`-2`), the episode `series_id` follows the suffix.
- `episode`: 1-based index ($1..N$).
- `series_total`: Total episode count ($N$).
- `prev`: Wikilink to previous episode or `""` for Episode 1.
- `next`: Wikilink to next episode or `""` for Episode $N$.

**Narrative body sections:** Episodes 2..$N$ also render the planned payoff as:

```markdown
## Payoff from Previous Episode
Direct resolution of the previous episode's cliffhanger.
```

The episode `cliffhanger` is rendered under `## Forward Connection / Open Loop`.
