import { describe, it, expect } from 'vitest';
import { createAngleNote } from '../src/core/actions';
import { Angle, VaultLike } from '../src/core/types';

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

const sampleAngle: Angle = {
  id: 'angle-1',
  angleType: 'pain_point',
  title: 'RAG Latency Spike',
  hook: 'Your RAG demo dies at 10k documents.',
  coreTension: 'Index size blows past the cache boundary.',
  visualProofAnchor: 'terminal: p95 900ms',
  openLoop: 'Next: tiered indexing.',
  lint: {
    score: 85,
    passed: true,
    warnings: [],
    bannedWordsFound: [],
    hookWordCount: 7,
    hasConcreteProof: true,
    strictness: 'standard',
  },
};

describe('createAngleNote action', () => {
  it('creates the note and both companion integration entries', async () => {
    const vault = createMockVault({});
    const saved = await createAngleNote(vault, 'content', sampleAngle, '2026-11-25');

    expect(saved.path).toBe('content/2026-11-25-rag-latency-spike.md');
    expect(saved.basename).toBe('2026-11-25-rag-latency-spike');
    expect(vault.files[saved.path]).toContain('title: "RAG Latency Spike"');
    expect(vault.files[saved.path]).toContain('publish_date: 2026-11-25');

    expect(vault.files['2026-11-25.md']).toContain(`[[${saved.basename}]]`);
    expect(vault.files['content/_pipeline.md']).toContain(`[[${saved.basename}]]`);
  });

  it('resolves filename collisions instead of overwriting an existing note', async () => {
    const vault = createMockVault({ 'content/2026-11-25-rag-latency-spike.md': 'existing' });
    const saved = await createAngleNote(vault, 'content', sampleAngle, '2026-11-25');

    expect(saved.path).toBe('content/2026-11-25-rag-latency-spike-2.md');
    expect(vault.files['content/2026-11-25-rag-latency-spike.md']).toBe('existing');
  });

  it('keeps the note when a companion integration write fails', async () => {
    const vault = createMockVault({});
    const originalWrite = vault.write.bind(vault);
    vault.write = async (path: string, content: string) => {
      if (path === '2026-11-25.md') {
        throw new Error('Daily note is locked');
      }
      return originalWrite(path, content);
    };

    const saved = await createAngleNote(vault, 'content', sampleAngle, '2026-11-25');

    expect(vault.files[saved.path]).toContain('title: "RAG Latency Spike"');
    expect(vault.files['content/_pipeline.md']).toContain(`[[${saved.basename}]]`);
  });

  it('supports the vault root as the content folder', async () => {
    const vault = createMockVault({});
    const saved = await createAngleNote(vault, '', sampleAngle, '2026-11-25');

    expect(saved.path).toBe('2026-11-25-rag-latency-spike.md');
    expect(vault.files['2026-11-25.md']).toContain(`[[${saved.basename}]]`);
    expect(vault.files['_pipeline.md']).toContain(`[[${saved.basename}]]`);
  });

  it('supports custom kanban lane and script draft options', async () => {
    const vault = createMockVault({});
    const saved = await createAngleNote(vault, 'content', sampleAngle, '2026-11-25', {
      status: 'planned',
      kanbanLane: 'ideas',
      scriptDraft: 'This is a full spoken 35s draft script.',
    });

    expect(saved.status).toBe('planned');
    expect(vault.files[saved.path]).toContain('This is a full spoken 35s draft script.');

    const pipeline = vault.files['content/_pipeline.md'];
    const ideasIdx = pipeline.indexOf('## Ideas');
    const scheduledIdx = pipeline.indexOf('## Scheduled');
    const cardIdx = pipeline.indexOf(`[[${saved.basename}]]`);

    expect(cardIdx).toBeGreaterThan(ideasIdx);
    expect(cardIdx).toBeLessThan(scheduledIdx);
  });
});
