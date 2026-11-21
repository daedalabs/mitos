import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type MitosPlugin from '../main';
import { Angle, SeriesArchetype, SeriesPlan } from '../core/types';
import { generateAngles } from '../brainstorm';
import { generateSeriesPlan, writeSeriesAtomic } from '../core/series';
import { renderAngleCard } from './cards';
import { renderSeriesPreview } from './series-panel';
import { getActionableErrorMessage, ViewMode } from './state';
import { createAngleNote } from '../core/actions';
import { createObsidianHttpClient, createObsidianVault } from '../obsidian-adapter';

export const VIEW_TYPE_MITOS = 'mitos-view';

export class MitosView extends ItemView {
  plugin: MitosPlugin;
  mode: ViewMode = 'brainstorm';
  topicInput!: HTMLTextAreaElement;
  contextNoticeEl!: HTMLElement;
  archetypeSelect!: HTMLSelectElement;
  resultsContainer!: HTMLElement;
  currentContextSnippet?: string;

  constructor(leaf: WorkspaceLeaf, plugin: MitosPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_MITOS;
  }

  getDisplayText(): string {
    return 'Mitos';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    const root = containerEl.createEl('div', { cls: 'mitos-view-container' });

    // Header
    const header = root.createEl('div', { cls: 'mitos-header' });
    header.createEl('h3', { text: '⚡ Mitos Content Engine' });
    header.createEl('p', {
      cls: 'mitos-desc',
      text: 'AI brainstorming, series blueprints, and anti-slop short-form content architect.',
    });

    // Mode Selector
    const modeRow = root.createEl('div', { cls: 'mitos-actions' });
    const brainstormTabBtn = modeRow.createEl('button', {
      text: 'Brainstorm Angles',
      cls: this.mode === 'brainstorm' ? 'mod-cta' : '',
    });
    const seriesTabBtn = modeRow.createEl('button', {
      text: 'Series Arc',
      cls: this.mode === 'series' ? 'mod-cta' : '',
    });

    // Archetype selection row (for Series mode)
    const archetypeRow = root.createEl('div', {
      cls: 'mitos-actions',
      attr: { style: this.mode === 'series' ? 'display: flex;' : 'display: none;' },
    });
    archetypeRow.createEl('span', { text: 'Archetype:', cls: 'mitos-card-label' });
    this.archetypeSelect = archetypeRow.createEl('select', { cls: 'mitos-archetype-select' });
    this.archetypeSelect.createEl('option', { value: '3_act_engineering_problem', text: '3-Act Problem' });
    this.archetypeSelect.createEl('option', { value: 'deep_dive_breakdown', text: 'Deep Dive' });
    this.archetypeSelect.createEl('option', { value: 'versus_comparison', text: 'Versus Comparison' });

    brainstormTabBtn.addEventListener('click', () => {
      this.mode = 'brainstorm';
      brainstormTabBtn.addClass('mod-cta');
      seriesTabBtn.removeClass('mod-cta');
      archetypeRow.style.display = 'none';
      submitBtn.setText('Generate Angles');
    });

    seriesTabBtn.addEventListener('click', () => {
      this.mode = 'series';
      seriesTabBtn.addClass('mod-cta');
      brainstormTabBtn.removeClass('mod-cta');
      archetypeRow.style.display = 'flex';
      submitBtn.setText('Architect Series');
    });

    // Input form
    const formGroup = root.createEl('div', { cls: 'mitos-form-group' });
    this.topicInput = formGroup.createEl('textarea', {
      cls: 'mitos-topic-input',
      placeholder: 'Enter a feature, problem, or technical topic...',
    });

    this.contextNoticeEl = formGroup.createEl('div', { cls: 'mitos-context-notice' });

    // Submit actions
    const actionRow = root.createEl('div', { cls: 'mitos-actions' });
    const submitBtn = actionRow.createEl('button', {
      text: this.mode === 'brainstorm' ? 'Generate Angles' : 'Architect Series',
      cls: 'mod-cta',
    });

    const clearBtn = actionRow.createEl('button', { text: 'Clear' });
    clearBtn.addEventListener('click', () => {
      this.topicInput.value = '';
      this.currentContextSnippet = undefined;
      this.contextNoticeEl.empty();
      this.resultsContainer.empty();
    });

    // Results container
    this.resultsContainer = root.createEl('div', { cls: 'mitos-results' });

    submitBtn.addEventListener('click', async () => {
      await this.handleGenerate();
    });
  }

  setTopicAndContext(topic: string, contextSnippet?: string, wasTruncated?: boolean) {
    if (this.topicInput) {
      this.topicInput.value = topic;
    }
    this.currentContextSnippet = contextSnippet;
    if (this.contextNoticeEl) {
      this.contextNoticeEl.empty();
      if (contextSnippet) {
        this.contextNoticeEl.createEl('span', {
          text: `📎 Context attached (${contextSnippet.length} chars)${wasTruncated ? ' [truncated to 4k]' : ''}`,
        });
      }
    }
  }

  async handleGenerate(): Promise<void> {
    const topic = this.topicInput.value.trim();
    if (!topic) {
      new Notice('Please enter a topic to brainstorm.');
      return;
    }

    this.resultsContainer.empty();
    const loadingEl = this.resultsContainer.createEl('div', { cls: 'mitos-loading-spinner' });
    loadingEl.createEl('span', { text: '⏳ Generating with AI and checking vault memory...' });

    const httpClient = createObsidianHttpClient();
    const vault = createObsidianVault(this.app);

    try {
      if (this.mode === 'brainstorm') {
        const angles = await generateAngles(topic, this.plugin.settings, this.currentContextSnippet, httpClient);
        const dupCheck = await this.plugin.vaultMemory.checkDuplicate(topic);

        this.resultsContainer.empty();

        if (dupCheck.isDuplicate) {
          const warnEl = this.resultsContainer.createEl('div', { cls: 'mitos-warning' });
          warnEl.createEl('strong', { text: '⚠️ Vault Memory Notice: ' });
          warnEl.createSpan({ text: `Similar content found: ${dupCheck.matchedWith}` });
        }

        angles.forEach((angle) => {
          renderAngleCard(this.resultsContainer, angle, async (savedAngle, date) => {
            await this.saveSingleAngle(savedAngle, date);
          });
        });
      } else {
        const archetype = this.archetypeSelect.value as SeriesArchetype;
        const series = await generateSeriesPlan(topic, archetype, this.plugin.settings, httpClient);

        this.resultsContainer.empty();
        renderSeriesPreview(this.resultsContainer, series, async (savedSeries, startDate, cadence) => {
          const res = await writeSeriesAtomic(vault, savedSeries, this.plugin.settings.contentFolder, startDate, cadence);
          new Notice(`✅ Created series: ${savedSeries.series_title} (${res.episodeFilePaths.length} episodes)`);
        });
      }
    } catch (err: any) {
      this.resultsContainer.empty();
      const errEl = this.resultsContainer.createEl('div', { cls: 'mitos-error' });
      errEl.createEl('strong', { text: 'Error: ' });
      errEl.createSpan({ text: getActionableErrorMessage(err) });
    }
  }

  async saveSingleAngle(angle: Angle, publishDate: string): Promise<void> {
    const vault = createObsidianVault(this.app);
    const saved = await createAngleNote(vault, this.plugin.settings.contentFolder, angle, publishDate);
    new Notice(`Added "${angle.title}" to ${saved.path}`);
  }

  async onClose(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
  }
}
