import { Angle, AngleType, AntiSlopStrictness, Episode, MitosError, SeriesArchetype, SeriesPlan } from './types';
import { lintScriptForSlop } from './anti_slop';
import { normalizeCadenceDays } from './dates';
import { computeTokenJaccard } from './text';

/** Attempt to parse a JSON candidate, retrying once with common model-output repairs. */
function tryParseJsonCandidate(candidate: string): { ok: true; value: any } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch {
    try {
      const repaired = candidate
        .replace(/,\s*([}\]])/g, '$1') // trailing commas
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
      return { ok: true, value: JSON.parse(repaired) };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Extract the balanced JSON value that starts at `startIdx`, respecting
 * strings and escapes so braces inside prose or string literals do not
 * truncate the payload.
 */
function findBalancedCandidate(text: string, startIdx: number): string | null {
  const openChar = text[startIdx];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return null;
}

export function extractJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new MitosError('Empty response received from AI provider', 'parse');
  }

  let cleaned = rawText.trim();

  // Strip code fences like ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');

  // Try every balanced `{...}` / `[...]` candidate and keep the longest one
  // that parses. This survives conversational preambles, prose containing
  // braces, and stray bracket examples such as "here are [3] angles".
  let best: { value: any; length: number; index: number } | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char !== '{' && char !== '[') continue;

    const candidate = findBalancedCandidate(cleaned, i);
    if (!candidate) continue;

    const parsed = tryParseJsonCandidate(candidate);
    if (!parsed.ok) continue;

    if (!best || candidate.length > best.length || (candidate.length === best.length && i < best.index)) {
      best = { value: parsed.value, length: candidate.length, index: i };
    }
  }

  if (!best) {
    if (!cleaned.includes('{') && !cleaned.includes('[')) {
      throw new MitosError('No JSON object or array found in provider response', 'parse');
    }
    throw new MitosError('Failed to parse AI JSON response: no balanced JSON value found', 'parse');
  }

  return best.value;
}

export function validateAngles(raw: any, strictness: AntiSlopStrictness = 'standard'): Angle[] {
  if (!raw || typeof raw !== 'object') {
    throw new MitosError('Invalid payload: expected JSON object', 'parse');
  }

  const rawAngles = Array.isArray(raw.angles) ? raw.angles : (Array.isArray(raw) ? raw : null);
  if (!rawAngles || rawAngles.length === 0) {
    throw new MitosError('No angles found in model output', 'parse');
  }

  const validAngleTypes: AngleType[] = ['pain_point', 'contrarian', 'teardown'];

  return rawAngles.map((a: any, idx: number) => {
    const rawType = String(a.angleType || '').toLowerCase();
    const angleType: AngleType = validAngleTypes.includes(rawType as AngleType)
      ? (rawType as AngleType)
      : idx === 0 ? 'pain_point' : idx === 1 ? 'contrarian' : 'teardown';

    const title = String(a.title || `Angle ${idx + 1}`).trim();
    const hook = String(a.hook || '').trim();
    const coreTension = String(a.coreTension || '').trim();
    const visualProofAnchor = String(a.visualProofAnchor || '').trim();
    const openLoop = String(a.openLoop || '').trim();

    if (!hook) {
      throw new MitosError(`Angle ${idx + 1} is missing a hook`, 'parse');
    }

    const fullScript = `${hook} ${coreTension} ${visualProofAnchor}`;
    const lint = lintScriptForSlop(fullScript, strictness, hook);

    return {
      id: `angle-${idx + 1}`,
      angleType,
      title,
      hook,
      coreTension,
      visualProofAnchor,
      openLoop,
      lint,
    };
  });
}

const VALID_ARCHETYPES: SeriesArchetype[] = [
  '3_act_engineering_problem',
  'deep_dive_breakdown',
  'versus_comparison',
];

export function validateSeries(raw: any, strictness: AntiSlopStrictness = 'standard'): SeriesPlan {
  if (!raw || typeof raw !== 'object') {
    throw new MitosError('Invalid series response: expected JSON object', 'parse');
  }

  const series_title = String(raw.series_title || raw.title || 'Untitled Series').trim();
  const premise = String(raw.premise || '').trim();
  const rawArchetype = String(raw.archetype || '');
  const archetype: SeriesArchetype = VALID_ARCHETYPES.includes(rawArchetype as SeriesArchetype)
    ? (rawArchetype as SeriesArchetype)
    : '3_act_engineering_problem';

  const rawEpisodes = raw.episodes;
  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    throw new MitosError('Series has no episodes', 'parse');
  }

  const episodes: Episode[] = [];

  for (let i = 0; i < rawEpisodes.length; i++) {
    const ep = rawEpisodes[i];
    // The data contract defines `n` as the 1-based position in the arc.
    // Normalize here so model-supplied numbering cannot desynchronize the
    // episode frontmatter from the prev/next chain built later.
    const n = i + 1;
    const title = String(ep.title || `Episode ${n}`).trim();
    const hook = String(ep.hook || '').trim();
    const coreTension = String(ep.coreTension || '').trim();
    const visualProofAnchor = String(ep.visualProofAnchor || '').trim();
    const cliffhanger = String(ep.cliffhanger || '').trim();
    const payoff_from_prev = String(ep.payoff_from_prev || '').trim();

    if (!title || !hook) {
      throw new MitosError(`Episode ${n} missing required title or hook`, 'parse');
    }

    if (i > 0 && !payoff_from_prev) {
      throw new MitosError(`Episode ${n} is missing payoff_from_prev linking back to Episode ${n - 1}`, 'parse');
    }

    const fullScript = `${hook} ${coreTension} ${visualProofAnchor}`;
    const lint = lintScriptForSlop(fullScript, strictness, hook);

    episodes.push({
      n,
      title,
      hook,
      coreTension,
      visualProofAnchor,
      cliffhanger,
      payoff_from_prev,
      lint,
    });
  }

  // Cross-episode duplicate hook check (hook Jaccard < 0.7)
  for (let i = 0; i < episodes.length; i++) {
    for (let j = i + 1; j < episodes.length; j++) {
      const similarity = computeTokenJaccard(episodes[i].hook, episodes[j].hook);
      if (similarity >= 0.7) {
        throw new MitosError(
          `Episodes ${episodes[i].n} and ${episodes[j].n} have nearly identical hooks (Jaccard: ${similarity.toFixed(2)})`,
          'parse'
        );
      }
    }
  }

  return {
    series_title,
    premise,
    archetype,
    episodes,
    cadenceDays: normalizeCadenceDays(raw.cadenceDays),
  };
}
