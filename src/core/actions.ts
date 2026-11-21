import { Angle, VaultLike } from './types';
import { buildStandaloneNoteContent, resolveCollision, slugify, writeNotesAtomic } from './notes';
import { appendLinkToDailyNote } from './calendar';
import { appendCardToKanban } from './kanban';
import { normalizeFolder } from './paths';

export interface CreateAngleNoteOptions {
  status?: string;
  kanbanLane?: string;
  scriptDraft?: string;
}

export interface SavedAngleNote {
  path: string;
  basename: string;
  status?: string;
}

/**
 * Persist a single angle as a content note and fan out the best-effort
 * Calendar/Kanban integrations. Shared by the sidebar view and the quick
 * capture modal so the write contract lives in one headless place.
 */
export async function createAngleNote(
  vault: VaultLike,
  contentFolder: string,
  angle: Angle,
  publishDate: string,
  options?: CreateAngleNoteOptions
): Promise<SavedAngleNote> {
  const folder = normalizeFolder(contentFolder);
  const slug = slugify(angle.title);
  const baseFilename = `${publishDate}-${slug}.md`;
  const targetPath = await resolveCollision(vault, folder, baseFilename);
  const basename = targetPath.split('/').pop()?.replace(/\.md$/, '') || slug;
  const status = options?.status || 'planned';

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
    scriptDraft: options?.scriptDraft || (angle as any).scriptDraft,
    tags: ['content/short-form', `content/${angle.angleType.replace('_', '-')}`],
  });

  await writeNotesAtomic(vault, [{ path: targetPath, content }]);

  // Integration side effects run only after the note is safely on disk and
  // must never fail the primary write.
  try {
    await appendLinkToDailyNote(vault, publishDate, basename, angle.hook);
  } catch {
    // Non-fatal integration failure
  }

  try {
    const lane = options?.kanbanLane ?? 'planned';
    await appendCardToKanban(vault, folder, basename, lane);
  } catch {
    // Non-fatal integration failure
  }

  return { path: targetPath, basename, status };
}
