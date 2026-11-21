import { App, Modal, Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, MitosSettings, MitosSettingTab } from './settings';
import { generateAngles } from './brainstorm';
import { lintScriptForSlop } from './core/anti_slop';
import { VaultMemory } from './vault_memory';
import { MitosView, VIEW_TYPE_MITOS } from './view/mitos-view';
import { renderAngleCard } from './view/cards';
import { getActionableErrorMessage } from './view/state';
import { Angle } from './core/types';
import { createAngleNote } from './core/actions';
import { createDashboardNote } from './core/dashboard';
import { extractContextFromEditor } from './core/context';
import { createObsidianVault } from './obsidian-adapter';
import { DEFAULT_KANBAN_TEMPLATE } from './core/kanban';
import { normalizeFolder } from './core/paths';

export default class MitosPlugin extends Plugin {
  settings: MitosSettings = DEFAULT_SETTINGS;
  vaultMemory!: VaultMemory;

  async onload() {
    await this.loadSettings();
    this.vaultMemory = new VaultMemory(this.app, this.settings.contentFolder);

    // Register View
    this.registerView(VIEW_TYPE_MITOS, (leaf) => new MitosView(leaf, this));

    // Ribbon icon: open right sidebar panel
    this.addRibbonIcon('sparkles', 'Mitos: Open Content Panel', () => {
      this.activateView();
    });

    // Command: Open sidebar panel
    this.addCommand({
      id: 'open-mitos-panel',
      name: 'Open Content Panel',
      callback: () => {
        this.activateView();
      },
    });

    // Command: Toggle sidebar panel
    this.addCommand({
      id: 'toggle-mitos-panel',
      name: 'Toggle Content Panel',
      callback: () => {
        this.toggleView();
      },
    });

    // Command: Quick capture modal
    this.addCommand({
      id: 'mitos-brainstorm-modal',
      name: 'Quick Brainstorm (Modal)',
      callback: () => {
        new BrainstormModal(this.app, this).open();
      },
    });

    // Command: Brainstorm from editor selection / active note
    this.addCommand({
      id: 'brainstorm-from-selection',
      name: 'Brainstorm from Selection / Active Note',
      editorCallback: async (editor) => {
        const selection = editor.getSelection();
        const activeFile = this.app.workspace.getActiveFile();
        const ctx = extractContextFromEditor(selection, activeFile?.basename);

        const view = await this.activateView();
        if (view) {
          view.setTopicAndContext(ctx.topic, ctx.contextSnippet, ctx.wasTruncated);
        }
      },
    });

    // Command: Create Dataview Dashboard
    this.addCommand({
      id: 'mitos-create-dashboard',
      name: 'Create Content Dashboard',
      callback: async () => {
        try {
          const vault = createObsidianVault(this.app);
          const path = await createDashboardNote(vault, this.settings.contentFolder);
          new Notice(`Created dashboard at ${path}`);
        } catch (err: any) {
          new Notice(`Failed to create dashboard: ${err.message}`);
        }
      },
    });

    // Command: Bootstrap Kanban Pipeline
    this.addCommand({
      id: 'mitos-bootstrap-kanban',
      name: 'Bootstrap Kanban Pipeline',
      callback: async () => {
        await this.bootstrapKanbanPipeline();
      },
    });

    // Command: Lint active note for slop
    this.addCommand({
      id: 'mitos-lint-active-note',
      name: 'Lint Current Note for AI Slop',
      editorCallback: (editor) => {
        const text = editor.getValue();
        const result = lintScriptForSlop(text, this.settings.antiSlopStrictness);

        if (result.passed) {
          new Notice(`✅ Anti-Slop Score: ${result.score}/100. Clean script!`);
        } else {
          new Notice(
            `⚠️ Anti-Slop Score: ${result.score}/100\nWarnings:\n${result.warnings.slice(0, 2).join('\n')}`,
            8000
          );
        }
      },
    });

    // Register settings tab
    this.addSettingTab(new MitosSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_MITOS);
  }

