#!/usr/bin/env node


// src/mcp-server.ts
import * as readline from "readline";

// src/core/anti_slop.ts
var BANNED_AI_WORDS = [
  "delve",
  "delving",
  "game-changer",
  "revolutionize",
  "unleash",
  "tapestry",
  "plethora",
  "testament",
  "beacon",
  "bustling",
  "in conclusion",
  "furthermore",
  "moreover",
  "at the end of the day",
  "have you ever wondered",
  "welcome back guys",
  "in this video i will",
  "let that sink in",
  "transformative",
  "pivotal",
  "seamless",
  "frictionless",
  "unprecedented"
];
var PROOF_KEYWORDS = [
  "code",
  "benchmark",
  "error",
  "terminal",
  "ms",
  "fps",
  "memory",
  "cpu",
  "diff",
  "commit",
  "test",
  "reproduce",
  "slide",
  "transcript",
  "page",
  "line",
  "function",
  "query",
  "bug",
  "crash",
  "latency",
  "throughput",
  "profile",
  "heap",
  "allocation",
  "stack trace"
];
var escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var PROOF_KEYWORD_PATTERN = new RegExp(
  `\\b(?:${PROOF_KEYWORDS.map(escapeRegex).join("|")})(?:s|es)?\\b`,
  "i"
);
var METRIC_PATTERN = /\b\d+(?:\.\d+)?\s?(?:ms|s|fps|ns|us|µs|kb|mb|gb|tb|qps|rps)\b|\d+(?:\.\d+)?\s?%/i;
var STRICTNESS_CONFIG = {
  lenient: { maxHookWords: 18, passThreshold: 60 },
  standard: { maxHookWords: 15, passThreshold: 70 },
  ruthless: { maxHookWords: 12, passThreshold: 85 }
};
function hasConcreteProof(text) {
  const trimmed = text.trim();
  if (!trimmed)
    return false;
  return /\d/.test(trimmed) || PROOF_KEYWORD_PATTERN.test(trimmed) || METRIC_PATTERN.test(trimmed);
}
function lintScriptForSlop(text, strictness = "standard", hookText) {
  const trimmed = text.trim();
  const rules = STRICTNESS_CONFIG[strictness] || STRICTNESS_CONFIG.standard;
  if (!trimmed) {
    return {
      score: 0,
      passed: false,
      warnings: ["Script is empty; nothing to lint."],
      bannedWordsFound: [],
      hookWordCount: 0,
      hasConcreteProof: false,
      strictness
    };
  }
  const sentences = trimmed.split(/(?<=[.?!])\s+/).filter(Boolean);
  const warnings = [];
  const bannedWordsFound = [];
  const lower = trimmed.toLowerCase();
  for (const word of BANNED_AI_WORDS) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (regex.test(lower)) {
      bannedWordsFound.push(word);
    }
  }
  if (bannedWordsFound.length > 0) {
    warnings.push(
      `Detected ${bannedWordsFound.length} banned AI clich\xE9(s): ${bannedWordsFound.join(", ")}`
    );
  }
  const firstSentence = sentences[0] || "";
  const hook = (hookText !== void 0 ? String(hookText) : firstSentence).trim();
  const hookWordCount = hook.split(/\s+/).filter(Boolean).length;
  if (hookWordCount > rules.maxHookWords) {
    warnings.push(
      `Opening hook is too verbose (${hookWordCount} words). ${strictness} budget is <= ${rules.maxHookWords} words.`
    );
  }
  const hookLower = hook.toLowerCase();
  const usesWeakRhetoricalOpener = hookLower.startsWith("have you ever") || hookLower.startsWith("did you know that");
  if (usesWeakRhetoricalOpener) {
    warnings.push(
      "Opening uses a weak rhetorical question hook. Replace with a direct claim or visual conflict."
    );
  }
  const proofFound = hasConcreteProof(trimmed);
  if (!proofFound) {
    warnings.push(
      "No concrete proof anchor detected. Technical scripts must reference code, benchmark metrics, or visual proof."
    );
  }
  let score = 100;
  score -= bannedWordsFound.length * 15;
  if (hookWordCount > rules.maxHookWords) {
    const excess = hookWordCount - rules.maxHookWords;
    score -= Math.min(25, 10 + excess * 2);
  }
  if (!proofFound) {
    score -= 20;
  }
  if (usesWeakRhetoricalOpener) {
    score -= 10;
  }
  score = Math.max(0, Math.min(100, score));
  const passed = score >= rules.passThreshold;
  return {
    score,
    passed,
    warnings,
    bannedWordsFound,
    hookWordCount,
    hasConcreteProof: proofFound,
    strictness
  };
}

