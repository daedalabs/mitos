import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NodeFsVault } from '../src/core/node-fs-vault';

describe('NodeFsVault adapter', () => {
  let tempDir: string;
  let vault: NodeFsVault;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitos-vault-test-'));
    vault = new NodeFsVault(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('checks file existence', async () => {
    expect(await vault.exists('note.md')).toBe(false);

    fs.writeFileSync(path.join(tempDir, 'note.md'), 'hello');
    expect(await vault.exists('note.md')).toBe(true);
    expect(await vault.exists('/note.md')).toBe(true);
  });

  it('reads and writes files atomically ensuring directories', async () => {
    await vault.write('nested/folder/note.md', '# Content');
    expect(await vault.exists('nested/folder/note.md')).toBe(true);
    expect(await vault.read('nested/folder/note.md')).toBe('# Content');
  });

  it('creates folders', async () => {
    await vault.createFolder('content/series');
    expect(fs.existsSync(path.join(tempDir, 'content/series'))).toBe(true);
  });

  it('deletes files and folders', async () => {
    await vault.write('file-to-delete.md', 'bye');
    expect(await vault.exists('file-to-delete.md')).toBe(true);
    await vault.delete('file-to-delete.md');
    expect(await vault.exists('file-to-delete.md')).toBe(false);

    // Deleting non-existent file does not throw
    await expect(vault.delete('non-existent.md')).resolves.not.toThrow();
  });

  it('lists markdown files recursively while ignoring hidden directories and node_modules', async () => {
    await vault.write('root.md', '# Root');
    await vault.write('content/ep1.md', '# Ep 1');
    await vault.write('content/ep2.md', '# Ep 2');
    await vault.write('.obsidian/plugins/mitos/data.json', '{}');
    await vault.write('.obsidian/workspace.md', '# Workspace');
    await vault.write('node_modules/package/readme.md', '# Node module');
    await vault.write('notes.txt', 'not markdown');

    const files = await vault.getMarkdownFiles();
    const paths = files.map((f) => f.path).sort();

    expect(paths).toEqual(['content/ep1.md', 'content/ep2.md', 'root.md']);
    expect(files.find((f) => f.path === 'content/ep1.md')?.basename).toBe('ep1');
  });

  it('implements atomic process() read-modify-write', async () => {
    await vault.write('counter.txt', '1');
    const result = await vault.process('counter.txt', (data) => `${Number(data) + 1}`);
    expect(result).toBe('2');
    expect(await vault.read('counter.txt')).toBe('2');
  });

  it('prevents path traversal attacks outside the vault root', async () => {
    await expect(vault.read('../../secret.txt')).rejects.toThrow('Access denied');
    await expect(vault.write('../outside.md', 'hacked')).rejects.toThrow('Access denied');
  });
});