  async activateView(): Promise<MitosView | null> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_MITOS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      // Safe mobile / desktop sidebar access (B16)
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_MITOS, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      // Ensure mobile right split is opened if collapsed
      if ((workspace as any).rightSplit && (workspace as any).rightSplit.collapsed) {
        (workspace as any).rightSplit.expand();
      }
      return leaf.view as MitosView;
    }

    return null;
  }

  async toggleView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_MITOS);
    if (leaves.length > 0) {
      workspace.detachLeavesOfType(VIEW_TYPE_MITOS);
    } else {
      await this.activateView();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.vaultMemory = new VaultMemory(this.app, this.settings.contentFolder);
  }

  async bootstrapKanbanPipeline(): Promise<void> {
    try {
      const vault = createObsidianVault(this.app);
      const folder = normalizeFolder(this.settings.contentFolder);
      const pipelinePath = folder ? `${folder}/_pipeline.md` : '_pipeline.md';

      if (folder && !(await vault.exists(folder))) {
        await vault.createFolder(folder);
      }

      let createdFile = false;
      if (!(await vault.exists(pipelinePath))) {
        await vault.write(pipelinePath, DEFAULT_KANBAN_TEMPLATE);
        createdFile = true;
      }

      const configDir = (this.app.vault as any).configDir || '.obsidian';
      const kanbanPluginDir = `${configDir}/plugins/obsidian-kanban`;
      const isKanbanInstalled = await this.app.vault.adapter.exists(kanbanPluginDir);

      if (!isKanbanInstalled) {
        new Notice(
          `⚠️ Obsidian Kanban is not installed in "${kanbanPluginDir}". ` +
            `Install it via Settings > Community plugins or run "npm run setup:kanban". ` +
            `Pipeline note ${createdFile ? 'created' : 'already initialized'} at "${pipelinePath}".`,
          10000
        );
      } else {
        new Notice(
          `✅ Kanban pipeline ready at "${pipelinePath}".` +
            (createdFile ? ' Created default board.' : '')
        );
      }
    } catch (err: any) {
      new Notice(`Failed to bootstrap Kanban pipeline: ${err.message}`, 8000);
    }
  }
}

export class BrainstormModal extends Modal {
  plugin: MitosPlugin;
  topicInput!: HTMLTextAreaElement;
  resultsContainer!: HTMLElement;

  constructor(app: App, plugin: MitosPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '⚡ Mitos Content Brainstormer' });

    contentEl.createEl('p', {
      text: 'Enter a feature, problem, or technical topic. Mitos will generate 3 hook-tested angles and verify against vault history.',
      cls: 'mitos-desc',
    });

    this.topicInput = contentEl.createEl('textarea', {
      cls: 'mitos-topic-input',
      placeholder: 'e.g. How Pyron verifies numbers in lecture slides without hallucinating...',
      attr: { rows: 3 },
    });

    const btnContainer = contentEl.createEl('div', { cls: 'mitos-actions' });
    const generateBtn = btnContainer.createEl('button', {
      text: 'Generate Angles',
      cls: 'mod-cta',
    });

    this.resultsContainer = contentEl.createEl('div', { cls: 'mitos-results' });

    generateBtn.addEventListener('click', async () => {
      const topic = this.topicInput.value.trim();
      if (!topic) {
        new Notice('Please enter a topic to brainstorm.');
        return;
      }

      this.resultsContainer.empty();
      const loading = this.resultsContainer.createEl('div', { cls: 'mitos-loading-spinner' });
      loading.createSpan({ text: 'Generating angles and checking vault memory...' });

      try {
        const angles = await generateAngles(topic, this.plugin.settings);
        const dupCheck = await this.plugin.vaultMemory.checkDuplicate(topic);

        this.resultsContainer.empty();

        if (dupCheck.isDuplicate) {
          const warningEl = this.resultsContainer.createEl('div', { cls: 'mitos-warning' });
          warningEl.createEl('strong', { text: '⚠️ Vault Memory Warning: ' });
          warningEl.createSpan({ text: `Similar topic found in: ${dupCheck.matchedWith}` });
        }

        angles.forEach((angle) => {
          renderAngleCard(this.resultsContainer, angle, async (savedAngle, date) => {
            await this.saveAngle(savedAngle, date);
          });
        });
      } catch (err: any) {
        this.resultsContainer.empty();
        const errEl = this.resultsContainer.createEl('div', { cls: 'mitos-error' });
        errEl.createSpan({ text: `Error: ${getActionableErrorMessage(err)}` });
      }
    });
  }

  async saveAngle(angle: Angle, publishDate: string) {
    const vault = createObsidianVault(this.app);
    const saved = await createAngleNote(vault, this.plugin.settings.contentFolder, angle, publishDate);
    new Notice(`Added "${angle.title}" to ${saved.path}`);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
