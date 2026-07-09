import { DateRangeFilter, InvoiceSummaryDto, QueueRow, SyncStatusDto, ValidationAlert, VendorBar } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader } from './shared.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return character;
    }
  });
}

function buildVendorBars(queueRows: QueueRow[]): VendorBar[] {
  const counts = new Map<string, number>();
  queueRows.forEach((row) => {
    counts.set(row.vendor, (counts.get(row.vendor) ?? 0) + 1);
  });

  const max = Math.max(...counts.values(), 1);
  const palette: VendorBar['color'][] = ['teal', 'green', 'orange', 'red', ''];
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count], index) => ({
      name,
      count,
      width: Math.max(24, Math.round((count / max) * 100)),
      color: palette[index % palette.length],
    }));
}

type ReportSignalRow = {
  signal: string;
  value: string;
  notes: string;
  route: 'dashboard' | 'vendors' | 'notifications';
};

function buildReportSignalRows(queueRows: QueueRow[], validationAlerts: ValidationAlert[], vendorBars: VendorBar[]): ReportSignalRow[] {
  const topVendors = vendorBars.slice(0, 3).map((bar) => `${bar.name} (${bar.count})`).join(', ');

  return [
    {
      signal: 'Queue Health',
      value: `${queueRows.length} items`,
      notes: queueRows.length > 0 ? 'Invoices currently waiting for reviewer action.' : 'No open queue records in this period.',
      route: 'dashboard',
    },
    {
      signal: 'Vendor Mix',
      value: `${vendorBars.length} ranked`,
      notes: topVendors || 'No vendor concentration data in this period.',
      route: 'vendors',
    },
    {
      signal: 'Exceptions',
      value: `${validationAlerts.length} alerts`,
      notes: validationAlerts.length > 0 ? 'Open validation alerts needing follow-up.' : 'No active validation alerts in this period.',
      route: 'notifications',
    },
  ];
}

function renderReportSignalsTable(rows: ReportSignalRow[]): string {
  return `
    <div class="table-wrap report-signals-table-wrap">
      <table aria-label="Report signals table">
        <thead>
          <tr>
            <th>Signal</th>
            <th>Value</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.signal)}</strong></td>
                  <td>${escapeHtml(row.value)}</td>
                  <td>${escapeHtml(row.notes)}</td>
                  <td>
                    <div class="report-table-actions">
                      <a class="button ghost" href="/${row.route === 'dashboard' ? '' : row.route}" data-route="${row.route}">Open</a>
                      <button class="button ghost" type="button" data-action="print-report">Print</button>
                    </div>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderReportCard(title: string, description: string, stat: string, link: string, route: 'dashboard' | 'invoices' | 'vendors' | 'notifications', status: string): string {
  return `
    <article class="card">
      <div class="card-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
        <span class="status-chip ${status}">${escapeHtml(normalizeLabel(status))}</span>
      </div>
      <div class="report-card-body">
        <div class="report-card-stat">
          <strong>${escapeHtml(stat)}</strong>
          <small>Derived from the current invoice workspace</small>
        </div>
        <a class="button ghost" href="${link}" data-route="${route}">Open</a>
      </div>
    </article>
  `;
}

export function renderReportsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
  reportsDateRange: DateRangeFilter,
  reportsDateFrom: string,
  reportsDateTo: string,
): string {
  const vendorBars = buildVendorBars(queueRows);
  const signalRows = buildReportSignalRows(queueRows, validationAlerts, vendorBars);
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const approvedCount = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const lastSync = syncStatus ? formatDateTime(syncStatus.lastSuccessfulRunUtc) : 'Pending';

  return `
    <section class="page active reports-page">
      ${pageHeader('Reports', 'Ready-to-share operational summaries with links back into the invoice workspace.', `
        <div class="date-range-controls reports-date-controls">
          <select class="select-field" data-filter="reports-date-range" aria-label="Report date range">
            ${['All Time', 'Last 30 Days', 'This Week', 'This Quarter']
              .map((option) => `<option value="${option}" ${reportsDateRange === option ? 'selected' : ''}>${option}</option>`)
              .join('')}
          </select>
          <input class="input-field" type="date" data-filter="reports-date-from" value="${escapeHtml(reportsDateFrom)}" aria-label="Report from date" />
          <input class="input-field" type="date" data-filter="reports-date-to" value="${escapeHtml(reportsDateTo)}" aria-label="Report to date" />
          <button class="button primary" type="button" data-action="print-report">Print Report</button>
          <span class="status-chip approved">Updated ${escapeHtml(lastSync)}</span>
        </div>
      `)}

      <section class="summary-strip reports-summary-strip">
        <div class="summary-card summary-card-total">
          <small>Report-Ready Invoices</small>
          <strong>${invoices.length}</strong>
          <span>Source data available for export</span>
        </div>
        <div class="summary-card summary-card-pending">
          <small>Queue Items</small>
          <strong>${queueRows.length}</strong>
          <span>Built into the current report pack</span>
        </div>
        <div class="summary-card summary-card-sentback">
          <small>Validation Alerts</small>
          <strong>${validationAlerts.length}</strong>
          <span>Exceptions included in the review summary</span>
        </div>
        <div class="summary-card summary-card-approved">
          <small>Total Spend</small>
          <strong>${formatCurrency(totalAmount, 'USD')}</strong>
          <span>${approvedCount} approved invoices in the current set</span>
        </div>
      </section>

      <section class="reports-section">
        <div class="reports-section-header">
          <div>
            <h2>Quick Views</h2>
            <p>The most useful report shortcuts in one place.</p>
          </div>
        </div>
        <div class="reports-pack-grid reports-pack-grid--compact">
          ${renderReportCard('Monthly close pack', 'Invoice totals and approval state.', `${invoices.length} invoices`, '/invoices', 'invoices', 'approved')}
          ${renderReportCard('Operational dashboard', 'Live invoice activity and queue pressure.', `${queueRows.length} queue items`, '/', 'dashboard', 'warning')}
          ${renderReportCard('Notifications digest', 'Current alerts and queue signals.', `${validationAlerts.length} active alerts`, '/notifications', 'notifications', 'exception')}
        </div>
      </section>

      <section class="reports-section">
        <div class="reports-section-header">
          <div>
            <h2>Current Signals</h2>
            <p>Actionable report signals in one table with quick actions.</p>
          </div>
        </div>
        ${renderReportSignalsTable(signalRows)}
      </section>
    </section>
  `;
}
