import { SeriesPlan } from '../core/types';
import { getDefaultPublishDate, normalizeCadenceDays } from '../core/dates';
import { getActionableErrorMessage } from './state';

export function renderSeriesPreview(
  container: HTMLElement,
  series: SeriesPlan,
  onSave: (series: SeriesPlan, startDate: string, cadenceDays: number) => Promise<void>
): HTMLElement {
  const panel = container.createEl('div', { cls: 'mitos-series-panel' });

  const header = panel.createEl('div', { cls: 'mitos-series-header' });
  header.createEl('div', { cls: 'mitos-series-title', text: series.series_title });
  header.createEl('p', { cls: 'mitos-card-row', text: `Premise: ${series.premise}` });
  header.createEl('p', { cls: 'mitos-card-row', text: `Archetype: ${series.archetype}` });

  // Episodes preview
  const episodesContainer = panel.createEl('div', { cls: 'mitos-results' });
  series.episodes.forEach((ep) => {
    const card = episodesContainer.createEl('div', { cls: 'mitos-episode-card' });

    const epHeader = card.createEl('div', { cls: 'mitos-episode-header' });
    epHeader.createEl('span', { cls: 'mitos-episode-number', text: `Episode ${ep.n}: ${ep.title}` });

    if (ep.lint) {
      const isPass = ep.lint.passed;
      card.createEl('span', {
        cls: `mitos-badge ${isPass ? 'is-pass' : 'is-fail'}`,
        text: `Score: ${ep.lint.score}/100`,
      });
    }

    const hookRow = card.createEl('p', { cls: 'mitos-card-row' });
    hookRow.createEl('span', { cls: 'mitos-card-label', text: 'Hook:' });
    hookRow.createEl('em', { text: `"${ep.hook}"` });

    const anchorRow = card.createEl('p', { cls: 'mitos-card-row' });
    anchorRow.createEl('span', { cls: 'mitos-card-label', text: 'Visual Anchor:' });
    anchorRow.createSpan({ text: ep.visualProofAnchor });

    if (ep.payoff_from_prev) {
      const payoffRow = card.createEl('p', { cls: 'mitos-card-row' });
      payoffRow.createEl('span', { cls: 'mitos-card-label', text: 'Payoff from Ep ' + (ep.n - 1) + ':' });
      payoffRow.createSpan({ text: ep.payoff_from_prev });
    }

    if (ep.cliffhanger) {
      const cliffRow = card.createEl('p', { cls: 'mitos-card-row' });
      cliffRow.createEl('span', { cls: 'mitos-card-label', text: 'Cliffhanger:' });
      cliffRow.createSpan({ text: ep.cliffhanger });
    }
  });

  // Action controls
  const controls = panel.createEl('div', { cls: 'mitos-actions' });
  const dateContainer = controls.createEl('div', { cls: 'mitos-date-container' });
  dateContainer.createEl('span', { text: 'Start Date:' });
  const dateInput = dateContainer.createEl('input', {
    cls: 'mitos-date-input',
    type: 'date',
    value: getDefaultPublishDate(),
  });

  const cadenceContainer = controls.createEl('div', { cls: 'mitos-date-container' });
  cadenceContainer.createEl('span', { text: 'Cadence (Days):' });
  const cadenceInput = cadenceContainer.createEl('input', {
    cls: 'mitos-date-input',
    type: 'number',
    value: String(series.cadenceDays || 2),
    attr: { min: 1, max: 30, style: 'width: 50px;' },
  });

  const saveBtn = controls.createEl('button', {
    text: `✨ Create Series (${series.episodes.length} Episodes + Index)`,
    cls: 'mitos-create mod-cta',
  });

  let errorEl: HTMLElement | null = null;

  saveBtn.addEventListener('click', async () => {
    errorEl?.remove();
    errorEl = null;
    saveBtn.disabled = true;
    saveBtn.setText('Writing series notes atomically...');
    try {
      const startDate = dateInput.value || getDefaultPublishDate();
      const cadence = normalizeCadenceDays(cadenceInput.value, 2);
      await onSave(series, startDate, cadence);
      saveBtn.setText('✅ Series Created!');
    } catch (err: any) {
      saveBtn.disabled = false;
      saveBtn.setText('Retry');
      errorEl = panel.createEl('div', { cls: 'mitos-error' });
      errorEl.setText(getActionableErrorMessage(err));
    }
  });

  return panel;
}
