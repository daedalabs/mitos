import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { setupKanban } from '../scripts/setup-kanban.mjs';

describe('setupKanban bootstrap script', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitos-kanban-setup-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('downloads release assets, enables plugin in community-plugins.json, and initializes _pipeline.md', async () => {
    // Mock global fetch to return sample asset content
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.endsWith('manifest.json')) {
        return new Response(JSON.stringify({ id: 'obsidian-kanban', version: '2.0.51' }), {
          status: 200,
        });
      }
      if (urlStr.endsWith('main.js')) {
        return new Response('console.log("kanban loaded");', { status: 200 });
      }
      if (urlStr.endsWith('styles.css')) {
        return new Response('.kanban-plugin { display: flex; }', { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    });

    // Pre-seed community-plugins.json with "mitos"
    const obsidianDir = path.join(tempDir, '.obsidian');
    fs.mkdirSync(obsidianDir, { recursive: true });
    fs.writeFileSync(
      path.join(obsidianDir, 'community-plugins.json'),
      JSON.stringify(['mitos'], null, 2)
    );

    await setupKanban(tempDir);

    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const pluginDir = path.join(obsidianDir, 'plugins', 'obsidian-kanban');
    expect(fs.existsSync(path.join(pluginDir, 'main.js'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(pluginDir, 'styles.css'))).toBe(true);

    const plugins = JSON.parse(
      fs.readFileSync(path.join(obsidianDir, 'community-plugins.json'), 'utf-8')
    );
    expect(plugins).toContain('mitos');
    expect(plugins).toContain('obsidian-kanban');

    const pipelinePath = path.join(tempDir, 'content', '_pipeline.md');
    expect(fs.existsSync(pipelinePath)).toBe(true);
    const pipelineContent = fs.readFileSync(pipelinePath, 'utf-8');
    expect(pipelineContent).toContain('kanban-plugin: board');
    expect(pipelineContent).toContain('## Ideas');
  });

  it('preserves existing _pipeline.md if already present', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response('asset content', { status: 200 });
    });

    const contentDir = path.join(tempDir, 'content');
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(path.join(contentDir, '_pipeline.md'), '# Existing Pipeline');

    await setupKanban(tempDir);

    const pipelineContent = fs.readFileSync(path.join(contentDir, '_pipeline.md'), 'utf-8');
    expect(pipelineContent).toBe('# Existing Pipeline');
  });
});
