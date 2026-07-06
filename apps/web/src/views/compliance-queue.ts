import { QueueRow, QueueSortFilter, QueueSummaryItem, ReviewViewData, ValidationAlert } from '../shared/models.js';
import { applyQueueFilters } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderInvoiceSummaryCard, renderQueueItems, renderQueueSummary } from './shared.js';

export function renderComplianceQueuePage(
  rows: QueueRow[],
  search: string,
  selectedInvoiceId: string,
  queueSort: QueueSortFilter,
  queueSummary: QueueSummaryItem[],
  validationAlerts: ValidationAlert[],
  review: ReviewViewData['review'],
): string {
  const filteredRows = applyQueueFilters(rows, search, queueSort);

  return `
    <section class="page active">
      ${pageHeader('Compliance Queue', 'Review invoices waiting on action, validation, or approval.', `
        <select class="select-field" data-filter="queue-sort">
          ${['Oldest First', 'Newest First', 'Highest Amount']
            .map((option) => `<option value="${option}" ${queueSort === option ? 'selected' : ''}>Sort: ${option}</option>`)
            .join('')}
        </select>
      `)}
      <section class="queue-page-grid">
        <div class="workspace">
          <section class="filter-bar">
            <div class="filter-field queue-search-field">
              <span class="field-label">Search</span>
              <div class="search-input-wrap">
                <span aria-hidden="true" class="search-glyph">
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5"></circle>
                    <path d="M16.2 16.2 20 20"></path>
                  </svg>
                </span>
                <input class="search-input" type="search" value="${search}" data-input="page-search" placeholder="Search queue by invoice, vendor, reason, or status..." />
              </div>
            </div>
            <button class="button" type="button" data-action="clear-search">Clear</button>
          </section>
          <section class="card">
            <div class="card-header"><h2>Queue Items</h2><span class="status-chip pending-neutral">${filteredRows.length} visible</span></div>
            <div class="queue-page-list">${renderQueueItems(filteredRows, selectedInvoiceId)}</div>
          </section>
        </div>
        <aside class="side-panel">
          <section class="card">
            <div class="card-header"><h2>Queue Summary</h2></div>
            ${renderQueueSummary(queueSummary)}
          </section>
          <section class="card">
            <div class="card-header"><h2>Selected Invoice</h2></div>
            ${review ? renderInvoiceSummaryCard(review.invoice) : '<div class="empty-state">Select an invoice to view details.</div>'}
          </section>
          <section class="card">
            <div class="card-header"><h2>Selected Invoice Validation</h2></div>
            <div class="alert-list">${renderAlertCards(validationAlerts)}</div>
          </section>
        </aside>
      </section>
    </section>
  `;
}
