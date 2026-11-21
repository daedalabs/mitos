# AI Rule: Anti-Slop Guidelines & Content Doctrine

## 1. The Core Philosophy
Mitos generates short-form technical content for developers, engineers, and builders. It rejects corporate fluff, LinkedIn buzzwords, and fake excitement in favor of concrete mechanics, friction, and technical proof.

## 2. Banned Clichés
The following words and phrases are banned from all prompts and generated output:
- `delve`, `delving`, `game-changer`, `revolutionize`, `unleash`, `tapestry`, `plethora`, `testament`, `beacon`, `bustling`, `transformative`, `pivotal`, `seamless`, `frictionless`, `unprecedented`
- Staged openers: `"Have you ever wondered..."`, `"Welcome back guys..."`, `"In this video I will..."`, `"Let that sink in..."`

## 3. Strictness Profiles
Every lint check is parameterized by an `AntiSlopStrictness` profile:
- **Lenient:** Hook word count $\le 18$, pass threshold $\ge 60/100$.
- **Standard (Default):** Hook word count $\le 15$, pass threshold $\ge 70/100$.
- **Ruthless:** Hook word count $\le 12$, pass threshold $\ge 85/100$.

## 4. Concrete Proof Anchor Requirement
Every angle or episode must specify a verifiable visual anchor:
- Terminal output / command invocation.
- Benchmark data (p95 latency, throughput, memory consumption).
- Code diff / AST comparison / compiler error message.
- Architectural diagram / trace view.
Scripts lacking concrete proof or metrics are penalized 20 points in scoring.
