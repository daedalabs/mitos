import { describe, it, expect } from 'vitest';
import { writeSeriesAtomic } from '../src/core/series';
import { SeriesPlan, VaultLike } from '../src/core/types';

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

describe('series writer & atomic transaction', () => {
  const sampleSeries: SeriesPlan = {
    series_title: 'RAG At Scale',
    premise: 'How vector search degrades at 10k documents and the architectural fix',
    archetype: '3_act_engineering_problem',
    cadenceDays: 2,
    episodes: [
      {
        n: 1,
        title: 'The 10k Wall',
        hook: 'Your RAG demo dies at 10k docs.',
        coreTension: 'Cache miss storm',
        visualProofAnchor: 'latency chart 40ms to 2s',
        cliffhanger: 'The secret is index tiering.',
        payoff_from_prev: '',
      },
      {
        n: 2,
        title: 'Two Tiered Indexing',
        hook: 'Single index similarity is an architectural trap.',
        coreTension: 'Index size vs memory boundaries',
        visualProofAnchor: 'code diff of two-tiered index',
        cliffhanger: 'Now let us test it at 100k scale.',
        payoff_from_prev: 'Tiering splits cold vectors from hot cache.',
      },
      {
        n: 3,
        title: 'The 100k Benchmark',
        hook: 'We pushed 100k embeddings through production.',
        coreTension: 'Throughput stability',
        visualProofAnchor: 'benchmark results table',
        cliffhanger: 'Ship this before your next release.',
        payoff_from_prev: '100k embeddings benchmark proves stability.',
      },
    ],
  };

  it('writes index note + 3 episode notes with closed prev/next links and staggered dates', async () => {
    const vault = createMockVault({});
    const res = await writeSeriesAtomic(vault, sampleSeries, 'content', '2026-11-25', 2);

    expect(res.episodeFilePaths).toHaveLength(3);
    expect(res.indexFilePath).toBe('content/series/rag-at-scale.md');

    // Ep 1 checks
    const ep1Content = vault.files[res.episodeFilePaths[0]];
    expect(ep1Content).toContain('publish_date: 2026-11-25');
    expect(ep1Content).toContain('prev: ""');
    expect(ep1Content).toContain('next: "[[2026-11-27-two-tiered-indexing]]"');

    // Ep 2 checks
    const ep2Content = vault.files[res.episodeFilePaths[1]];
    expect(ep2Content).toContain('publish_date: 2026-11-27');
    expect(ep2Content).toContain('prev: "[[2026-11-25-the-10k-wall]]"');
    expect(ep2Content).toContain('next: "[[2026-11-29-the-100k-benchmark]]"');

    // Ep 3 checks
    const ep3Content = vault.files[res.episodeFilePaths[2]];
    expect(ep3Content).toContain('publish_date: 2026-11-29');
    expect(ep3Content).toContain('prev: "[[2026-11-27-two-tiered-indexing]]"');
    expect(ep3Content).toContain('next: ""');

    // Index note checks
    const indexContent = vault.files[res.indexFilePath];
    expect(indexContent).toContain('type: series');
    expect(indexContent).toContain('series_id: rag-at-scale');
    expect(indexContent).toContain('1. [[2026-11-25-the-10k-wall|Ep 1: The 10k Wall]]');
    expect(indexContent).toContain('2. [[2026-11-27-two-tiered-indexing|Ep 2: Two Tiered Indexing]]');
    expect(indexContent).toContain('3. [[2026-11-29-the-100k-benchmark|Ep 3: The 100k Benchmark]]');
  });

  it('renders episode payoffs and keeps index cadence aligned with generated dates', async () => {
    const vault = createMockVault({});
    const res = await writeSeriesAtomic(vault, sampleSeries, 'content', '2026-11-25', 5);

    const ep2Content = vault.files[res.episodeFilePaths[1]];
    expect(ep2Content).toContain('## Payoff from Previous Episode');
    expect(ep2Content).toContain('Tiering splits cold vectors from hot cache.');
    expect(ep2Content).toContain('publish_date: 2026-11-30');

    const indexContent = vault.files[res.indexFilePath];
    expect(indexContent).toContain('cadence_days: 5');
  });

  it('aligns episode series_id with a collision-suffixed index file', async () => {
    const vault = createMockVault({ 'content/series/rag-at-scale.md': 'existing index' });
    const res = await writeSeriesAtomic(vault, sampleSeries, 'content', '2026-11-25', 2);

    expect(res.indexFilePath).toBe('content/series/rag-at-scale-2.md');
    expect(vault.files[res.indexFilePath]).toContain('series_id: rag-at-scale-2');
    expect(vault.files[res.episodeFilePaths[0]]).toContain('series_id: "rag-at-scale-2"');
  });

  it('writes series at the vault root without a leading slash', async () => {
    const vault = createMockVault({});
    const res = await writeSeriesAtomic(vault, sampleSeries, '', '2026-11-25', 2);

    expect(res.indexFilePath).toBe('series/rag-at-scale.md');
    expect(res.episodeFilePaths[0]).toBe('2026-11-25-the-10k-wall.md');
    expect(vault.files['/series/rag-at-scale.md']).toBeUndefined();
  });

  it('falls back to a sane cadence when given an invalid value', async () => {
    const vault = createMockVault({});
    const res = await writeSeriesAtomic(vault, sampleSeries, 'content', '2026-11-25', 0);

    const ep2Content = vault.files[res.episodeFilePaths[1]];
    expect(ep2Content).toContain('publish_date: 2026-11-27');

    const indexContent = vault.files[res.indexFilePath];
    expect(indexContent).toContain('cadence_days: 2');
  });

  it('rolls back completely if a write failure occurs during episode creation', async () => {
    const vault = createMockVault({});
    let writeCount = 0;
    const originalWrite = vault.write.bind(vault);

    // Fail on third write
    vault.write = async (path: string, content: string) => {
      writeCount++;
      if (writeCount === 3) {
        throw new Error('Simulated IO write failure');
      }
      return originalWrite(path, content);
    };

    await expect(
      writeSeriesAtomic(vault, sampleSeries, 'content', '2026-11-25', 2)
    ).rejects.toThrow('Atomic write failed');

    // Verify rollback leaves zero created notes
    const createdNotes = Object.keys(vault.files).filter((p) => p.startsWith('content/'));
    expect(createdNotes).toHaveLength(0);
  });
});
