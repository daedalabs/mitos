import { SeriesArchetype } from './types';

export const ANTI_SLOP_PROMPT_RULES = `CRITICAL ANTI-SLOP RULES:
1. No corporate marketing jargon, buzzwords, or filler (banned: delve, game-changer, revolutionize, unleash, tapestry, plethora, etc.).
2. No staged openers, greetings, or rhetorical questions (e.g., "Have you ever wondered", "Welcome back guys", "In this video I will").
3. Opening hooks MUST be punchy, direct assertions or high-tension conflicts in under 15 words.
4. Every piece MUST specify a concrete, verifiable visual proof anchor (e.g. terminal logs, code diff, memory graph, benchmark table, error stack).
5. Output MUST be strictly valid JSON without conversational preamble or markdown backticks outside of formatting.`;

export function buildAnglePrompt(topic: string, context?: string): string {
  const contextBlock = context?.trim() ? `\n\nADDITIONAL CONTEXT / CODE SNIPPET:\n${context.trim()}` : '';

  return `You are Mitos, an elite short-form technical content strategist for YouTube Shorts and TikTok.
Your job is to take a technical concept, product feature, or engineering topic and generate 3 sharp, distinct video angles.

${ANTI_SLOP_PROMPT_RULES}

Angle Archetypes:
- Angle 1 (pain_point): The high-frustration failure scenario, gotcha, or bug.
- Angle 2 (contrarian): The counter-intuitive hot take or debunking standard advice.
- Angle 3 (teardown): The architecture teardown, internals explanation, or mechanical proof.

TOPIC TO BRAINSTORM:
${topic}${contextBlock}

Respond strictly in valid JSON matching this schema:
{
  "angles": [
    {
      "angleType": "pain_point",
      "title": "Short title (under 50 chars)",
      "hook": "Spoken hook under 15 words delivering tension",
      "coreTension": "The core technical problem or paradox",
      "visualProofAnchor": "Concrete visual on screen (terminal output, code diff, etc.)",
      "openLoop": "Cliffhanger or next-step forward connection"
    },
    {
      "angleType": "contrarian",
      "title": "Short title (under 50 chars)",
      "hook": "Spoken hook under 15 words delivering tension",
      "coreTension": "The core technical problem or paradox",
      "visualProofAnchor": "Concrete visual on screen (terminal output, code diff, etc.)",
      "openLoop": "Cliffhanger or next-step forward connection"
    },
    {
      "angleType": "teardown",
      "title": "Short title (under 50 chars)",
      "hook": "Spoken hook under 15 words delivering tension",
      "coreTension": "The core technical problem or paradox",
      "visualProofAnchor": "Concrete visual on screen (terminal output, code diff, etc.)",
      "openLoop": "Cliffhanger or next-step forward connection"
    }
  ]
}`;
}

const ARCHETYPE_INSTRUCTIONS: Record<SeriesArchetype, string> = {
  '3_act_engineering_problem': `Structure the 3 episodes as:
- Episode 1: The Problem/Tension — why the standard approach collapses under load or creates a severe bottleneck.
- Episode 2: The Mechanism — dissecting the architecture and implementing the solution.
- Episode 3: The Benchmark & Tradeoffs — proving the fix with metrics and exploring edge cases.`,
  'deep_dive_breakdown': `Structure the 3 episodes as:
- Episode 1: The Surface Level & The Hidden Complexity — exposing what naive tutorials miss.
- Episode 2: Under the Hood — tracing memory, network, or kernel execution step-by-step.
- Episode 3: Production Pitfalls & Hard-Won Lessons — defensive design in real systems.`,
  'versus_comparison': `Structure the 3 episodes as:
- Episode 1: The Head-to-Head Clash — establishing the architectural differences and common assumptions.
- Episode 2: Stress Testing & Failure Modes — putting both solutions under extreme conditions.
- Episode 3: The Production Decision Matrix — clear, opinionated criteria on which to pick.`,
};

export function buildSeriesPrompt(topic: string, archetype: SeriesArchetype = '3_act_engineering_problem', episodeCount: number = 3): string {
  const archetypeGuide = ARCHETYPE_INSTRUCTIONS[archetype] || ARCHETYPE_INSTRUCTIONS['3_act_engineering_problem'];

  return `You are Mitos, an elite serial technical content architect.
Your job is to take a technical topic and architect an interconnected multi-part short-form video series (${episodeCount} episodes) that hooks viewers and carries an unbroken throughline.

${ANTI_SLOP_PROMPT_RULES}

SERIES NARRATIVE ARCHETYPE: ${archetype}
${archetypeGuide}

LINK INTEGRITY RULES:
- Episode 1 MUST introduce an unresolved cliffhanger to be paid off in Episode 2.
- Episode 2 MUST include "payoff_from_prev" resolving Ep 1, and introduce a cliffhanger for Ep 3.
- Episode 3 MUST include "payoff_from_prev" resolving Ep 2, and deliver a definitive technical conclusion.
- Each episode's hook must be <= 15 words.

TOPIC:
${topic}

Respond strictly in valid JSON matching this schema:
{
  "series_title": "Compelling series title",
  "premise": "Core technical problem solved across the arc",
  "archetype": "${archetype}",
  "episodes": [
    {
      "n": 1,
      "title": "Ep 1 title",
      "hook": "Opening hook under 15 words",
      "coreTension": "The core technical tension",
      "visualProofAnchor": "Terminal log, code diff, or latency graph",
      "cliffhanger": "Open loop that will be resolved in episode 2",
      "payoff_from_prev": ""
    },
    {
      "n": 2,
      "title": "Ep 2 title",
      "hook": "Opening hook under 15 words",
      "coreTension": "The core technical tension",
      "visualProofAnchor": "Terminal log, code diff, or latency graph",
      "cliffhanger": "Open loop that will be resolved in episode 3",
      "payoff_from_prev": "Direct resolution/callback to Episode 1 cliffhanger"
    },
    {
      "n": 3,
      "title": "Ep 3 title",
      "hook": "Opening hook under 15 words",
      "coreTension": "The core technical tension",
      "visualProofAnchor": "Terminal log, code diff, or latency graph",
      "cliffhanger": "Final thought or takeaway challenge",
      "payoff_from_prev": "Direct resolution/callback to Episode 2 cliffhanger"
    }
  ]
}`;
}