// src/core/prompts.ts
var ANTI_SLOP_PROMPT_RULES = `CRITICAL ANTI-SLOP RULES:
1. No corporate marketing jargon, buzzwords, or filler (banned: delve, game-changer, revolutionize, unleash, tapestry, plethora, etc.).
2. No staged openers, greetings, or rhetorical questions (e.g., "Have you ever wondered", "Welcome back guys", "In this video I will").
3. Opening hooks MUST be punchy, direct assertions or high-tension conflicts in under 15 words.
4. Every piece MUST specify a concrete, verifiable visual proof anchor (e.g. terminal logs, code diff, memory graph, benchmark table, error stack).
5. Output MUST be strictly valid JSON without conversational preamble or markdown backticks outside of formatting.`;
function buildAnglePrompt(topic, context) {
  const contextBlock = context?.trim() ? `

ADDITIONAL CONTEXT / CODE SNIPPET:
${context.trim()}` : "";
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
var ARCHETYPE_INSTRUCTIONS = {
  "3_act_engineering_problem": `Structure the 3 episodes as:
- Episode 1: The Problem/Tension \u2014 why the standard approach collapses under load or creates a severe bottleneck.
- Episode 2: The Mechanism \u2014 dissecting the architecture and implementing the solution.
- Episode 3: The Benchmark & Tradeoffs \u2014 proving the fix with metrics and exploring edge cases.`,
  "deep_dive_breakdown": `Structure the 3 episodes as:
- Episode 1: The Surface Level & The Hidden Complexity \u2014 exposing what naive tutorials miss.
- Episode 2: Under the Hood \u2014 tracing memory, network, or kernel execution step-by-step.
- Episode 3: Production Pitfalls & Hard-Won Lessons \u2014 defensive design in real systems.`,
  "versus_comparison": `Structure the 3 episodes as:
- Episode 1: The Head-to-Head Clash \u2014 establishing the architectural differences and common assumptions.
- Episode 2: Stress Testing & Failure Modes \u2014 putting both solutions under extreme conditions.
- Episode 3: The Production Decision Matrix \u2014 clear, opinionated criteria on which to pick.`
};
function buildSeriesPrompt(topic, archetype = "3_act_engineering_problem", episodeCount = 3) {
  const archetypeGuide = ARCHETYPE_INSTRUCTIONS[archetype] || ARCHETYPE_INSTRUCTIONS["3_act_engineering_problem"];
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

// src/core/dates.ts
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function getDefaultPublishDate() {
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}
function normalizeCadenceDays(value, fallback = 2) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1)
    return fallback;
  return Math.min(30, parsed);
}
function calculateCadenceDates(startDateStr, count, cadenceDays = 2) {
  const start = parseDate(startDateStr);
  const safeCadence = normalizeCadenceDays(cadenceDays);
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const dates = [];
  for (let i = 0; i < safeCount; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * safeCadence);
    dates.push(formatDate(d));
  }
  return dates;
}

// src/core/types.ts
var MitosError = class extends Error {
  constructor(message, kind, retriable = false, status) {
    super(message);
    this.name = "MitosError";
    this.kind = kind;
    this.retriable = retriable;
    this.status = status;
  }
};

