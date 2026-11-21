import * as fs from 'fs';
import * as path from 'path';
import { MitosError, VaultFileLike, VaultLike } from './types';

/**
 * Headless Node.js filesystem adapter implementing Obsidian's VaultLike interface.
 * Allows Mitos core actions (createAngleNote, writeSeriesAtomic, etc.) to run
 * outside of Obsidian with zero Electron or UI dependencies.
 */
export class NodeFsVault implements VaultLike {
  readonly vaultRoot: string;

  constructor(vaultRoot: string) {
    this.vaultRoot = path.resolve(vaultRoot);
  }

  private resolvePath(relativePath: string): string {
    const cleanRel = relativePath.replace(/^[/\\]+/, '');
    const resolved = path.resolve(this.vaultRoot, cleanRel);
    // Security check: prevent directory traversal outside vault root
    const relativeToRoot = path.relative(this.vaultRoot, resolved);
    if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
      throw new MitosError(`Access denied: path traverses outside vault root: ${relativePath}`, 'vault');
    }
    return resolved;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolvePath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async read(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    return await fs.promises.readFile(fullPath, 'utf-8');
  }

  async write(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content, 'utf-8');
  }

  async createFolder(folder: string): Promise<void> {
    const fullPath = this.resolvePath(folder);
    await fs.promises.mkdir(fullPath, { recursive: true });
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async getMarkdownFiles(): Promise<VaultFileLike[]> {
    const results: VaultFileLike[] = [];

    const walk = async (currentDir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        // Skip hidden directories (like .obsidian, .git) and dependency folders
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const rel = path.relative(this.vaultRoot, fullPath).replace(/\\/g, '/');
          const basename = entry.name.slice(0, -3);
          results.push({ path: rel, basename });
        }
      }
    };

    await walk(this.vaultRoot);
    return results;
  }

  async process(filePath: string, fn: (data: string) => string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    let current = '';
    try {
      current = await fs.promises.readFile(fullPath, 'utf-8');
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
    const updated = fn(current);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, updated, 'utf-8');
    return updated;
  }
}
