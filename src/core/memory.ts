import { ContentEntry, VaultLike } from './types';
import { normalizeFolder } from './paths';
import { computeTokenJaccard } from './text';

export { computeTokenJaccard } from './text';

export function parseSimpleFrontmatter(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!content.startsWith('---')) return result;

  const endIdx = content.indexOf('\n---', 3);
  if (endIdx === -1) return result;

  const yamlBlock = content.slice(3, endIdx).trim();
  const lines = yamlBlock.split('\n');

  let currentKey = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && inList && currentKey) {
      const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, '');
      if (Array.isArray(result[currentKey])) {
        result[currentKey].push(item);
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      currentKey = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      if (value === '') {
        inList = true;
        result[currentKey] = [];
      } else {
        inList = false;
        // Support inline flow sequences such as `tags: [content/short-form, content/pain-point]`.
        // Check the raw value so a quoted scalar like `"[Draft]"` stays a string.
        if (value.startsWith('[') && value.endsWith(']')) {
          result[currentKey] = value
            .slice(1, -1)
            .split(',')
            .map((item) => item.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        } else {
          result[currentKey] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}

export class MemoryScanner {
  private vault: VaultLike;
  private folder: string;

  constructor(vault: VaultLike, contentFolder: string) {
    this.vault = vault;
    this.folder = normalizeFolder(contentFolder);
  }

  async getAllEntries(): Promise<ContentEntry[]> {
    const files = await this.vault.getMarkdownFiles();
    const entries: ContentEntry[] = [];
    const prefix = this.folder ? `${this.folder}/` : '';

    for (const file of files) {
      // Strict folder boundary check: exact folder or folder/ prefix.
      // An empty folder means the vault root, so every markdown file is in scope.
      if (this.folder && file.path !== this.folder && !file.path.startsWith(prefix)) {
        continue;
      }

      try {
        const content = await this.vault.read(file.path);
        const fm = parseSimpleFrontmatter(content);

        entries.push({
          path: file.path,
          title: fm.title || file.basename,
          hook: fm.hook || undefined,
          tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
          publishDate: fm.publish_date || fm.date || undefined,
          series: fm.series_id || fm.series || undefined,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return entries;
  }

  async checkDuplicate(
    proposedTopic: string,
    proposedHook?: string
  ): Promise<{
    isDuplicate: boolean;
    matchedWith?: string;
    similarityScore: number;
    matches: ContentEntry[];
  }> {
    const entries = await this.getAllEntries();
    const matches: Array<{ entry: ContentEntry; score: number }> = [];

    const topicQuery = proposedTopic.trim();
    const hookQuery = (proposedHook || '').trim();

    for (const entry of entries) {
      let score = 0;

      // Title similarity
      const titleScore = computeTokenJaccard(topicQuery, entry.title);
      // Hook similarity if available
      const hookScore = hookQuery && entry.hook ? computeTokenJaccard(hookQuery, entry.hook) : 0;

      // Exact substring containment
      const lowerTopic = topicQuery.toLowerCase();
      const lowerEntryTitle = entry.title.toLowerCase();
      const containsMatch =
        (lowerTopic.length > 6 && lowerEntryTitle.includes(lowerTopic)) ||
        (lowerEntryTitle.length > 6 && lowerTopic.includes(lowerEntryTitle));

      score = Math.max(titleScore, hookScore);
      if (containsMatch && score < 0.6) {
        score = 0.65;
      }

      if (score >= 0.5) {
        matches.push({
          entry: { ...entry, similarityScore: Math.round(score * 100) / 100 },
          score,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3).map((m) => m.entry);

    const isDuplicate = matches.length > 0 && matches[0].score >= 0.6;
    const matchedWith = isDuplicate
      ? `${matches[0].entry.title} (${matches[0].entry.path}) [Score: ${(matches[0].score * 100).toFixed(0)}%]`
      : undefined;

    return {
      isDuplicate,
      matchedWith,
      similarityScore: matches.length > 0 ? matches[0].score : 0,
      matches: topMatches,
    };
  }
}