// src/core/paths.ts
function normalizeFolder(folder) {
  return (folder || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}
function joinVaultPath(folder, filename) {
  const cleanFolder = normalizeFolder(folder);
  const cleanName = filename.replace(/^\/+/, "");
  return cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;
}
function sanitizeWikilinkLabel(label) {
  return label.replace(/[|[\]#^\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

// src/core/notes.ts
function yamlStr(val) {
  if (val === void 0 || val === null)
    return '""';
  return JSON.stringify(String(val));
}
function slugify(text) {
  const slug = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "untitled";
}
async function resolveCollision(vault, folder, baseFilename) {
  const cleanFolder = normalizeFolder(folder);
  const dotIndex = baseFilename.lastIndexOf(".");
  const name = dotIndex !== -1 ? baseFilename.slice(0, dotIndex) : baseFilename;
  const ext = dotIndex !== -1 ? baseFilename.slice(dotIndex) : ".md";
  let candidate = joinVaultPath(cleanFolder, `${name}${ext}`);
  if (!await vault.exists(candidate)) {
    return candidate;
  }
  let counter = 2;
  while (counter < 100) {
    candidate = joinVaultPath(cleanFolder, `${name}-${counter}${ext}`);
    if (!await vault.exists(candidate)) {
      return candidate;
    }
    counter++;
  }
  throw new MitosError(`Unable to resolve unique filename for ${baseFilename} in ${folder}`, "vault");
}
function buildStandaloneNoteContent(payload) {
  const tags = payload.tags || ["content/short-form", `content/${payload.angleType.replace("_", "-")}`];
  const tagLines = tags.map((t) => `  - ${t}`).join("\n");
  const slopScore = Number.isFinite(payload.slopScore) ? Math.max(0, Math.min(100, Math.round(payload.slopScore))) : 0;
  const payoff = (payload.payoffFromPrev || "").trim();
  const payoffSection = payoff ? `
## Payoff from Previous Episode
${payoff}
` : "";
  const scriptDraftContent = payload.scriptDraft && payload.scriptDraft.trim() ? payload.scriptDraft.trim() : `- [ ] Write 35-second spoken copy
- [ ] Verify no banned AI clich\xE9s
- [ ] Run \`Mitos: Lint Current Note for AI Slop\``;
  return `---
title: ${yamlStr(payload.title)}
hook: ${yamlStr(payload.hook)}
angle_type: ${payload.angleType}
status: ${payload.status || "planned"}
publish_date: ${payload.publishDate}
series_id: ${yamlStr(payload.seriesId || "")}
episode: ${payload.episode || 0}
series_total: ${payload.seriesTotal || 0}
prev: ${yamlStr(payload.prev || "")}
next: ${yamlStr(payload.next || "")}
visual_anchor: ${yamlStr(payload.visualAnchor)}
slop_score: ${slopScore}
tags:
${tagLines}
---

# ${payload.title}

> **Target Hook (0-3s):**  
> "${payload.hook}"

## Core Tension & Problem
${payload.coreTension}
${payoffSection}
## Visual Proof Anchor
${payload.visualAnchor}

## Script Draft
${scriptDraftContent}

## Forward Connection / Open Loop
${payload.openLoop || payload.cliffhanger || ""}
`;
}
function buildSeriesIndexContent(series, seriesId, episodesWithFiles) {
  const outlineLines = episodesWithFiles.map((ep, idx) => {
    const base = ep.filename.replace(/\.md$/, "").split("/").pop() || "";
    const label = sanitizeWikilinkLabel(`Ep ${ep.episode.n}: ${ep.episode.title}`);
    return `${idx + 1}. [[${base}|${label}]]`;
  }).join("\n");
  return `---
type: series
title: ${yamlStr(series.series_title)}
series_id: ${seriesId}
archetype: ${series.archetype}
episodes: ${series.episodes.length}
cadence_days: ${normalizeCadenceDays(series.cadenceDays)}
status: planned
tags:
  - content/series
---

# ${series.series_title}

- **Premise:** ${series.premise}
- **Archetype:** ${series.archetype}

## Episode Outline
${outlineLines}
`;
}
async function writeNotesAtomic(vault, filesToWrite) {
  const writtenPaths = [];
  const previousContents = /* @__PURE__ */ new Map();
  try {
    for (const item of filesToWrite) {
      const folder = item.path.split("/").slice(0, -1).join("/");
      if (folder && !await vault.exists(folder)) {
        await vault.createFolder(folder);
      }
      if (await vault.exists(item.path)) {
        previousContents.set(item.path, await vault.read(item.path));
      }
      await vault.write(item.path, item.content);
      writtenPaths.push(item.path);
    }
    return writtenPaths;
  } catch (err) {
    for (const path2 of [...writtenPaths].reverse()) {
      try {
        const previous = previousContents.get(path2);
        if (previous === void 0) {
          await vault.delete(path2);
        } else {
          await vault.write(path2, previous);
        }
      } catch {
      }
    }
    throw new MitosError(`Atomic write failed: ${err.message}. Rolled back ${writtenPaths.length} file(s).`, "vault");
  }
}

// src/core/calendar.ts
var DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
function formatDailyNoteFilename(dateStr, format = DEFAULT_DAILY_NOTE_FORMAT) {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return `${dateStr}.md`;
  }
  const [year, month, day] = parts;
  const effectiveFormat = format.trim();
  const hasDateToken = /YYYY|YY|MM|M|DD|D/.test(effectiveFormat);
  const unsupported = effectiveFormat.replace(/YYYY|YY|MM|M|DD|D/g, "").replace(/[/\-_. ]/g, "");
  if (!hasDateToken || unsupported.length > 0) {
    return `${dateStr}.md`;
  }
  const tokens = {
    YYYY: String(year).padStart(4, "0"),
    YY: String(year % 100).padStart(2, "0"),
    MM: String(month).padStart(2, "0"),
    M: String(month),
    DD: String(day).padStart(2, "0"),
    D: String(day)
  };
  return `${effectiveFormat.replace(/YYYY|YY|MM|M|DD|D/g, (token) => tokens[token])}.md`;
}
async function resolveDailyNotePath(vault, dateStr) {
  let folder = "";
  let format = DEFAULT_DAILY_NOTE_FORMAT;
  const configPath = ".obsidian/daily-notes.json";
  if (await vault.exists(configPath)) {
    try {
      const raw = await vault.read(configPath);
      const parsed = JSON.parse(raw);
      if (parsed.folder) {
        folder = normalizeFolder(String(parsed.folder));
      }
      if (typeof parsed.format === "string" && parsed.format.trim()) {
        format = parsed.format.trim();
      }
    } catch {
    }
  }
  const filename = formatDailyNoteFilename(dateStr, format);
  return normalizeFolder(folder ? `${folder}/${filename}` : filename);
}
async function appendLinkToDailyNote(vault, dateStr, noteBasename, hookText) {
  const dailyNotePath = await resolveDailyNotePath(vault, dateStr);
  const wikilink = `[[${noteBasename}]]`;
  const hookLine = String(hookText || "").replace(/[\r\n]+/g, " ").trim();
  const lineToAppend = `- ${wikilink} \u2014 ${hookLine}`;
  if (await vault.exists(dailyNotePath)) {
    if (vault.process) {
      let appended = false;
      await vault.process(dailyNotePath, (data) => {
        if (data.includes(wikilink)) {
          return data;
        }
        appended = true;
        const trimmed2 = data.trimEnd();
        return trimmed2 ? `${trimmed2}
${lineToAppend}
` : `${lineToAppend}
`;
      });
      return appended;
    }
    const existingContent = await vault.read(dailyNotePath);
    if (existingContent.includes(wikilink)) {
      return false;
    }
    const trimmed = existingContent.trimEnd();
    const updated = trimmed ? `${trimmed}
${lineToAppend}
` : `${lineToAppend}
`;
    await vault.write(dailyNotePath, updated);
    return true;
  } else {
    const parts = dailyNotePath.split("/");
    if (parts.length > 1) {
      const parentFolder = parts.slice(0, -1).join("/");
      if (!await vault.exists(parentFolder)) {
        await vault.createFolder(parentFolder);
      }
    }
    const initialContent = `# Daily Note: ${dateStr}

## Content Scheduled
${lineToAppend}
`;
    await vault.write(dailyNotePath, initialContent);
    return true;
  }
}

// src/core/kanban.ts
var DEFAULT_KANBAN_TEMPLATE = `---
kanban-plugin: board
---

## Ideas

## Scripted

## Scheduled

## Published
`;
var LANE_ALIASES = {
  ideas: ["ideas", "idea", "backlog", "inbox"],
  scripted: ["scripted", "drafting", "writing"],
  scheduled: ["scheduled", "planned", "queued", "calendar"],
  published: ["published", "done", "live", "completed"]
};
function findTargetLaneHeader(boardContent, targetStatus) {
  const lines = boardContent.split("\n");
  const headers = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      headers.push(line.slice(3).trim());
    }
  }
  if (headers.length === 0)
    return null;
  const statusNorm = targetStatus.toLowerCase();
  let targetGroup = "scheduled";
  for (const [group, aliases] of Object.entries(LANE_ALIASES)) {
    if (aliases.includes(statusNorm)) {
      targetGroup = group;
      break;
    }
  }
  const groupAliases = LANE_ALIASES[targetGroup] || [targetGroup];
  for (const h of headers) {
    const headerTokens = h.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (groupAliases.some((alias) => headerTokens.includes(alias))) {
      return h;
    }
  }
  return headers[0];
}
function insertCardIntoBoard(boardContent, laneName, cardLine) {
  const lines = boardContent.split("\n");
  const targetHeader = `## ${laneName}`;
  const headerIdx = lines.findIndex((l) => l.trim().toLowerCase() === targetHeader.toLowerCase());
  if (headerIdx === -1) {
    return `${boardContent.trimEnd()}

## ${laneName}
${cardLine}
`;
  }
  let nextHeadingIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      nextHeadingIdx = i;
      break;
    }
  }
  let lastCardIdx = -1;
  for (let i = headerIdx + 1; i < nextHeadingIdx; i++) {
    if (lines[i].trim().startsWith("- [ ]") || lines[i].trim().startsWith("- [x]")) {
      lastCardIdx = i;
    }
  }
  if (lastCardIdx !== -1) {
    lines.splice(lastCardIdx + 1, 0, cardLine);
  } else {
    lines.splice(headerIdx + 1, 0, cardLine);
  }
  return lines.join("\n");
}
async function appendCardToKanban(vault, contentFolder, noteBasename, status = "planned") {
  const cleanFolder = normalizeFolder(contentFolder);
  const pipelinePath = joinVaultPath(cleanFolder, "_pipeline.md");
  const cardLine = `- [ ] [[${noteBasename}]]`;
  const processFn = (content) => {
    let current = content || DEFAULT_KANBAN_TEMPLATE;
    const wikilink = `[[${noteBasename}]]`;
    if (current.includes(wikilink)) {
      return current;
    }
    const lane = findTargetLaneHeader(current, status) || "Scheduled";
    return insertCardIntoBoard(current, lane, cardLine);
  };
  if (cleanFolder && !await vault.exists(cleanFolder)) {
    await vault.createFolder(cleanFolder);
  }
  if (vault.process) {
    if (!await vault.exists(pipelinePath)) {
      await vault.write(pipelinePath, DEFAULT_KANBAN_TEMPLATE);
    }
    return await vault.process(pipelinePath, processFn);
  } else {
    let current = DEFAULT_KANBAN_TEMPLATE;
    if (await vault.exists(pipelinePath)) {
      current = await vault.read(pipelinePath);
    }
    const updated = processFn(current);
    await vault.write(pipelinePath, updated);
    return updated;
  }
}

