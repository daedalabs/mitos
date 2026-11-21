import { describe, it, expect } from 'vitest';
import { joinVaultPath, normalizeFolder, sanitizeWikilinkLabel } from '../src/core/paths';

describe('vault path helpers', () => {
  it('normalizes empty, absolute, duplicated, and Windows-style folders', () => {
    expect(normalizeFolder(undefined)).toBe('');
    expect(normalizeFolder(null)).toBe('');
    expect(normalizeFolder('   ')).toBe('');
    expect(normalizeFolder('/content/')).toBe('content');
    expect(normalizeFolder('content//sub/')).toBe('content/sub');
    expect(normalizeFolder('content\\sub\\')).toBe('content/sub');
  });

  it('joins folder and filename without introducing a leading slash', () => {
    expect(joinVaultPath('', 'note.md')).toBe('note.md');
    expect(joinVaultPath('/content/', 'note.md')).toBe('content/note.md');
    expect(joinVaultPath(undefined, '/note.md')).toBe('note.md');
  });

  it('strips characters that would corrupt a wikilink label', () => {
    expect(sanitizeWikilinkLabel('Ep 1: The | Wall [#1]\nNext')).toBe('Ep 1: The Wall 1 Next');
    expect(sanitizeWikilinkLabel('  Clean   label  ')).toBe('Clean label');
  });
});
