import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_KANBAN_TEMPLATE = `---
kanban-plugin: board
---

## Ideas

## Scripted

## Scheduled

## Published
`;

const KANBAN_RELEASE_BASE =
  'https://github.com/mgmeyers/obsidian-kanban/releases/latest/download/';
const KANBAN_ASSETS = ['main.js', 'manifest.json', 'styles.css'];

/**
 * Automate setting up obsidian-kanban community plugin in target vault.
 * Downloads release assets, enables the plugin, and initializes content/_pipeline.md.
 *
 * @param {string} targetVault
 */
export async function setupKanban(targetVault = './test-vault') {
  const vaultDir = path.resolve(process.cwd(), targetVault);
  const obsidianDir = path.join(vaultDir, '.obsidian');
  const pluginsDir = path.join(obsidianDir, 'plugins');
  const kanbanDir = path.join(pluginsDir, 'obsidian-kanban');
  const contentDir = path.join(vaultDir, 'content');
  const pipelinePath = path.join(contentDir, '_pipeline.md');
  const communityPluginsPath = path.join(obsidianDir, 'community-plugins.json');

  console.log(`🚀 Setting up Obsidian Kanban for vault: ${vaultDir}`);

  // 1. Ensure directory scaffold exists
  fs.mkdirSync(kanbanDir, { recursive: true });
  fs.mkdirSync(contentDir, { recursive: true });

  // 2. Download latest release assets from GitHub
  for (const asset of KANBAN_ASSETS) {
    const assetUrl = `${KANBAN_RELEASE_BASE}${asset}`;
    console.log(`  ⬇️  Downloading ${asset}...`);
    const res = await fetch(assetUrl, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`Failed to download ${asset} from ${assetUrl}: HTTP ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(kanbanDir, asset), buffer);
    console.log(`  ✓ Saved ${asset} to ${kanbanDir}`);
  }

  // 3. Ensure obsidian-kanban is in community-plugins.json
  let plugins = [];
  if (fs.existsSync(communityPluginsPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(communityPluginsPath, 'utf-8'));
      if (Array.isArray(existing)) {
        plugins = existing;
      }
    } catch {
      plugins = [];
    }
  }

  if (!plugins.includes('obsidian-kanban')) {
    plugins.push('obsidian-kanban');
    fs.writeFileSync(communityPluginsPath, JSON.stringify(plugins, null, 2));
    console.log('  ✓ Registered "obsidian-kanban" in community-plugins.json');
  } else {
    console.log('  ✓ "obsidian-kanban" already enabled in community-plugins.json');
  }

  // 4. Create initial content/_pipeline.md if missing
  if (!fs.existsSync(pipelinePath)) {
    fs.writeFileSync(pipelinePath, DEFAULT_KANBAN_TEMPLATE);
    console.log('  ✓ Created initial pipeline board at content/_pipeline.md');
  } else {
    console.log('  ✓ Pipeline board already exists at content/_pipeline.md');
  }

  console.log('✅ Kanban bootstrap complete!');
}

// CLI execution check
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const targetVaultArg = process.argv[2] || process.env.MITOS_VAULT_PATH || './test-vault';
  setupKanban(targetVaultArg).catch((err) => {
    console.error('❌ Error setting up Kanban:', err.message);
    process.exit(1);
  });
}
