import { AntiSlopStrictness, SlopLintResult } from './types';

export const BANNED_AI_WORDS = [
  'delve',
  'delving',
  'game-changer',
  'revolutionize',
  'unleash',
  'tapestry',
  'plethora',
  'testament',
  'beacon',
  'bustling',
  'in conclusion',
  'furthermore',
  'moreover',
  'at the end of the day',
  'have you ever wondered',
  'welcome back guys',
  'in this video i will',
  'let that sink in',
  'transformative',
  'pivotal',
  'seamless',
  'frictionless',
  'unprecedented',
];

export const PROOF_KEYWORDS = [
  'code',
  'benchmark',
  'error',
  'terminal',
  'ms',
  'fps',
  'memory',
  'cpu',
  'diff',
  'commit',
  'test',
  'reproduce',
  'slide',
  'transcript',
  'page',
  'line',
  'function',
  'query',
  'bug',
  'crash',
  'latency',
  'throughput',
  'profile',
  'heap',
  'allocation',
  'stack trace',
];

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Match keywords as whole words (plus common plurals) so "teams" no longer
// satisfies the "ms" proof anchor and "online" no longer satisfies "line".
const PROOF_KEYWORD_PATTERN = new RegExp(
  `\\b(?:${PROOF_KEYWORDS.map(escapeRegex).join('|')})(?:s|es)?\\b`,
  'i'
);

// Numeric measurements such as `40ms`, `2.4 s`, `120fps`, `8GB`, or `95%`.
const METRIC_PATTERN =
  /\b\d+(?:\.\d+)?\s?(?:ms|s|fps|ns|us|µs|kb|mb|gb|tb|qps|rps)\b|\d+(?:\.\d+)?\s?%/i;

export interface StrictnessRules {
  maxHookWords: number;
  passThreshold: number;
}

export const STRICTNESS_CONFIG: Record<AntiSlopStrictness, StrictnessRules> = {
  lenient: { maxHookWords: 18, passThreshold: 60 },
  standard: { maxHookWords: 15, passThreshold: 70 },
  ruthless: { maxHookWords: 12, passThreshold: 85 },
};

export function hasConcreteProof(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /\d/.test(trimmed) || PROOF_KEYWORD_PATTERN.test(trimmed) || METRIC_PATTERN.test(trimmed);
}

/**
 * Lint a script for AI clichés, hook verbosity, and missing proof anchors.
 *
 * `hookText` lets callers lint the actual opening hook independently from the
 * rest of the script. Without it a hook that lacks terminal punctuation would
 * be merged with the following sentence, inflating `hookWordCount`.
 */
export function lintScriptForSlop(
  text: string,
  strictness: AntiSlopStrictness = 'standard',
  hookText?: string
): SlopLintResult {
  const trimmed = text.trim();
  const rules = STRICTNESS_CONFIG[strictness] || STRICTNESS_CONFIG.standard;

  if (!trimmed) {
    return {
      score: 0,
      passed: false,
      warnings: ['Script is empty; nothing to lint.'],
      bannedWordsFound: [],
      hookWordCount: 0,
      hasConcreteProof: false,
      strictness,
    };
  }

  const sentences = trimmed.split(/(?<=[.?!])\s+/).filter(Boolean);
  const warnings: string[] = [];
  const bannedWordsFound: string[] = [];
  const lower = trimmed.toLowerCase();

  // 1. Check for banned clichés
  for (const word of BANNED_AI_WORDS) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
    if (regex.test(lower)) {
      bannedWordsFound.push(word);
    }
  }

  if (bannedWordsFound.length > 0) {
    warnings.push(
      `Detected ${bannedWordsFound.length} banned AI cliché(s): ${bannedWordsFound.join(', ')}`
    );
  }

  // 2. Check opening hook (explicit hook wins; otherwise fall back to first sentence)
  const firstSentence = sentences[0] || '';
  const hook = (hookText !== undefined ? String(hookText) : firstSentence).trim();
  const hookWordCount = hook.split(/\s+/).filter(Boolean).length;

  if (hookWordCount > rules.maxHookWords) {
    warnings.push(
      `Opening hook is too verbose (${hookWordCount} words). ${strictness} budget is <= ${rules.maxHookWords} words.`
    );
  }

  const hookLower = hook.toLowerCase();
  const usesWeakRhetoricalOpener =
    hookLower.startsWith('have you ever') || hookLower.startsWith('did you know that');
  if (usesWeakRhetoricalOpener) {
    warnings.push(
      'Opening uses a weak rhetorical question hook. Replace with a direct claim or visual conflict.'
    );
  }

  // 3. Check for concrete proof anchors
  const proofFound = hasConcreteProof(trimmed);

  if (!proofFound) {
    warnings.push(
      'No concrete proof anchor detected. Technical scripts must reference code, benchmark metrics, or visual proof.'
    );
  }

  // Score computation
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
    strictness,
  };
}
