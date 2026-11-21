import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupKanban } from './setup-kanban.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const vaultDir = path.join(root, 'test-vault');
const obsidianDir = path.join(vaultDir, '.obsidian');
const pluginsDir = path.join(obsidianDir, 'plugins');
const mitosPluginDir = path.join(pluginsDir, 'mitos');
const contentDir = path.join(vaultDir, 'content');

console.log('🚀 Setting up Mitos test-vault scaffold...');

// 1. Create directories
fs.mkdirSync(mitosPluginDir, { recursive: true });
fs.mkdirSync(contentDir, { recursive: true });

// 2. Write Obsidian config to auto-enable community plugins
const communityPluginsPath = path.join(obsidianDir, 'community-plugins.json');
let initialPlugins = ['mitos'];
if (fs.existsSync(communityPluginsPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(communityPluginsPath, 'utf-8'));
    if (Array.isArray(existing)) {
      initialPlugins = Array.from(new Set([...existing, 'mitos']));
    }
  } catch {}
}
fs.writeFileSync(communityPluginsPath, JSON.stringify(initialPlugins, null, 2));

// 3. Copy plugin artifacts
const artifacts = ['manifest.json', 'styles.css', 'main.js'];
for (const art of artifacts) {
  const src = path.join(root, art);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(mitosPluginDir, art));
    console.log(`  ✓ Copied ${art}`);
  } else {
    console.warn(`  ⚠️ Missing ${art} - run "npm run build" first`);
  }
}

// 4. Seed sample content notes
const sampleNote1 = `---
title: "Your RAG demo dies at 10k documents"
hook: "Your RAG demo dies at ten thousand documents."
angle_type: pain_point
status: planned
publish_date: 2026-11-25
series_id: ""
episode: 0
series_total: 0
prev: ""
next: ""
visual_anchor: "terminal: p95 latency 2.4s → 9.1s as docs grow 1k → 10k"
slop_score: 85
tags:
  - content/short-form
  - content/pain-point
---

# Your RAG demo dies at 10k documents

> **Target Hook (0-3s):**  
> "Your RAG demo dies at ten thousand documents."

## Core Tension & Problem
Naive vector search degrades rapidly once index size exceeds cache boundaries.
`;

const sampleKanban = `---
kanban-plugin: board
---

## Ideas

- [ ] [[2026-11-25-rag-demo-dies-at-10k-docs]]

## Scripted

## Scheduled

## Published
`;

fs.writeFileSync(
  path.join(contentDir, '2026-11-25-rag-demo-dies-at-10k-docs.md'),
  sampleNote1
);
fs.writeFileSync(path.join(contentDir, '_pipeline.md'), sampleKanban);

// 5. Bootstrap Kanban companion plugin
try {
  await setupKanban(vaultDir);
} catch (err) {
  console.warn(`  ⚠️ Could not bootstrap Kanban plugin: ${err.message}`);
}

console.log('\n✅ Test vault ready at:', vaultDir);
console.log('Open Obsidian -> Open folder as vault -> Select "test-vault"');