// src/core/actions.ts
async function createAngleNote(vault, contentFolder, angle, publishDate, options) {
  const folder = normalizeFolder(contentFolder);
  const slug = slugify(angle.title);
  const baseFilename = `${publishDate}-${slug}.md`;
  const targetPath = await resolveCollision(vault, folder, baseFilename);
  const basename = targetPath.split("/").pop()?.replace(/\.md$/, "") || slug;
  const status = options?.status || "planned";
  const content = buildStandaloneNoteContent({
    title: angle.title,
    hook: angle.hook,
    angleType: angle.angleType,
    status,
    publishDate,
    visualAnchor: angle.visualProofAnchor,
    slopScore: angle.lint?.score ?? 0,
    coreTension: angle.coreTension,
    openLoop: angle.openLoop,
    scriptDraft: options?.scriptDraft || angle.scriptDraft,
    tags: ["content/short-form", `content/${angle.angleType.replace("_", "-")}`]
  });
  await writeNotesAtomic(vault, [{ path: targetPath, content }]);
  try {
    await appendLinkToDailyNote(vault, publishDate, basename, angle.hook);
  } catch {
  }
  try {
    const lane = options?.kanbanLane ?? "planned";
    await appendCardToKanban(vault, folder, basename, lane);
  } catch {
  }
  return { path: targetPath, basename, status };
}

