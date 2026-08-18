import { DateRangeFilter, InvoiceStatusFilter, InvoiceSummaryDto, QueueSortFilter } from '../shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, statusChip } from './shared.js';

export interface ArchiveFilters {
  search: string;
  status: InvoiceStatusFilter;
  dateRange: DateRangeFilter;
  dateFrom: string;
  dateTo: string;
  sort: QueueSortFilter;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function options(values: string[], selected: string): string {
  return values.map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`).join('');
}

export function renderArchivePage(invoices: InvoiceSummaryDto[], filters: ArchiveFilters): string {
  const rows = applyInvoiceFilters(invoices, filters);
  const processed = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;

  return `
    <section class="page active archive-page">
      ${pageHeader('Invoice Archive', 'Search every synchronized invoice, including processed and historical records.', `
        <span class="status-chip pending-neutral">${invoices.length} stored</span>
      `)}

      <section class="summary-strip">
        <div class="summary-card summary-card-total"><small>Stored invoices</small><strong>${invoices.length}</strong><span>Complete synchronized history</span></div>
        <div class="summary-card summary-card-approved"><small>Approved</small><strong>${processed}</strong><span>Processed records remain searchable</span></div>
        <div class="summary-card summary-card-pending"><small>Current results</small><strong>${rows.length}</strong><span>Matching the filters below</span></div>
      </section>

      <section class="card archive-results-card">
        <div class="filter-bar archive-filter-bar">
          <label class="filter-field archive-search"><span class="field-label">Search</span><input class="input-field" type="search" value="${escapeHtml(filters.search)}" data-filter="archive-search" placeholder="Invoice, vendor, company, or AFE" /></label>
          <label class="filter-field"><span class="field-label">Status</span><select class="select-field" data-filter="archive-status">${options(['All Statuses', 'Pending Review', 'Sent Back', 'Approved'], filters.status)}</select></label>
          <label class="filter-field"><span class="field-label">Period</span><select class="select-field" data-filter="archive-date-range">${options(['All Time', 'Last 30 Days', 'This Week', 'This Quarter'], filters.dateRange)}</select></label>
          <label class="filter-field"><span class="field-label">From</span><input class="input-field" type="date" value="${filters.dateFrom}" data-filter="archive-date-from" /></label>
          <label class="filter-field"><span class="field-label">To</span><input class="input-field" type="date" value="${filters.dateTo}" data-filter="archive-date-to" /></label>
          <label class="filter-field"><span class="field-label">Sort</span><select class="select-field" data-filter="archive-sort">${options(['Newest First', 'Oldest First', 'Highest Amount'], filters.sort)}</select></label>
          <button class="button ghost" type="button" data-action="reset-archive-filters">Reset</button>
        </div>

        <div class="table-wrap">
          ${rows.length === 0 ? '<div class="empty-state">No archived invoices match these filters.</div>' : `
          <table aria-label="Invoice archive">
            <thead><tr><th>Invoice</th><th>Vendor</th><th>Company / AFE</th><th>Status</th><th>Amount</th><th>Last updated</th></tr></thead>
            <tbody>${rows.map((invoice) => `
              <tr>
                <td><button class="archive-invoice-link invoice-link" type="button" data-invoice-id="${invoice.invoiceId}">${escapeHtml(invoice.invoiceNumber)}</button></td>
                <td>${escapeHtml(invoice.vendor)}</td>
                <td><div class="invoice-cell-stack"><strong>${escapeHtml(invoice.company)}</strong><small>${escapeHtml(invoice.afe || 'No AFE')}</small></div></td>
                <td>${statusChip(normalizeLabel(invoice.status))}</td>
                <td>${formatCurrency(invoice.amount, invoice.currency)}</td>
                <td>${formatDateTime(invoice.updatedAtUtc)}</td>
              </tr>`).join('')}</tbody>
          </table>`}
        </div>
      </section>
    </section>`;
}
