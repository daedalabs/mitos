import { Angle } from '../core/types';
import { getDefaultPublishDate } from '../core/dates';
import { getActionableErrorMessage } from './state';

export function renderAngleCard(
  container: HTMLElement,
  angle: Angle,
  onSave: (angle: Angle, publishDate: string) => Promise<void>
): HTMLElement {
  const card = container.createEl('div', { cls: 'mitos-card' });

  // Header
  const header = card.createEl('div', { cls: 'mitos-card-header' });
  const typeLabel = angle.angleType.replace('_', ' ').toUpperCase();
  header.createEl('div', {
    cls: 'mitos-card-title',
    text: `${angle.title} [${typeLabel}]`,
  });

  const isPass = angle.lint?.passed ?? true;
  const score = angle.lint?.score ?? 100;
  const badgeCls = `mitos-badge ${isPass ? 'is-pass' : 'is-fail'}`;
  header.createEl('span', {
    cls: badgeCls,
    text: `Slop Score: ${score}/100`,
  });

  // Hook row (Safe DOM, no innerHTML)
  const hookRow = card.createEl('p', { cls: 'mitos-card-row' });
  hookRow.createEl('span', { cls: 'mitos-card-label', text: 'Hook:' });
  hookRow.createEl('em', { text: `"${angle.hook}"` });

  // Core Tension row
  const tensionRow = card.createEl('p', { cls: 'mitos-card-row' });
  tensionRow.createEl('span', { cls: 'mitos-card-label', text: 'Tension:' });
  tensionRow.createSpan({ text: angle.coreTension });

  // Visual Proof Anchor row
  const anchorRow = card.createEl('p', { cls: 'mitos-card-row' });
  anchorRow.createEl('span', { cls: 'mitos-card-label', text: 'Visual Anchor:' });
  anchorRow.createSpan({ text: angle.visualProofAnchor });

  if (angle.openLoop) {
    const loopRow = card.createEl('p', { cls: 'mitos-card-row' });
    loopRow.createEl('span', { cls: 'mitos-card-label', text: 'Open Loop:' });
    loopRow.createSpan({ text: angle.openLoop });
  }

  // Action Row: Date input + Save Button
  const actionRow = card.createEl('div', { cls: 'mitos-actions' });
  const dateContainer = actionRow.createEl('div', { cls: 'mitos-date-container' });
  dateContainer.createEl('span', { text: 'Publish:' });
  const dateInput = dateContainer.createEl('input', {
    cls: 'mitos-date-input',
    type: 'date',
    value: getDefaultPublishDate(),
  });

  const saveBtn = actionRow.createEl('button', {
    text: '📅 Add to Calendar / Vault',
    cls: 'mitos-create mod-cta',
  });

  let errorEl: HTMLElement | null = null;

  saveBtn.addEventListener('click', async () => {
    errorEl?.remove();
    errorEl = null;
    saveBtn.disabled = true;
    saveBtn.setText('Adding...');
    try {
      await onSave(angle, dateInput.value || getDefaultPublishDate());
      saveBtn.setText('✅ Added');
    } catch (err: any) {
      saveBtn.disabled = false;
      saveBtn.setText('Retry');
      errorEl = card.createEl('div', { cls: 'mitos-error' });
      errorEl.setText(getActionableErrorMessage(err));
    }
  });

  return card;
}
