import { ComparisonFieldViewModel, ComparisonViewData } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader } from './shared.js';

function getFieldTone(field: ComparisonFieldViewModel): string {
  return field.category === 'Match'
    ? 'approved'
    : field.category === 'Warning'
      ? 'warning'
      : field.category === 'Missing from SQL' || field.category === 'Missing from vendor/OpenInvoice side'
        ? 'exception'
        : field.category === 'Not enough data to compare'
          ? 'warning'
          : 'exception';
}

function renderComparisonRow(field: ComparisonFieldViewModel, index: number): string {
  return `
    <tr class="comparison-table-row">
      <td>
        <span class="comparison-scope-pill">${field.scope}</span>
      </td>
      <td>
        <strong>${field.label}</strong>
        <small>${field.message}</small>
      </td>
      <td>
        <span class="status-chip ${getFieldTone(field)}">${field.category}</span>
      </td>
      <td class="comparison-table-value">
        <strong>${field.localValue}</strong>
      </td>
      <td class="comparison-table-value">
        <strong>${field.systemValue}</strong>
      </td>
      <td class="comparison-table-action">
        <button class="button comparison-detail-button" type="button" data-action="open-comparison-detail" data-comparison-field-index="${index}">View details</button>
      </td>
    </tr>
  `;
}