// src/core/series.ts
async function writeSeriesAtomic(vault, series, contentFolder, startDateStr, cadenceDays = 2) {
  const cleanFolder = normalizeFolder(contentFolder);
  const seriesFolder = cleanFolder ? `${cleanFolder}/series` : "series";
  const baseSeriesId = slugify(series.series_title);
  const safeCadence = normalizeCadenceDays(
    cadenceDays,
    normalizeCadenceDays(series.cadenceDays)
  );
  const start = startDateStr || getDefaultPublishDate();
  const dates = calculateCadenceDates(start, series.episodes.length, safeCadence);
  const plannedEpisodes = [];
  for (let i = 0; i < series.episodes.length; i++) {
    const ep = series.episodes[i];
    const date = dates[i];
    const slug = slugify(ep.title);
    const baseFilename = `${date}-${slug}.md`;
    const resolvedPath = await resolveCollision(vault, cleanFolder, baseFilename);
    const basename = resolvedPath.split("/").pop()?.replace(/\.md$/, "") || slug;
    plannedEpisodes.push({
      episode: ep,
      date,
      targetPath: resolvedPath,
      basename
    });
  }
  const indexBaseFilename = `${baseSeriesId}.md`;
  const indexFilePath = await resolveCollision(vault, seriesFolder, indexBaseFilename);
  const seriesId = indexFilePath.split("/").pop()?.replace(/\.md$/, "") || baseSeriesId;
  const filesToWrite = [];
  for (let i = 0; i < plannedEpisodes.length; i++) {
    const item = plannedEpisodes[i];
    const prevBasename = i > 0 ? plannedEpisodes[i - 1].basename : "";
    const nextBasename = i < plannedEpisodes.length - 1 ? plannedEpisodes[i + 1].basename : "";
    const content = buildStandaloneNoteContent({
      title: item.episode.title,
      hook: item.episode.hook,
      angleType: "series_episode",
      status: "planned",
      publishDate: item.date,
      seriesId,
      episode: item.episode.n,
      seriesTotal: plannedEpisodes.length,
      prev: prevBasename ? `[[${prevBasename}]]` : "",
      next: nextBasename ? `[[${nextBasename}]]` : "",
      visualAnchor: item.episode.visualProofAnchor,
      slopScore: item.episode.lint?.score ?? 85,
      coreTension: item.episode.coreTension,
      cliffhanger: item.episode.cliffhanger,
      payoffFromPrev: item.episode.payoff_from_prev,
      openLoop: item.episode.cliffhanger,
      tags: ["content/short-form", "content/series"]
    });
    filesToWrite.push({
      path: item.targetPath,
      content
    });
  }
  const indexContent = buildSeriesIndexContent(
    { ...series, cadenceDays: safeCadence },
    seriesId,
    plannedEpisodes.map((p) => ({
      episode: p.episode,
      filename: p.targetPath,
      publishDate: p.date
    }))
  );
  filesToWrite.push({
    path: indexFilePath,
    content: indexContent
  });
  await writeNotesAtomic(vault, filesToWrite);
  const episodeFilePaths = plannedEpisodes.map((p) => p.targetPath);
  for (const item of plannedEpisodes) {
    try {
      await appendLinkToDailyNote(vault, item.date, item.basename, item.episode.hook);
    } catch {
    }
    try {
      await appendCardToKanban(vault, cleanFolder, item.basename, "planned");
    } catch {
    }
  }
  return {
    indexFilePath,
    episodeFilePaths
  };
}

