import { Angle, Episode, MitosError, SeriesPlan, VaultLike } from './types';
import { normalizeCadenceDays } from './dates';
import { joinVaultPath, normalizeFolder, sanitizeWikilinkLabel } from './paths';

export function yamlStr(val: string): string {
  if (val === undefined || val === null) return '""';
  return JSON.stringify(String(val));
}

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics: Café -> Cafe
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  // Non-Latin titles otherwise produce an empty slug and a `YYYY-MM-DD-.md` file.
  return slug || 'untitled';
}

export async function resolveCollision(
  vault: VaultLike,
  folder: string,
  baseFilename: string
): Promise<string> {
  const cleanFolder = normalizeFolder(folder);
  const dotIndex = baseFilename.lastIndexOf('.');
  const name = dotIndex !== -1 ? baseFilename.slice(0, dotIndex) : baseFilename;
  const ext = dotIndex !== -1 ? baseFilename.slice(dotIndex) : '.md';

  let candidate = joinVaultPath(cleanFolder, `${name}${ext}`);
  if (!(await vault.exists(candidate))) {
    return candidate;
  }

  let counter = 2;
  while (counter < 100) {
    candidate = joinVaultPath(cleanFolder, `${name}-${counter}${ext}`);
    if (!(await vault.exists(candidate))) {
      return candidate;
    }
    counter++;
  }

  throw new MitosError(`Unable to resolve unique filename for ${baseFilename} in ${folder}`, 'vault');
}

export interface NotePayload {
  title: string;
  hook: string;
  angleType: string;
  status: string;
  publishDate: string;
  seriesId?: string;
  episode?: number;
  seriesTotal?: number;
  prev?: string;
  next?: string;
  visualAnchor: string;
  slopScore: number;
  coreTension: string;
  openLoop?: string;
  payoffFromPrev?: string;
  cliffhanger?: string;
  tags?: string[];
  scriptDraft?: string;
}

export function buildStandaloneNoteContent(payload: NotePayload): string {
  const tags = payload.tags || ['content/short-form', `content/${payload.angleType.replace('_', '-')}`];
  const tagLines = tags.map((t) => `  - ${t}`).join('\n');
  const slopScore = Number.isFinite(payload.slopScore)
    ? Math.max(0, Math.min(100, Math.round(payload.slopScore)))
    : 0;

  // Episode notes carry the payoff from the previous installment; without this
  // section the narrative callback is lost when the plan is written to disk.
  const payoff = (payload.payoffFromPrev || '').trim();
  const payoffSection = payoff ? `\n## Payoff from Previous Episode\n${payoff}\n` : '';

  const scriptDraftContent = payload.scriptDraft && payload.scriptDraft.trim()
    ? payload.scriptDraft.trim()
    : `- [ ] Write 35-second spoken copy\n- [ ] Verify no banned AI clichés\n- [ ] Run \`Mitos: Lint Current Note for AI Slop\``;

  return `---
title: ${yamlStr(payload.title)}
hook: ${yamlStr(payload.hook)}
angle_type: ${payload.angleType}
status: ${payload.status || 'planned'}
publish_date: ${payload.publishDate}
series_id: ${yamlStr(payload.seriesId || '')}
episode: ${payload.episode || 0}
series_total: ${payload.seriesTotal || 0}
prev: ${yamlStr(payload.prev || '')}
next: ${yamlStr(payload.next || '')}
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
${payload.openLoop || payload.cliffhanger || ''}
`;
}

export function buildSeriesIndexContent(
  series: SeriesPlan,
  seriesId: string,
  episodesWithFiles: Array<{ episode: Episode; filename: string; publishDate: string }>
): string {
  const outlineLines = episodesWithFiles
    .map((ep, idx) => {
      const base = ep.filename.replace(/\.md$/, '').split('/').pop() || '';
      const label = sanitizeWikilinkLabel(`Ep ${ep.episode.n}: ${ep.episode.title}`);
      return `${idx + 1}. [[${base}|${label}]]`;
    })
    .join('\n');

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

export async function writeNotesAtomic(
  vault: VaultLike,
  filesToWrite: Array<{ path: string; content: string }>
): Promise<string[]> {
  const writtenPaths: string[] = [];
  // Snapshot pre-existing content so a rollback restores it instead of deleting
  // a note that was already in the vault before the transaction started.
  const previousContents = new Map<string, string>();

  try {
    for (const item of filesToWrite) {
      // Ensure directory exists
      const folder = item.path.split('/').slice(0, -1).join('/');
      if (folder && !(await vault.exists(folder))) {
        await vault.createFolder(folder);
      }

      if (await vault.exists(item.path)) {
        previousContents.set(item.path, await vault.read(item.path));
      }

      await vault.write(item.path, item.content);
      writtenPaths.push(item.path);
    }
    return writtenPaths;
  } catch (err: any) {
    // Rollback in reverse order: restore overwritten files, delete newly created ones.
    for (const path of [...writtenPaths].reverse()) {
      try {
        const previous = previousContents.get(path);
        if (previous === undefined) {
          await vault.delete(path);
        } else {
          await vault.write(path, previous);
        }
      } catch {
        // Continue cleaning other files
      }
    }
    throw new MitosError(`Atomic write failed: ${err.message}. Rolled back ${writtenPaths.length} file(s).`, 'vault');
  }
}