function renderComparisonTable(data: ComparisonViewData): string {
  return `
    <section class="card comparison-table-card">
      <div class="card-header">
        <div>
          <h2>Comparison Checks</h2>
          <p>Click a row to open the full reason, local value, and SQL value in a modal.</p>
        </div>
        <span class="status-chip pending-neutral">${data.fields.length} checks</span>
      </div>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th scope="col">Scope</th>
              <th scope="col">Field</th>
              <th scope="col">Result</th>
              <th scope="col">Vendor / OpenInvoice</th>
              <th scope="col">Client SQL</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            ${data.fields.length > 0 ? data.fields.map(renderComparisonRow).join('') : '<tr><td colspan="6"><div class="empty-state">No comparison results available.</div></td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderComparisonSummary(data: ComparisonViewData): string {
  const selected = data.selectedLocalInvoice;
  const comparisonRun = data.comparisonRun;
  const issueCount = data.fields.filter((field) => field.category !== 'Match').length;
  const matchedCount = data.fields.length - issueCount;

  return `
    <section class="card comparison-summary-card">
      <div class="card-header">
        <div>
          <h2>Comparison Snapshot</h2>
          <p>Structured fields compared between the selected local invoice and the SQL-backed client record.</p>
        </div>
        <span class="status-chip ${data.loading ? 'pending-neutral' : comparisonRun ? normalizeStatus(comparisonRun.overallStatus) : 'pending-neutral'}">${data.loading ? 'Running' : comparisonRun ? normalizeLabel(comparisonRun.overallStatus) : 'Pending'}</span>
      </div>
      <div class="comparison-summary-grid">
        <div class="comparison-summary-item">
          <small>Vendor / OpenInvoice side</small>
          <strong>${selected ? (selected.invoiceNumber ?? selected.fileName) : 'No invoice selected'}</strong>
          <span>${selected ? (selected.supplierName ?? selected.supplierNumber ?? 'Unknown supplier') : 'Choose an invoice from the queue to compare'}</span>
        </div>
        <div class="comparison-summary-item">
          <small>Client SQL side</small>
          <strong>${comparisonRun?.systemInvoice?.invoiceNumber ?? 'Not found'}</strong>
          <span>${comparisonRun?.systemInvoice?.supplierName ?? 'No matching SQL record selected'}</span>
        </div>
        <div class="comparison-summary-item">
          <small>Match score</small>
          <strong>${comparisonRun?.matchScore == null ? 'N/A' : comparisonRun.matchScore.toFixed(2)}</strong>
          <span>${matchedCount} matched, ${issueCount} need attention</span>
        </div>
        <div class="comparison-summary-item">
          <small>Compared at</small>
          <strong>${comparisonRun ? formatDateTime(comparisonRun.createdAtUtc) : 'Pending'}</strong>
          <span>${data.fields.length} structured checks</span>
        </div>
      </div>
      ${data.error ? `<div class="empty-state comparison-error">${data.error}</div>` : data.loading ? '<div class="empty-state">Running structured comparison against SQL records...</div>' : ''}
    </section>
  `;
}

function renderComparisonDetailModal(field: ComparisonFieldViewModel, index: number): string {
  return `
    <div class="invoice-modal-backdrop comparison-modal-backdrop" data-action="close-comparison-detail">
      <section class="invoice-modal-shell comparison-modal-shell" data-action="modal-shell" role="dialog" aria-modal="true" aria-labelledby="comparisonDetailTitle">
        <header class="invoice-modal-header">
          <div>
            <p class="modal-kicker">Comparison Detail</p>
            <h2 id="comparisonDetailTitle">${field.label}</h2>
            <p>${field.message}</p>
          </div>
          <button class="icon-button modal-close-button" type="button" aria-label="Close comparison detail" data-action="close-comparison-detail">
            <span aria-hidden="true">Ã—</span>
          </button>
        </header>
        <div class="invoice-modal-body comparison-modal-body">
          <div class="comparison-detail-grid">
            <div class="comparison-detail-item">
              <small>Scope</small>
              <strong>${field.scope}</strong>
            </div>
            <div class="comparison-detail-item">
              <small>Result</small>
              <strong><span class="status-chip ${getFieldTone(field)}">${field.category}</span></strong>
            </div>
            <div class="comparison-detail-item">
              <small>Rule code</small>
              <strong>${field.ruleCode}</strong>
            </div>
            <div class="comparison-detail-item">
              <small>Row index</small>
              <strong>${index + 1}</strong>
            </div>
          </div>
          <div class="comparison-detail-values">
            <div class="comparison-detail-value-card">
              <small>Vendor / OpenInvoice</small>
              <strong>${field.localValue}</strong>
            </div>
            <div class="comparison-detail-value-card">
              <small>Client SQL</small>
              <strong>${field.systemValue}</strong>
            </div>
          </div>
        </div>
        <footer class="invoice-modal-footer comparison-modal-footer">
          <div class="modal-footer-copy">
            <span class="status-chip ${getFieldTone(field)}">${field.category}</span>
          </div>
          <div class="modal-footer-actions">
            <button class="button primary" type="button" data-action="close-comparison-detail">Close</button>
          </div>
        </footer>
      </section>
    </div>
  `;
}

export function renderComparisonPage(data: ComparisonViewData): string {
  const selected = data.selectedLocalInvoice;
  const comparisonRun = data.comparisonRun;

  return `
    <section class="page active">
      ${pageHeader('Invoice Comparison', 'Compare a local vendor invoice against the client SQL record using a clean table-first workflow.', `
        <span class="status-chip pending-neutral">${data.localInvoices.length} local invoices</span>
      `)}
      <section class="comparison-workspace comparison-workspace-clean">
        <aside class="comparison-column comparison-queue-column">
          <section class="card comparison-queue-card">
            <div class="card-header">
              <div>
                <h2>Comparison Queue</h2>
                <p>Choose the local invoice to compare</p>
              </div>
              <span class="status-chip pending-neutral">${data.localInvoices.length}</span>
            </div>
            <div class="comparison-queue-list">
              ${data.localInvoices.length > 0
                ? data.localInvoices
                    .map((invoice) => {
                      const isSelected = invoice.localInvoiceFileId === selected?.localInvoiceFileId;
                      return `
                        <button class="comparison-queue-item ${isSelected ? 'selected' : ''}" type="button" data-local-invoice-id="${invoice.localInvoiceFileId}">
                          <div class="comparison-queue-top">
                            <div>
                              <strong>${invoice.invoiceNumber ?? invoice.fileName}</strong>
                              <small>${invoice.supplierName ?? invoice.supplierNumber ?? 'Unknown supplier'}</small>
                            </div>
                            <span class="status-chip ${normalizeStatus(invoice.lastOverallStatus)}">${normalizeLabel(invoice.lastOverallStatus ?? invoice.lastMatchStatus ?? 'Pending')}</span>
                          </div>
                          <div class="comparison-queue-meta">
                            <span>${invoice.totalAmount == null ? 'Amount n/a' : formatCurrency(invoice.totalAmount)}</span>
                            <span>${formatDateTime(invoice.loadedAtUtc)}</span>
                          </div>
                        </button>
                      `;
                    })
                    .join('')
                : '<div class="empty-state">No local invoices loaded.</div>'}
            </div>
          </section>
        </aside>

        <section class="comparison-column comparison-viewer-column">
          ${renderComparisonSummary(data)}
          ${renderComparisonTable(data)}
        </section>
      </section>
      ${data.selectedField ? renderComparisonDetailModal(data.selectedField, data.selectedFieldIndex ?? 0) : ''}
    </section>
  `;
}

function normalizeStatus(status: string | null | undefined): string {
  const normalized = normalizeLabel(status ?? '').toLowerCase();

  if (!normalized || normalized === 'pending') {
    return 'pending-neutral';
  }

  if (normalized.includes('pass') || normalized.includes('match')) {
    return 'approved';
  }

  if (normalized.includes('warning')) {
    return 'warning';
  }

  return 'exception';
}