// src/core/node-fs-vault.ts
import * as fs from "fs";
import * as path from "path";
var NodeFsVault = class {
  constructor(vaultRoot) {
    this.vaultRoot = path.resolve(vaultRoot);
  }
  resolvePath(relativePath) {
    const cleanRel = relativePath.replace(/^[/\\]+/, "");
    const resolved = path.resolve(this.vaultRoot, cleanRel);
    const relativeToRoot = path.relative(this.vaultRoot, resolved);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new MitosError(`Access denied: path traverses outside vault root: ${relativePath}`, "vault");
    }
    return resolved;
  }
  async exists(filePath) {
    try {
      await fs.promises.access(this.resolvePath(filePath));
      return true;
    } catch {
      return false;
    }
  }
  async read(filePath) {
    const fullPath = this.resolvePath(filePath);
    return await fs.promises.readFile(fullPath, "utf-8");
  }
  async write(filePath, content) {
    const fullPath = this.resolvePath(filePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content, "utf-8");
  }
  async createFolder(folder) {
    const fullPath = this.resolvePath(folder);
    await fs.promises.mkdir(fullPath, { recursive: true });
  }
  async delete(filePath) {
    const fullPath = this.resolvePath(filePath);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  async getMarkdownFiles() {
    const results = [];
    const walk = async (currentDir) => {
      let entries;
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          continue;
        }
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const rel = path.relative(this.vaultRoot, fullPath).replace(/\\/g, "/");
          const basename = entry.name.slice(0, -3);
          results.push({ path: rel, basename });
        }
      }
    };
    await walk(this.vaultRoot);
    return results;
  }
  async process(filePath, fn) {
    const fullPath = this.resolvePath(filePath);
    let current = "";
    try {
      current = await fs.promises.readFile(fullPath, "utf-8");
    } catch (err) {
      if (err.code !== "ENOENT")
        throw err;
    }
    const updated = fn(current);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, updated, "utf-8");
    return updated;
  }
};

