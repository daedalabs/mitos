import { App } from 'obsidian';
import { MemoryScanner } from './core/memory';
import { createObsidianVault } from './obsidian-adapter';
import { ContentEntry } from './core/types';

export type { ContentEntry };

export class VaultMemory {
  private scanner: MemoryScanner;

  constructor(app: App, contentFolder: string) {
    const vault = createObsidianVault(app);
    this.scanner = new MemoryScanner(vault, contentFolder);
  }

  async getAllEntries(): Promise<ContentEntry[]> {
    return await this.scanner.getAllEntries();
  }

  async checkDuplicate(
    proposedTopic: string,
    proposedHook?: string
  ): Promise<{
    isDuplicate: boolean;
    matchedWith?: string;
    similarityScore: number;
    matches: ContentEntry[];
  }> {
    return await this.scanner.checkDuplicate(proposedTopic, proposedHook);
  }
}
