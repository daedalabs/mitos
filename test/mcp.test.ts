import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { handleMcpToolCall, MITOS_MCP_TOOLS } from '../src/core/mcp';
import { SeriesPlan } from '../src/core/types';

describe('mcp tools and handlers', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitos-mcp-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('exposes standard MCP tool definitions including mitos_save_angle_note', () => {
    const toolNames = MITOS_MCP_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('mitos_brainstorm_angles');
    expect(toolNames).toContain('mitos_plan_series');
    expect(toolNames).toContain('mitos_lint_script');
    expect(toolNames).toContain('mitos_save_angle_note');
    expect(toolNames).toContain('mitos_save_series');

    const saveAngleTool = MITOS_MCP_TOOLS.find((t) => t.name === 'mitos_save_angle_note');
    expect(saveAngleTool?.inputSchema.required).toEqual([
      'title',
      'hook',
      'angleType',
      'coreTension',
      'visualProofAnchor',
    ]);
  });

  it('handles mitos_lint_script tool call cleanly', async () => {
    const res = await handleMcpToolCall('mitos_lint_script', {
      script: 'Your RAG demo dies at 10k documents. Latency is 50ms in benchmark.',
      strictness: 'standard',
    });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.passed).toBe(true);
    expect(parsed.score).toBeGreaterThanOrEqual(70);
  });

  it('handles mitos_brainstorm_angles and mitos_plan_series prompts', async () => {
    const anglesRes = await handleMcpToolCall('mitos_brainstorm_angles', {
      topic: 'Rust memory leaks in tokio',
    });
    expect(anglesRes.content[0].text).toContain('Rust memory leaks in tokio');

    const seriesRes = await handleMcpToolCall('mitos_plan_series', {
      topic: 'Database indexing',
      archetype: '3_act_engineering_problem',
    });
    expect(seriesRes.content[0].text).toContain('SERIES NARRATIVE ARCHETYPE: 3_act_engineering_problem');
  });

  it('persists angle note to vault and appends card into _pipeline.md under ## Ideas', async () => {
    const res = await handleMcpToolCall('mitos_save_angle_note', {
      vaultPath: tempDir,
      contentFolder: 'content',
      title: 'RAG Latency Spike',
      hook: 'Your RAG demo dies at 10k documents.',
      angleType: 'pain_point',
      coreTension: 'Index size blows past cache boundaries during vector search.',
      visualProofAnchor: 'terminal: p95 latency spike from 40ms to 920ms',
      scriptDraft: 'Your RAG demo dies at 10k documents. Benchmark latency jumps to 900ms.',
      openLoop: 'Tomorrow: Tiered vector search.',
      publishDate: '2026-11-25',
    });

    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(res.content[0].text);
    expect(payload.success).toBe(true);
    expect(payload.path).toBe('content/2026-11-25-rag-latency-spike.md');
    expect(payload.status).toBe('planned');
    expect(payload.slopScore).toBeGreaterThanOrEqual(70);
    expect(payload.kanbanLane).toBe('Ideas');

    // Verify written note file on disk
    const noteFilePath = path.join(tempDir, payload.path);
    expect(fs.existsSync(noteFilePath)).toBe(true);
    const noteContent = fs.readFileSync(noteFilePath, 'utf-8');

    expect(noteContent).toContain('title: "RAG Latency Spike"');
    expect(noteContent).toContain('hook: "Your RAG demo dies at 10k documents."');
    expect(noteContent).toContain('angle_type: pain_point');
    expect(noteContent).toContain('status: planned');
    expect(noteContent).toContain('publish_date: 2026-11-25');
    expect(noteContent).toContain(`slop_score: ${payload.slopScore}`);
    expect(noteContent).toContain('## Core Tension & Problem');
    expect(noteContent).toContain('## Visual Proof Anchor');
    expect(noteContent).toContain('terminal: p95 latency spike from 40ms to 920ms');
    expect(noteContent).toContain('## Script Draft');
    expect(noteContent).toContain('Your RAG demo dies at 10k documents. Benchmark latency jumps to 900ms.');
    expect(noteContent).toContain('## Forward Connection / Open Loop');
    expect(noteContent).toContain('Tomorrow: Tiered vector search.');

    // Verify Kanban _pipeline.md was initialized and card added under ## Ideas
    const pipelinePath = path.join(tempDir, 'content', '_pipeline.md');
    expect(fs.existsSync(pipelinePath)).toBe(true);
    const pipelineContent = fs.readFileSync(pipelinePath, 'utf-8');
    expect(pipelineContent).toContain('kanban-plugin: board');

    const ideasIdx = pipelineContent.indexOf('## Ideas');
    const scheduledIdx = pipelineContent.indexOf('## Scheduled');
    const cardIdx = pipelineContent.indexOf('- [ ] [[2026-11-25-rag-latency-spike]]');

    expect(ideasIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(ideasIdx);
    expect(cardIdx).toBeLessThan(scheduledIdx);
  });

  it('falls back to MITOS_VAULT_PATH when vaultPath is not passed', async () => {
    const originalEnv = process.env.MITOS_VAULT_PATH;
    process.env.MITOS_VAULT_PATH = tempDir;

    try {
      const res = await handleMcpToolCall('mitos_save_angle_note', {
        title: 'Env Vault Test',
        hook: 'Testing environment variable fallback for vault.',
        angleType: 'contrarian',
        coreTension: 'Direct environment coupling.',
        visualProofAnchor: 'benchmark: 10ms execution',
      });

      expect(res.isError).toBeFalsy();
      const payload = JSON.parse(res.content[0].text);
      expect(fs.existsSync(path.join(tempDir, payload.path))).toBe(true);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MITOS_VAULT_PATH = originalEnv;
      } else {
        delete process.env.MITOS_VAULT_PATH;
      }
    }
  });

  it('rejects mitos_save_angle_note with missing required fields or invalid angleType', async () => {
    const missingTitle = await handleMcpToolCall('mitos_save_angle_note', {
      vaultPath: tempDir,
      hook: 'A hook without title',
      angleType: 'pain_point',
      coreTension: 'tension',
      visualProofAnchor: 'anchor',
    });
    expect(missingTitle.isError).toBe(true);
    expect(missingTitle.content[0].text).toContain('Missing required parameter: title');

    const invalidType = await handleMcpToolCall('mitos_save_angle_note', {
      vaultPath: tempDir,
      title: 'Title',
      hook: 'Hook',
      angleType: 'invalid_type',
      coreTension: 'tension',
      visualProofAnchor: 'anchor',
    });
    expect(invalidType.isError).toBe(true);
    expect(invalidType.content[0].text).toContain('Invalid or missing angleType');
  });

  it('persists a complete series arc via mitos_save_series', async () => {
    const seriesPlan: SeriesPlan = {
      series_title: 'Vector Scaling at 100k',
      premise: 'How vector search degrades under memory pressure and how to solve it.',
      archetype: '3_act_engineering_problem',
      episodes: [
        {
          n: 1,
          title: 'The Cache Wall',
          hook: 'Your vector search crashes at 50k items.',
          coreTension: 'Single index cannot fit in CPU L3 cache.',
          visualProofAnchor: 'terminal: p99 latency 1.4s',
          cliffhanger: 'Next: Split into hot and cold tiers.',
          payoff_from_prev: '',
        },
        {
          n: 2,
          title: 'Hot Cold Tiers',
          hook: 'Split hot and cold vectors.',
          coreTension: 'Cold tier query latency.',
          visualProofAnchor: 'code diff: LRU index split',
          cliffhanger: 'Next: Benchmark 100k scale.',
          payoff_from_prev: 'Tiering keeps the hot index inside cache.',
        },
        {
          n: 3,
          title: 'The 100k Benchmark',
          hook: '100k vectors in under 20ms.',
          coreTension: 'Accuracy vs memory usage tradeoffs.',
          visualProofAnchor: 'benchmark: 18ms at 100k embeddings',
          cliffhanger: 'Series complete.',
          payoff_from_prev: 'Two-tier indexing drops memory usage by 60%.',
        },
      ],
    };

    const res = await handleMcpToolCall('mitos_save_series', {
      vaultPath: tempDir,
      contentFolder: 'content',
      series: seriesPlan,
      startDate: '2026-12-01',
      cadenceDays: 2,
    });

    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(res.content[0].text);
    expect(payload.success).toBe(true);
    expect(payload.indexFilePath).toBe('content/series/vector-scaling-at-100k.md');
    expect(payload.episodeFilePaths).toHaveLength(3);

    // Verify files on disk
    expect(fs.existsSync(path.join(tempDir, payload.indexFilePath))).toBe(true);
    for (const epPath of payload.episodeFilePaths) {
      expect(fs.existsSync(path.join(tempDir, epPath))).toBe(true);
    }
  });

  it('returns isError for unknown MCP tool names', async () => {
    const res = await handleMcpToolCall('unknown_tool', {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Unknown Mitos MCP tool');
  });
});