// src/core/mcp.ts
var MITOS_MCP_TOOLS = [
  {
    name: "mitos_brainstorm_angles",
    description: "Generate 3 anti-slop short-form technical video angles from a topic with concrete visual anchors and hook budgets.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Technical topic, feature, bug, or concept to brainstorm"
        },
        context: {
          type: "string",
          description: "Optional code snippet or active note context"
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "mitos_plan_series",
    description: "Architect a 3-part interconnected short-form video series arc with closed link integrity and narrative throughline.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Technical topic for the series"
        },
        archetype: {
          type: "string",
          enum: ["3_act_engineering_problem", "deep_dive_breakdown", "versus_comparison"],
          description: "Narrative blueprint archetype"
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "mitos_lint_script",
    description: "Lint a spoken script or hook for banned AI buzzwords, verbose openings, and verifiable proof anchors.",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "Spoken script or draft note to inspect"
        },
        strictness: {
          type: "string",
          enum: ["lenient", "standard", "ruthless"],
          description: "Slop detection strictness level"
        }
      },
      required: ["script"]
    }
  },
  {
    name: "mitos_save_angle_note",
    description: "Persist a generated short-form technical angle note directly to the Obsidian vault filesystem and update the Kanban pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        vaultPath: {
          type: "string",
          description: "Absolute path to the Obsidian vault root. Falls back to MITOS_VAULT_PATH environment variable or current working directory."
        },
        contentFolder: {
          type: "string",
          description: 'Relative folder inside the vault for content notes (default: "content").'
        },
        title: {
          type: "string",
          description: "Title of the angle note."
        },
        hook: {
          type: "string",
          description: "Opening spoken hook (0-3s)."
        },
        angleType: {
          type: "string",
          enum: ["pain_point", "contrarian", "teardown"],
          description: "Narrative angle type archetype."
        },
        coreTension: {
          type: "string",
          description: "Core tension, engineering gotcha, or problem."
        },
        visualProofAnchor: {
          type: "string",
          description: "Visual evidence anchor (terminal log, benchmark metric, code diff)."
        },
        scriptDraft: {
          type: "string",
          description: "Optional full 35s spoken draft script."
        },
        openLoop: {
          type: "string",
          description: "Optional forward connection, cliffhanger, or next step."
        },
        publishDate: {
          type: "string",
          description: "Target publish date in YYYY-MM-DD format (default: today)."
        }
      },
      required: ["title", "hook", "angleType", "coreTension", "visualProofAnchor"]
    }
  },
  {
    name: "mitos_save_series",
    description: "Persist a multi-part series plan directly to the Obsidian vault with atomic multi-note links and update the Kanban pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        vaultPath: {
          type: "string",
          description: "Absolute path to the Obsidian vault root. Falls back to MITOS_VAULT_PATH environment variable or current working directory."
        },
        contentFolder: {
          type: "string",
          description: 'Relative folder inside the vault for content notes (default: "content").'
        },
        series: {
          type: "object",
          description: "Validated SeriesPlan object containing series_title, premise, archetype, and episodes."
        },
        startDate: {
          type: "string",
          description: "Optional start publish date in YYYY-MM-DD format (default: tomorrow)."
        },
        cadenceDays: {
          type: "number",
          description: "Publish cadence in days between episodes (default: 2)."
        }
      },
      required: ["series"]
    }
  }
];
async function handleMcpToolCall(name, args) {
  try {
    switch (name) {
      case "mitos_lint_script": {
        const text = String(args.script || "");
        const strictness = args.strictness || "standard";
        const result = lintScriptForSlop(text, strictness);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      case "mitos_brainstorm_angles": {
        const topic = String(args.topic || "");
        const context = args.context ? String(args.context) : void 0;
        const prompt = buildAnglePrompt(topic, context);
        return {
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        };
      }
      case "mitos_plan_series": {
        const topic = String(args.topic || "");
        const archetype = args.archetype || "3_act_engineering_problem";
        const prompt = buildSeriesPrompt(topic, archetype, 3);
        return {
          content: [
            {
              type: "text",
              text: prompt
            }
          ]
        };
      }
      case "mitos_save_angle_note": {
        const title = args.title ? String(args.title).trim() : "";
        const hook = args.hook ? String(args.hook).trim() : "";
        const angleType = args.angleType;
        const coreTension = args.coreTension ? String(args.coreTension).trim() : "";
        const visualProofAnchor = args.visualProofAnchor ? String(args.visualProofAnchor).trim() : "";
        const scriptDraft = args.scriptDraft !== void 0 ? String(args.scriptDraft) : void 0;
        const openLoop = args.openLoop ? String(args.openLoop).trim() : "";
        if (!title)
          throw new Error("Missing required parameter: title");
        if (!hook)
          throw new Error("Missing required parameter: hook");
        if (!angleType || !["pain_point", "contrarian", "teardown"].includes(angleType)) {
          throw new Error("Invalid or missing angleType. Must be one of: pain_point, contrarian, teardown");
        }
        if (!coreTension)
          throw new Error("Missing required parameter: coreTension");
        if (!visualProofAnchor)
          throw new Error("Missing required parameter: visualProofAnchor");
        const vaultPath = args.vaultPath || process.env.MITOS_VAULT_PATH || process.cwd();
        const contentFolder = args.contentFolder !== void 0 ? String(args.contentFolder) : "content";
        const publishDate = args.publishDate ? String(args.publishDate).trim() : formatDate(/* @__PURE__ */ new Date());
        const textToLint = scriptDraft && scriptDraft.trim() ? scriptDraft : hook;
        const lintResult = lintScriptForSlop(textToLint, "standard", hook);
        const angle = {
          id: `angle-${Date.now()}`,
          angleType,
          title,
          hook,
          coreTension,
          visualProofAnchor,
          openLoop,
          lint: lintResult
        };
        const vault = new NodeFsVault(vaultPath);
        const saved = await createAngleNote(vault, contentFolder, angle, publishDate, {
          status: "planned",
          kanbanLane: "ideas",
          scriptDraft
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  path: saved.path,
                  basename: saved.basename,
                  status: saved.status || "planned",
                  slopScore: lintResult.score,
                  kanbanLane: "Ideas"
                },
                null,
                2
              )
            }
          ]
        };
      }
      case "mitos_save_series": {
        if (!args.series || typeof args.series !== "object") {
          throw new Error("Missing required parameter: series");
        }
        const vaultPath = args.vaultPath || process.env.MITOS_VAULT_PATH || process.cwd();
        const contentFolder = args.contentFolder !== void 0 ? String(args.contentFolder) : "content";
        const vault = new NodeFsVault(vaultPath);
        const result = await writeSeriesAtomic(
          vault,
          args.series,
          contentFolder,
          args.startDate ? String(args.startDate) : void 0,
          args.cadenceDays ? Number(args.cadenceDays) : 2
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  indexFilePath: result.indexFilePath,
                  episodeFilePaths: result.episodeFilePaths,
                  status: "planned"
                },
                null,
                2
              )
            }
          ]
        };
      }
      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown Mitos MCP tool: ${name}`
            }
          ],
          isError: true
        };
    }
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${err.message}`
        }
      ],
      isError: true
    };
  }
}

// src/mcp-server.ts
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});
function sendResponse(id, result, error) {
  const payload = {
    jsonrpc: "2.0",
    id
  };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + "\n");
}
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed)
    return;
  let jsonStr = trimmed;
  if (jsonStr.startsWith("{")) {
  } else {
    const idx = jsonStr.indexOf("{");
    if (idx !== -1) {
      jsonStr = jsonStr.slice(idx);
    } else {
      return;
    }
  }
  let message;
  try {
    message = JSON.parse(jsonStr);
  } catch {
    sendResponse(null, void 0, { code: -32700, message: "Parse error" });
    return;
  }
  if (message.id === void 0 || message.id === null) {
    return;
  }
  const { id, method, params } = message;
  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "mitos",
          version: "0.1.0"
        }
      });
      break;
    case "tools/list":
      sendResponse(id, {
        tools: MITOS_MCP_TOOLS
      });
      break;
    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const result = await handleMcpToolCall(toolName, toolArgs);
      sendResponse(id, result);
      break;
    }
    case "ping":
      sendResponse(id, {});
      break;
    default:
      sendResponse(id, void 0, {
        code: -32601,
        message: `Method not found: ${method}`
      });
  }
});
