import { VaultLike } from './types';
import { joinVaultPath, normalizeFolder } from './paths';

export const DEFAULT_KANBAN_TEMPLATE = `---
kanban-plugin: board
---

## Ideas

## Scripted

## Scheduled

## Published
`;

const LANE_ALIASES: Record<string, string[]> = {
  ideas: ['ideas', 'idea', 'backlog', 'inbox'],
  scripted: ['scripted', 'drafting', 'writing'],
  scheduled: ['scheduled', 'planned', 'queued', 'calendar'],
  published: ['published', 'done', 'live', 'completed'],
};

export function findTargetLaneHeader(boardContent: string, targetStatus: string): string | null {
  const lines = boardContent.split('\n');
  const headers: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      headers.push(line.slice(3).trim());
    }
  }

  if (headers.length === 0) return null;

  const statusNorm = targetStatus.toLowerCase();
  let targetGroup = 'scheduled';
  for (const [group, aliases] of Object.entries(LANE_ALIASES)) {
    if (aliases.includes(statusNorm)) {
      targetGroup = group;
      break;
    }
  }

  // Look for a header whose words match an alias of the target group.
  // Whole-token matching prevents `## Unplanned` from capturing `planned`.
  const groupAliases = LANE_ALIASES[targetGroup] || [targetGroup];
  for (const h of headers) {
    const headerTokens = h.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (groupAliases.some((alias) => headerTokens.includes(alias))) {
      return h;
    }
  }

  // Fallback to first header
  return headers[0];
}

export function insertCardIntoBoard(boardContent: string, laneName: string, cardLine: string): string {
  const lines = boardContent.split('\n');
  const targetHeader = `## ${laneName}`;
  const headerIdx = lines.findIndex((l) => l.trim().toLowerCase() === targetHeader.toLowerCase());

  if (headerIdx === -1) {
    // Append new lane at the bottom
    return `${boardContent.trimEnd()}\n\n## ${laneName}\n${cardLine}\n`;
  }

  // Find where this lane ends (next '## ' heading or EOF)
  let nextHeadingIdx = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      nextHeadingIdx = i;
      break;
    }
  }

  // Find last card in this lane, if any
  let lastCardIdx = -1;
  for (let i = headerIdx + 1; i < nextHeadingIdx; i++) {
    if (lines[i].trim().startsWith('- [ ]') || lines[i].trim().startsWith('- [x]')) {
      lastCardIdx = i;
    }
  }

  if (lastCardIdx !== -1) {
    // Insert after last card
    lines.splice(lastCardIdx + 1, 0, cardLine);
  } else {
    // Insert right after the header line, cleaning up redundant blank lines
    lines.splice(headerIdx + 1, 0, cardLine);
  }

  return lines.join('\n');
}

export async function appendCardToKanban(
  vault: VaultLike,
  contentFolder: string,
  noteBasename: string,
  status: string = 'planned'
): Promise<string> {
  const cleanFolder = normalizeFolder(contentFolder);
  const pipelinePath = joinVaultPath(cleanFolder, '_pipeline.md');
  const cardLine = `- [ ] [[${noteBasename}]]`;

  const processFn = (content: string) => {
    let current = content || DEFAULT_KANBAN_TEMPLATE;
    const wikilink = `[[${noteBasename}]]`;

    // Skip if card already in board
    if (current.includes(wikilink)) {
      return current;
    }

    const lane = findTargetLaneHeader(current, status) || 'Scheduled';
    return insertCardIntoBoard(current, lane, cardLine);
  };

  if (cleanFolder && !(await vault.exists(cleanFolder))) {
    await vault.createFolder(cleanFolder);
  }

  if (vault.process) {
    if (!(await vault.exists(pipelinePath))) {
      await vault.write(pipelinePath, DEFAULT_KANBAN_TEMPLATE);
    }
    return await vault.process(pipelinePath, processFn);
  } else {
    let current = DEFAULT_KANBAN_TEMPLATE;
    if (await vault.exists(pipelinePath)) {
      current = await vault.read(pipelinePath);
    }
    const updated = processFn(current);
    await vault.write(pipelinePath, updated);
    return updated;
  }
}
