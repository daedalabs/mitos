// Headless vault path helpers — zero Obsidian imports allowed.

/**
 * Normalize a content/config folder into a vault-relative POSIX path.
 *
 * Accepts `undefined`, empty strings, Windows separators, duplicate slashes,
 * and leading/trailing slashes. The vault root is represented by `''`.
 */
export function normalizeFolder(folder?: string | null): string {
  return (folder || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

/**
 * Join a vault folder and a filename, avoiding the leading slash that naive
 * `${folder}/${name}` interpolation produces when `folder` is empty.
 */
export function joinVaultPath(folder: string | null | undefined, filename: string): string {
  const cleanFolder = normalizeFolder(folder);
  const cleanName = filename.replace(/^\/+/, '');
  return cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;
}

/**
 * Build a safe wikilink display label. `|`, `[`, `]`, `#`, `^` and newlines
 * have special meaning inside Obsidian wikilinks and would corrupt the link.
 */
export function sanitizeWikilinkLabel(label: string): string {
  return label
    .replace(/[|[\]#^\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
