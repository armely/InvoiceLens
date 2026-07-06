import { ValidationSummaryViewData } from '../shared/models.js';
import { formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderAuditTrail, renderInvoiceSummaryCard, renderValidationChecklist, routeHref } from './shared.js';

export function renderValidationSummaryPage(data: ValidationSummaryViewData): string {
  const checks = data.checklist;
  const summary = data.validationSummary;
  const totalChecks = summary?.checks.length ?? 0;
  const passedChecks = checks.filter((check) => check.passed).length;

  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Validation Summary', 'Review the latest SQL-backed validation run, with rule status, messages, and audit history.', `
            ${summary?.invoiceId ? `<a class="button primary" href="${routeHref('invoices', summary.invoiceId)}" data-action="open-invoice-preview" data-invoice-id="${summary.invoiceId}">Open Invoice Preview</a>` : ''}
          `)}
          <section class="summary-strip">
            <div class="summary-card"><small>Checks Passed</small><strong>${passedChecks} / ${totalChecks}</strong></div>
            <div class="summary-card"><small>Last Run</small><strong>${summary ? formatDateTime(summary.executedAt) : 'Pending'}</strong></div>
            <div class="summary-card"><small>Status</small><strong>${summary ? normalizeLabel(summary.overallStatus) : 'Pending'}</strong></div>
            <div class="summary-card"><small>Selected Invoice</small><strong>${summary?.invoiceId ?? 'None'}</strong></div>
          </section>
          <section class="card">
            <div class="card-header"><h2>Validation Checklist</h2></div>
            ${renderValidationChecklist(checks)}
          </section>
          <section class="card">
            <div class="card-header"><h2>Validation Checks</h2></div>
            <div class="alert-list">${renderAlertCards(data.validationAlerts)}</div>
          </section>
        </div>
        <aside class="side-panel">
          ${data.review ? renderInvoiceSummaryCard(data.review.invoice) : '<section class="card"><div class="empty-state">Select an invoice to see its summary.</div></section>'}
          <section class="card">
            <div class="card-header"><h2>Audit Trail</h2></div>
            ${renderAuditTrail(data.auditTrail)}
          </section>
        </aside>
      </div>
    </section>
  `;
}
