import { describe, it, expect } from 'vitest';
import {
  appendLinkToDailyNote,
  formatDailyNoteFilename,
  resolveDailyNotePath,
} from '../src/core/calendar';
import { appendCardToKanban, findTargetLaneHeader, insertCardIntoBoard, DEFAULT_KANBAN_TEMPLATE } from '../src/core/kanban';
import { createDashboardNote, generateDashboardContent } from '../src/core/dashboard';
import { VaultLike } from '../src/core/types';

function createMockVault(files: Record<string, string> = {}): VaultLike & { files: Record<string, string> } {
  const store = { ...files };
  return {
    files: store,
    async exists(path: string) {
      return path in store;
    },
    async read(path: string) {
      if (!(path in store)) throw new Error(`Not found: ${path}`);
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

describe('integrations contracts', () => {
  describe('calendar daily note bridge', () => {
    it('appends link to daily note', async () => {
      const vault = createMockVault({});
      const appended = await appendLinkToDailyNote(
        vault,
        '2026-11-25',
        '2026-11-25-rag-demo',
        'Your RAG demo dies at 10k documents.'
      );

      expect(appended).toBe(true);
      expect(vault.files['2026-11-25.md']).toContain('[[2026-11-25-rag-demo]]');
    });

    it('skips insertion if link already present (idempotent)', async () => {
      const vault = createMockVault({
        '2026-11-25.md': '# Daily Note\n\n- [[2026-11-25-rag-demo]] — Your RAG demo dies at 10k documents.\n',
      });

      const appended = await appendLinkToDailyNote(
        vault,
        '2026-11-25',
        '2026-11-25-rag-demo',
        'Your RAG demo dies at 10k documents.'
      );

      expect(appended).toBe(false);
      // No duplicate lines
      const matches = vault.files['2026-11-25.md'].match(/\[\[2026-11-25-rag-demo\]\]/g);
      expect(matches).toHaveLength(1);
    });

    it('respects custom daily note folder from .obsidian/daily-notes.json', async () => {
      const vault = createMockVault({
        '.obsidian/daily-notes.json': JSON.stringify({ folder: 'Journal/Daily' }),
      });

      const resolved = await resolveDailyNotePath(vault, '2026-11-25');
      expect(resolved).toBe('Journal/Daily/2026-11-25.md');
    });

    it('honors numeric Moment tokens in the configured daily note format', async () => {
      const vault = createMockVault({
        '.obsidian/daily-notes.json': JSON.stringify({
          folder: 'Journal',
          format: 'YYYY/MM/YYYY-MM-DD',
        }),
      });

      expect(await resolveDailyNotePath(vault, '2026-11-25')).toBe(
        'Journal/2026/11/2026-11-25.md'
      );
    });

    it('falls back to the ISO filename for unsupported format tokens', async () => {
      const vault = createMockVault({
        '.obsidian/daily-notes.json': JSON.stringify({
          format: 'dddd, MMMM Do YYYY',
        }),
      });

      expect(await resolveDailyNotePath(vault, '2026-11-25')).toBe('2026-11-25.md');
    });

    it('formats compact and single-digit numeric tokens', () => {
      expect(formatDailyNoteFilename('2026-01-05', 'YYYYMMDD')).toBe('20260105.md');
      expect(formatDailyNoteFilename('2026-01-05', 'YY-M-D')).toBe('26-1-5.md');
    });

    it('uses vault.process for the read-modify-write when available', async () => {
      const vault = createMockVault({ '2026-11-25.md': '# Daily\n' });
      let processCalled = false;
      vault.process = async (path: string, fn: (data: string) => string) => {
        processCalled = true;
        const updated = fn(vault.files[path]);
        vault.files[path] = updated;
        return updated;
      };

      const appended = await appendLinkToDailyNote(
        vault,
        '2026-11-25',
        '2026-11-25-rag-demo',
        'Your RAG demo dies at 10k documents.'
      );

      expect(processCalled).toBe(true);
      expect(appended).toBe(true);
      expect(vault.files['2026-11-25.md']).toContain('[[2026-11-25-rag-demo]]');

      // A second pass through process() must remain idempotent.
      const appendedAgain = await appendLinkToDailyNote(
        vault,
        '2026-11-25',
        '2026-11-25-rag-demo',
        'Your RAG demo dies at 10k documents.'
      );
      expect(appendedAgain).toBe(false);
      expect(vault.files['2026-11-25.md'].match(/\[\[2026-11-25-rag-demo\]\]/g)).toHaveLength(1);
    });
  });

  describe('kanban board pipeline', () => {
    it('finds matching lane heading for status planned', () => {
      const lane = findTargetLaneHeader(DEFAULT_KANBAN_TEMPLATE, 'planned');
      expect(lane).toBe('Scheduled');
    });

    it('inserts card before next ## lane heading', () => {
      const updated = insertCardIntoBoard(DEFAULT_KANBAN_TEMPLATE, 'Scheduled', '- [ ] [[test-card]]');
      expect(updated).toContain('## Scheduled\n- [ ] [[test-card]]\n\n## Published');
    });

    it('appends card to kanban board file in content folder', async () => {
      const vault = createMockVault({});
      await appendCardToKanban(vault, 'content', '2026-11-25-rag-demo', 'planned');

      const board = vault.files['content/_pipeline.md'];
      expect(board).toContain('kanban-plugin: board');
      expect(board).toContain('[[2026-11-25-rag-demo]]');
    });

    it('prefers an exact Scheduled lane over an earlier Unplanned lane', () => {
      const board = `---
kanban-plugin: board
---

## Unplanned

## Scheduled
`;
      expect(findTargetLaneHeader(board, 'planned')).toBe('Scheduled');
    });

    it('writes the pipeline note at the vault root without a leading slash', async () => {
      const vault = createMockVault({});
      await appendCardToKanban(vault, '', 'root-card', 'planned');

      expect(vault.files['_pipeline.md']).toContain('[[root-card]]');
      expect(vault.files['/_pipeline.md']).toBeUndefined();
    });
  });

  describe('dataview companion dashboard', () => {
    it('generates valid dataview query filtering out pipeline and dashboard', () => {
      const content = generateDashboardContent('content');
      expect(content).toContain('FROM "content"');
      expect(content).toContain('WHERE file.name != "_pipeline" AND file.name != "_dashboard"');
      expect(content).toContain('SORT publish_date ASC');
    });

    it('creates the dashboard at the vault root without a leading slash', async () => {
      const vault = createMockVault({});
      const path = await createDashboardNote(vault, '');

      expect(path).toBe('_dashboard.md');
      expect(vault.files['_dashboard.md']).toContain('FROM ""');
    });
  });
});
