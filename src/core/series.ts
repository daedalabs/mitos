import { HttpClient, MitosError, MitosSettings, SeriesArchetype, SeriesPlan, VaultLike } from './types';
import { buildSeriesPrompt } from './prompts';
import { callAiProvider } from './providers';
import { extractJson, validateSeries } from './parse';
import { calculateCadenceDates, getDefaultPublishDate, normalizeCadenceDays } from './dates';
import {
  buildSeriesIndexContent,
  buildStandaloneNoteContent,
  resolveCollision,
  slugify,
  writeNotesAtomic,
} from './notes';
import { appendLinkToDailyNote } from './calendar';
import { appendCardToKanban } from './kanban';
import { normalizeFolder } from './paths';

export async function generateSeriesPlan(
  topic: string,
  archetype: SeriesArchetype,
  settings: MitosSettings,
  httpClient: HttpClient
): Promise<SeriesPlan> {
  const prompt = buildSeriesPrompt(topic, archetype, 3);
  const rawText = await callAiProvider(settings, prompt, httpClient);
  const json = extractJson(rawText);
  return validateSeries(json, settings.antiSlopStrictness);
}

export interface SeriesWriteResult {
  indexFilePath: string;
  episodeFilePaths: string[];
}

export async function writeSeriesAtomic(
  vault: VaultLike,
  series: SeriesPlan,
  contentFolder: string,
  startDateStr?: string,
  cadenceDays: number = 2
): Promise<SeriesWriteResult> {
  const cleanFolder = normalizeFolder(contentFolder);
  const seriesFolder = cleanFolder ? `${cleanFolder}/series` : 'series';
  const baseSeriesId = slugify(series.series_title);
  const safeCadence = normalizeCadenceDays(
    cadenceDays,
    normalizeCadenceDays(series.cadenceDays)
  );

  const start = startDateStr || getDefaultPublishDate();
  const dates = calculateCadenceDates(start, series.episodes.length, safeCadence);

  // 1. Plan filenames & resolve collisions
  const plannedEpisodes: Array<{
    episode: (typeof series.episodes)[0];
    date: string;
    targetPath: string;
    basename: string;
  }> = [];

  for (let i = 0; i < series.episodes.length; i++) {
    const ep = series.episodes[i];
    const date = dates[i];
    const slug = slugify(ep.title);
    const baseFilename = `${date}-${slug}.md`;
    const resolvedPath = await resolveCollision(vault, cleanFolder, baseFilename);
    const basename = resolvedPath.split('/').pop()?.replace(/\.md$/, '') || slug;

    plannedEpisodes.push({
      episode: ep,
      date,
      targetPath: resolvedPath,
      basename,
    });
  }

  // 2. Resolve index note path. If an index with this slug already exists the
  // filename gets a `-2` suffix, so the effective series id must follow it or
  // episode notes would point at a series index that does not exist.
  const indexBaseFilename = `${baseSeriesId}.md`;
  const indexFilePath = await resolveCollision(vault, seriesFolder, indexBaseFilename);
  const seriesId =
    indexFilePath.split('/').pop()?.replace(/\.md$/, '') || baseSeriesId;

  // 3. Build file contents with closed prev/next links
  const filesToWrite: Array<{ path: string; content: string }> = [];

  for (let i = 0; i < plannedEpisodes.length; i++) {
    const item = plannedEpisodes[i];
    const prevBasename = i > 0 ? plannedEpisodes[i - 1].basename : '';
    const nextBasename = i < plannedEpisodes.length - 1 ? plannedEpisodes[i + 1].basename : '';

    const content = buildStandaloneNoteContent({
      title: item.episode.title,
      hook: item.episode.hook,
      angleType: 'series_episode',
      status: 'planned',
      publishDate: item.date,
      seriesId,
      episode: item.episode.n,
      seriesTotal: plannedEpisodes.length,
      prev: prevBasename ? `[[${prevBasename}]]` : '',
      next: nextBasename ? `[[${nextBasename}]]` : '',
      visualAnchor: item.episode.visualProofAnchor,
      slopScore: item.episode.lint?.score ?? 85,
      coreTension: item.episode.coreTension,
      cliffhanger: item.episode.cliffhanger,
      payoffFromPrev: item.episode.payoff_from_prev,
      openLoop: item.episode.cliffhanger,
      tags: ['content/short-form', 'content/series'],
    });

    filesToWrite.push({
      path: item.targetPath,
      content,
    });
  }

  // Build index note content. Use the cadence actually used for the dates so
  // frontmatter never disagrees with the generated schedule.
  const indexContent = buildSeriesIndexContent(
    { ...series, cadenceDays: safeCadence },
    seriesId,
    plannedEpisodes.map((p) => ({
      episode: p.episode,
      filename: p.targetPath,
      publishDate: p.date,
    }))
  );

  filesToWrite.push({
    path: indexFilePath,
    content: indexContent,
  });

  // 4. Atomic write (rollback on failure)
  await writeNotesAtomic(vault, filesToWrite);

  const episodeFilePaths = plannedEpisodes.map((p) => p.targetPath);

  // 5. Post-write integrations (side-effects run only after all note writes succeed)
  for (const item of plannedEpisodes) {
    try {
      await appendLinkToDailyNote(vault, item.date, item.basename, item.episode.hook);
    } catch {
      // Non-fatal integration failure
    }

    try {
      await appendCardToKanban(vault, cleanFolder, item.basename, 'planned');
    } catch {
      // Non-fatal integration failure
    }
  }

  return {
    indexFilePath,
    episodeFilePaths,
  };
}
