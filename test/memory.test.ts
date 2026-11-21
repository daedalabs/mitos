import { describe, it, expect } from 'vitest';
import { computeTokenJaccard, MemoryScanner, parseSimpleFrontmatter } from '../src/core/memory';
import { VaultLike } from '../src/core/types';

function createMockVault(files: Record<string, string> = {}): VaultLike {
  return {
    async exists(path: string) {
      return path in files;
    },
    async read(path: string) {
      if (!(path in files)) throw new Error(`Not found: ${path}`);
      return files[path];
    },
    async write(path: string, content: string) {
      files[path] = content;
    },
    async createFolder() {},
    async delete(path: string) {
      delete files[path];
    },
    async getMarkdownFiles() {
      return Object.keys(files).map((p) => ({
        path: p,
        basename: p.split('/').pop()?.replace(/\.md$/, '') || '',
      }));
    },
  };
}

describe('memory scanner', () => {
  describe('parseSimpleFrontmatter', () => {
    it('parses title, hook, tags from yaml block', () => {
      const content = `---
title: "Vector Search Benchmark"
hook: "Your RAG demo dies at 10k documents."
tags:
  - content/short-form
  - content/pain-point
---
# Main Content`;

      const fm = parseSimpleFrontmatter(content);
      expect(fm.title).toBe('Vector Search Benchmark');
      expect(fm.hook).toBe('Your RAG demo dies at 10k documents.');
      expect(fm.tags).toEqual(['content/short-form', 'content/pain-point']);
    });

    it('parses inline flow-style tag lists from external notes', () => {
      const content = `---
title: "Inline Tags"
tags: [content/short-form, "content/pain-point"]
---`;

      const fm = parseSimpleFrontmatter(content);
      expect(fm.tags).toEqual(['content/short-form', 'content/pain-point']);
    });

    it('keeps quoted bracket scalars as strings', () => {
      const content = `---
title: "[Draft]"
---`;

      const fm = parseSimpleFrontmatter(content);
      expect(fm.title).toBe('[Draft]');
    });
  });

  describe('computeTokenJaccard', () => {
    it('returns 1.0 for identical sentences', () => {
      const score = computeTokenJaccard('Vector search latency spike', 'vector search latency spike');
      expect(score).toBe(1);
    });

    it('returns low score for unrelated text', () => {
      const score = computeTokenJaccard('Database index optimization', 'CSS flexbox centering tips');
      expect(score).toBe(0);
    });
  });

  describe('folder scoping (B7 fix)', () => {
    it('ignores files in content-archive/ or other directories outside content/', async () => {
      const vault = createMockVault({
        'content/valid-note.md': '---\ntitle: "Valid Note"\n---',
        'content-archive/old-note.md': '---\ntitle: "Old Note in Archive"\n---',
        'notes/general.md': '---\ntitle: "General Note"\n---',
      });

      const scanner = new MemoryScanner(vault, 'content');
      const entries = await scanner.getAllEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe('content/valid-note.md');
    });

    it('scans the whole vault when the content folder is the root', async () => {
      const vault = createMockVault({
        'content/valid-note.md': '---\ntitle: "Content Note"\n---',
        'notes/general.md': '---\ntitle: "General Note"\n---',
      });

      const scanner = new MemoryScanner(vault, '');
      const entries = await scanner.getAllEntries();

      expect(entries.map((entry) => entry.path).sort()).toEqual([
        'content/valid-note.md',
        'notes/general.md',
      ]);
    });

    it('detects duplicate topics and hooks with Jaccard >= 0.6', async () => {
      const vault = createMockVault({
        'content/rag-scaling.md': `---
title: "How to Scale Vector Search in Production"
hook: "Your vector database will fail at 10k documents."
---`,
      });

      const scanner = new MemoryScanner(vault, 'content');
      const dupCheck = await scanner.checkDuplicate('How to Scale Vector Search in Production');

      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.similarityScore).toBeGreaterThanOrEqual(0.6);
      expect(dupCheck.matchedWith).toContain('How to Scale Vector Search in Production');
    });
  });
});
