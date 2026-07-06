import { InvoiceSummaryDto } from '../shared/models.js';
import { applyInvoiceFilters } from '../shared/utils.js';
import { renderInvoiceTable } from './shared.js';

export function renderInvoicesPage(
  invoices: InvoiceSummaryDto[],
  search: string,
  statusFilter: 'All Statuses' | 'Pending Review' | 'Sent Back' | 'Approved',
  dateRange: 'All Time' | 'Last 30 Days' | 'This Week' | 'This Quarter',
  dateFrom: string,
  dateTo: string,
): string {
  const rows = applyInvoiceFilters(invoices, {
    search,
    status: statusFilter,
    dateRange,
    dateFrom,
    dateTo,
    sort: 'Newest First',
  });

  return `
    <section class="page active invoices-layout">
      <section class="filter-bar invoice-filter-bar">
        <div class="filter-field invoice-search-field">
          <span class="field-label">Search</span>
          <div class="search-input-wrap invoice-search">
            <span aria-hidden="true" class="search-glyph">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5"></circle>
                <path d="M16.2 16.2 20 20"></path>
              </svg>
            </span>
            <input class="search-input" type="search" value="${search}" data-input="page-search" placeholder="Search invoice number, vendor, AFE, company, or amount..." />
          </div>
        </div>
        <div class="invoice-filter-grid">
          <label class="filter-field">
            <span class="field-label">Status</span>
            <select class="select-field" data-filter="invoice-status">
              ${['All Statuses', 'Pending Review', 'Sent Back', 'Approved']
                .map((option) => `<option value="${option}" ${statusFilter === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>
          <label class="filter-field">
            <span class="field-label">Date Range</span>
            <select class="select-field" data-filter="invoice-date-range">
              ${['All Time', 'Last 30 Days', 'This Week', 'This Quarter']
                .map((option) => `<option value="${option}" ${dateRange === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>
          <label class="filter-field">
            <span class="field-label">From</span>
            <input class="input-field" type="date" value="${dateFrom}" data-filter="invoice-date-from" aria-label="From date" />
          </label>
          <label class="filter-field">
            <span class="field-label">To</span>
            <input class="input-field" type="date" value="${dateTo}" data-filter="invoice-date-to" aria-label="To date" />
          </label>
        </div>
        <button class="button primary invoice-filter-reset" type="button" data-action="reset-invoice-filters">Clear Filters</button>
      </section>
      <section class="card results-card">
        <div class="card-header results-header">
          <div>
            <p class="card-kicker">Live results</p>
            <h2>Invoice results</h2>
            <p>Click any invoice number to open the modal preview.</p>
          </div>
          <span class="status-chip pending-neutral">${rows.length} shown</span>
        </div>
        ${renderInvoiceTable(rows)}
      </section>
    </section>
  `;
}
