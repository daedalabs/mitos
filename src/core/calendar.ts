import { VaultLike } from './types';
import { normalizeFolder } from './paths';

export interface DailyNotesConfig {
  folder?: string;
  format?: string;
}

export const DEFAULT_DAILY_NOTE_FORMAT = 'YYYY-MM-DD';

/**
 * Render the numeric subset of Obsidian's Moment-style daily note format.
 *
 * Formats containing unsupported tokens (weekday names, ordinal suffixes, …)
 * fall back to the default `YYYY-MM-DD` filename instead of writing a note to
 * a path the Daily Notes plugin would never open.
 */
export function formatDailyNoteFilename(
  dateStr: string,
  format: string = DEFAULT_DAILY_NOTE_FORMAT
): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return `${dateStr}.md`;
  }

  const [year, month, day] = parts;
  const effectiveFormat = format.trim();
  const hasDateToken = /YYYY|YY|MM|M|DD|D/.test(effectiveFormat);
  const unsupported = effectiveFormat
    .replace(/YYYY|YY|MM|M|DD|D/g, '')
    .replace(/[/\-_. ]/g, '');
  if (!hasDateToken || unsupported.length > 0) {
    return `${dateStr}.md`;
  }

  const tokens: Record<string, string> = {
    YYYY: String(year).padStart(4, '0'),
    YY: String(year % 100).padStart(2, '0'),
    MM: String(month).padStart(2, '0'),
    M: String(month),
    DD: String(day).padStart(2, '0'),
    D: String(day),
  };

  return `${effectiveFormat.replace(/YYYY|YY|MM|M|DD|D/g, (token) => tokens[token])}.md`;
}

export async function resolveDailyNotePath(
  vault: VaultLike,
  dateStr: string
): Promise<string> {
  let folder = '';
  let format = DEFAULT_DAILY_NOTE_FORMAT;
  const configPath = '.obsidian/daily-notes.json';

  if (await vault.exists(configPath)) {
    try {
      const raw = await vault.read(configPath);
      const parsed: DailyNotesConfig = JSON.parse(raw);
      if (parsed.folder) {
        folder = normalizeFolder(String(parsed.folder));
      }
      if (typeof parsed.format === 'string' && parsed.format.trim()) {
        format = parsed.format.trim();
      }
    } catch {
      // Use root and the default format on parse failure
    }
  }

  const filename = formatDailyNoteFilename(dateStr, format);
  return normalizeFolder(folder ? `${folder}/${filename}` : filename);
}

export async function appendLinkToDailyNote(
  vault: VaultLike,
  dateStr: string,
  noteBasename: string,
  hookText: string
): Promise<boolean> {
  const dailyNotePath = await resolveDailyNotePath(vault, dateStr);
  const wikilink = `[[${noteBasename}]]`;
  const hookLine = String(hookText || '').replace(/[\r\n]+/g, ' ').trim();
  const lineToAppend = `- ${wikilink} — ${hookLine}`;

  if (await vault.exists(dailyNotePath)) {
    // Prefer vault.process() for an atomic read-modify-write when the adapter
    // supports it; fall back to read+write for plain VaultLike implementations.
    if (vault.process) {
      let appended = false;
      await vault.process(dailyNotePath, (data) => {
        if (data.includes(wikilink)) {
          return data;
        }
        appended = true;
        const trimmed = data.trimEnd();
        return trimmed ? `${trimmed}\n${lineToAppend}\n` : `${lineToAppend}\n`;
      });
      return appended;
    }

    const existingContent = await vault.read(dailyNotePath);
    // Idempotency: skip if already linked
    if (existingContent.includes(wikilink)) {
      return false;
    }

    const trimmed = existingContent.trimEnd();
    const updated = trimmed ? `${trimmed}\n${lineToAppend}\n` : `${lineToAppend}\n`;
    await vault.write(dailyNotePath, updated);
    return true;
  } else {
    // Ensure parent folder exists
    const parts = dailyNotePath.split('/');
    if (parts.length > 1) {
      const parentFolder = parts.slice(0, -1).join('/');
      if (!(await vault.exists(parentFolder))) {
        await vault.createFolder(parentFolder);
      }
    }

    const initialContent = `# Daily Note: ${dateStr}\n\n## Content Scheduled\n${lineToAppend}\n`;
    await vault.write(dailyNotePath, initialContent);
    return true;
  }
}
