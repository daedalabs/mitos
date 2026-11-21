import { describe, it, expect } from 'vitest';
import {
  yamlStr,
  slugify,
  resolveCollision,
  buildStandaloneNoteContent,
  writeNotesAtomic,
} from '../src/core/notes';
import { VaultLike } from '../src/core/types';

function createMockVault(files: Record<string, string> = {}): VaultLike & { files: Record<string, string> } {
  const store = { ...files };
  return {
    files: store,
    async exists(path: string) {
      return path in store;
    },
    async read(path: string) {
      if (!(path in store)) throw new Error(`File not found: ${path}`);
      return store[path];
    },
    async write(path: string, content: string) {
      store[path] = content;
    },
    async createFolder() {},
    async delete(path: string) {
      delete store[path];
    },
    async getMarkdownFiles() {
      return Object.keys(store).map((p) => ({
        path: p,
        basename: p.split('/').pop()?.replace(/\.md$/, '') || '',
      }));
    },
  };
}

describe('notes engine', () => {
  describe('yamlStr', () => {
    it('safely serializes strings containing quotes, newlines, and colons', () => {
      const unsafe = 'Hook: "Can you believe this?"\nLine 2';
      const serialized = yamlStr(unsafe);

      expect(serialized).toBe(JSON.stringify(unsafe));
      expect(serialized.startsWith('"')).toBe(true);
      expect(serialized.endsWith('"')).toBe(true);
    });

    it('handles empty and null strings safely', () => {
      expect(yamlStr('')).toBe('""');
      expect(yamlStr(null as any)).toBe('""');
    });
  });

  describe('slugify', () => {
    it('converts titles to URL/file-safe slugs', () => {
      expect(slugify('Your RAG Demo Dies at 10k Docs!')).toBe('your-rag-demo-dies-at-10k-docs');
      expect(slugify('  --Weird __ symbols & stuff--  ')).toBe('weird-symbols-stuff');
    });

    it('strips diacritics instead of discarding accented letters', () => {
      expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
    });

    it('falls back to "untitled" for titles with no Latin characters', () => {
      expect(slugify('日本語のタイトル')).toBe('untitled');
    });
  });

  describe('resolveCollision', () => {
    it('returns base path if file does not exist', async () => {
      const vault = createMockVault({});
      const path = await resolveCollision(vault, 'content', '2026-11-25-my-note.md');
      expect(path).toBe('content/2026-11-25-my-note.md');
    });

    it('appends -2, -3 when collisions exist', async () => {
      const vault = createMockVault({
        'content/2026-11-25-my-note.md': 'exists',
        'content/2026-11-25-my-note-2.md': 'exists',
      });
      const path = await resolveCollision(vault, 'content', '2026-11-25-my-note.md');
      expect(path).toBe('content/2026-11-25-my-note-3.md');
    });

    it('resolves root-folder and slash-heavy folders without a leading slash', async () => {
      const vault = createMockVault({ 'note.md': 'exists' });

      expect(await resolveCollision(vault, '', 'note.md')).toBe('note-2.md');
      expect(await resolveCollision(vault, '/content/', 'note.md')).toBe('content/note.md');
      expect(await resolveCollision(vault, 'content//sub/', 'note.md')).toBe('content/sub/note.md');
    });
  });

  describe('buildStandaloneNoteContent', () => {
    it('creates valid markdown with YAML frontmatter conforming to schema', () => {
      const content = buildStandaloneNoteContent({
        title: 'RAG Latency Spike',
        hook: 'Your RAG demo dies at 10k docs.',
        angleType: 'pain_point',
        status: 'planned',
        publishDate: '2026-11-25',
        visualAnchor: 'terminal: p95 latency 2.4s',
        slopScore: 85,
        coreTension: 'Index size blows past cache',
        openLoop: 'Tomorrow: Tiered vector search',
      });

      expect(content).toContain('title: "RAG Latency Spike"');
      expect(content).toContain('hook: "Your RAG demo dies at 10k docs."');
      expect(content).toContain('angle_type: pain_point');
      expect(content).toContain('publish_date: 2026-11-25');
      expect(content).toContain('slop_score: 85');
      expect(content).toContain('## Visual Proof Anchor');
      expect(content).toContain('terminal: p95 latency 2.4s');
    });

    it('renders the payoff from the previous episode when provided', () => {
      const content = buildStandaloneNoteContent({
        title: 'The Two-Tiered Index',
        hook: 'Single index similarity is an architectural trap.',
        angleType: 'series_episode',
        status: 'planned',
        publishDate: '2026-11-27',
        visualAnchor: 'code diff of two-tiered index',
        slopScore: 90,
        coreTension: 'Memory pressure vs recall',
        payoffFromPrev: 'Tiering splits cold vectors from the hot cache.',
        cliffhanger: 'Now let us test it at 100k scale.',
      });

      expect(content).toContain('## Payoff from Previous Episode');
      expect(content).toContain('Tiering splits cold vectors from the hot cache.');
    });

    it('omits the payoff section for standalone notes', () => {
      const content = buildStandaloneNoteContent({
        title: 'Standalone',
        hook: 'A direct hook.',
        angleType: 'pain_point',
        status: 'planned',
        publishDate: '2026-11-25',
        visualAnchor: 'terminal: 40ms',
        slopScore: 80,
        coreTension: 'A tension',
      });

      expect(content).not.toContain('## Payoff from Previous Episode');
    });

    it('clamps invalid slop scores to the 0-100 range', () => {
      const base = {
        title: 'Score Test',
        hook: 'A direct hook.',
        angleType: 'pain_point',
        status: 'planned',
        publishDate: '2026-11-25',
        visualAnchor: 'terminal: 40ms',
        coreTension: 'A tension',
      };

      expect(buildStandaloneNoteContent({ ...base, slopScore: 140 })).toContain('slop_score: 100');
      expect(buildStandaloneNoteContent({ ...base, slopScore: -5 })).toContain('slop_score: 0');
      expect(buildStandaloneNoteContent({ ...base, slopScore: Number.NaN })).toContain('slop_score: 0');
    });
  });

  describe('writeNotesAtomic', () => {
    it('writes all files successfully', async () => {
      const vault = createMockVault({});
      const files = [
        { path: 'content/a.md', content: 'A' },
        { path: 'content/b.md', content: 'B' },
      ];

      const written = await writeNotesAtomic(vault, files);
      expect(written).toEqual(['content/a.md', 'content/b.md']);
      expect(vault.files['content/a.md']).toBe('A');
      expect(vault.files['content/b.md']).toBe('B');
    });

    it('rolls back previously written files on write failure and leaves zero partial files', async () => {
      const vault = createMockVault({});
      // Make second write fail
      let writeCount = 0;
      const originalWrite = vault.write.bind(vault);
      vault.write = async (path: string, content: string) => {
        writeCount++;
        if (writeCount === 2) {
          throw new Error('Simulated disk full failure');
        }
        return originalWrite(path, content);
      };

      const files = [
        { path: 'content/a.md', content: 'A' },
        { path: 'content/b.md', content: 'B' },
      ];

      await expect(writeNotesAtomic(vault, files)).rejects.toThrow('Atomic write failed');
      // Verify rollback: content/a.md was written then deleted
      expect(vault.files['content/a.md']).toBeUndefined();
      expect(Object.keys(vault.files)).toHaveLength(0);
    });

    it('restores pre-existing files instead of deleting them on rollback', async () => {
      const vault = createMockVault({ 'content/a.md': 'original content' });
      let writeCount = 0;
      const originalWrite = vault.write.bind(vault);
      vault.write = async (path: string, content: string) => {
        writeCount++;
        if (writeCount === 2) {
          throw new Error('Simulated disk full failure');
        }
        return originalWrite(path, content);
      };

      const files = [
        { path: 'content/a.md', content: 'replacement content' },
        { path: 'content/b.md', content: 'B' },
      ];

      await expect(writeNotesAtomic(vault, files)).rejects.toThrow('Atomic write failed');
      expect(vault.files['content/a.md']).toBe('original content');
      expect(vault.files['content/b.md']).toBeUndefined();
    });
  });
});
