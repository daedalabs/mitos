# Mitos Series Arc Blueprints

## Narrative Archetypes

Mitos structures multi-part technical series around three distinct narrative blueprints:

### 1. `3_act_engineering_problem`
- **Episode 1: The Problem/Tension** — High-frustration scenario showing where standard methods fail under load or edge conditions.
- **Episode 2: The Mechanism** — Architecture teardown and implementation of the fix.
- **Episode 3: The Benchmark & Tradeoffs** — Concrete numbers, profiling, and production gotchas.

### 2. `deep_dive_breakdown`
- **Episode 1: The Surface Level & The Hidden Complexity** — Exposing naive assumptions.
- **Episode 2: Under the Hood** — Step-by-step trace of memory, network, or kernel execution.
- **Episode 3: Production Pitfalls & Hard-Won Lessons** — Defensive design in real systems.

### 3. `versus_comparison`
- **Episode 1: The Head-to-Head Clash** — Architectural tradeoffs and baseline benchmarks.
- **Episode 2: Stress Testing & Failure Modes** — Pushing both solutions to the breaking point.
- **Episode 3: The Production Decision Matrix** — Opinionated framework for choosing between them.

---

## Closed Link Integrity Contract

Every episode generated within a series maintains strict relational links:
1. **Chain closure:**
   - Episode 1: `prev = ""`
   - Episode $k$ ($1 < k < N$): `prev = "[[Ep k-1]]"`, `next = "[[Ep k+1]]"`
   - Episode $N$: `next = ""`
2. **Open loops & Payoffs:**
   - Episode 1 introduces an open loop in `cliffhanger`.
   - Episode 2 must include `payoff_from_prev` referencing Episode 1.
   - Written episode notes render `payoff_from_prev` as `## Payoff from Previous Episode` and the `cliffhanger` as the forward connection.
3. **Atomic Multi-Note Transaction:**
   - All $N$ episode notes + the series index note are built and validated in memory first.
   - Files are written atomically. If any write fails (e.g. disk error or permission failure), all written files in the batch are rolled back immediately.
