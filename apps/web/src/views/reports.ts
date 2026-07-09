import { InvoiceSummaryDto, QueueRow, SyncStatusDto, ValidationAlert, VendorBar } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderInvoiceTable, renderVendorBars, statusChip } from './shared.js';

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
      <div class="settings-list">
        <div class="settings-row">
          <div>
            <strong>${escapeHtml(stat)}</strong>
            <small>Derived from the current invoice workspace</small>
          </div>
        </div>
        <div class="settings-row">
          <div>
            <strong>Open report</strong>
            <small>Use the linked page or invoice list to inspect details</small>
          </div>
          <a class="button ghost" href="${link}" data-route="${route}">View -></a>
        </div>
      </div>
    </article>
  `;
}

export function renderReportsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
): string {
  const vendorBars = buildVendorBars(queueRows);
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const approvedCount = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const lastSync = syncStatus ? formatDateTime(syncStatus.lastSuccessfulRunUtc) : 'Pending';

  return `
    <section class="page active reports-page">
      ${pageHeader('Reports', 'Ready-to-share operational summaries with links back into the invoice workspace.', `
        <span class="status-chip approved">Updated ${escapeHtml(lastSync)}</span>
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
            <h2>Report Packs</h2>
            <p>Shortcuts to the views that feed the shared reporting workflow.</p>
          </div>
        </div>
        <div class="reports-pack-grid">
          ${renderReportCard('Monthly close pack', 'A fast summary of invoices, totals, and approval state.', `${invoices.length} invoices`, '/invoices', 'invoices', 'approved')}
          ${renderReportCard('Operational dashboard', 'A live workspace view for current invoice activity.', `${queueRows.length} queue items`, '/', 'dashboard', 'warning')}
          ${renderReportCard('Vendor performance report', 'Shows supplier concentration and approval patterns.', `${vendorBars.length} ranked vendors`, '/vendors', 'vendors', 'approved')}
          ${renderReportCard('Notifications digest', 'A short list of current alerts and queue activity.', `${validationAlerts.length} active alerts`, '/notifications', 'notifications', 'exception')}
        </div>
      </section>

      <section class="reports-section">
        <div class="reports-section-header">
          <div>
            <h2>Supporting Sections</h2>
            <p>Vendor concentration, exceptions, and operational notes each have their own card.</p>
          </div>
        </div>
        <div class="reports-support-grid">
          <section class="card">
            <div class="card-header">
              <h2>Vendor Mix</h2>
              <span class="status-chip pending-neutral">Ranked</span>
            </div>
            ${renderVendorBars(vendorBars)}
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Exceptions</h2>
              <span class="status-chip exception">${validationAlerts.length}</span>
            </div>
            <div class="alert-list">${renderAlertCards(validationAlerts.slice(0, 4))}</div>
          </section>

          <section class="card reports-notes-card">
            <div class="card-header">
              <h2>Report Notes</h2>
              <span class="status-chip pending-neutral">Live</span>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Export friendly</strong>
                  <small>The report pages are designed to be readable and scannable</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Always current</strong>
                  <small>Report values come from the same workspace data used elsewhere</small>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="card reports-snapshot-card">
        <div class="card-header">
          <div>
            <h2>Recent Invoice Snapshot</h2>
            <p>Source data that feeds the reporting views.</p>
          </div>
          <a class="button ghost" href="/invoices">Open invoices -></a>
        </div>
        ${renderInvoiceTable(invoices.slice(0, 6))}
      </section>
    </section>
  `;
}
