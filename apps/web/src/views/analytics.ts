import { InvoiceSummaryDto, QueueRow, SyncStatusDto, ValidationAlert, QueueSummaryItem, VendorBar } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderInvoiceTable, renderQueueSummary, renderVendorBars, statusChip } from './shared.js';

interface AnalyticsPageData {
  invoices: InvoiceSummaryDto[];
  queueRows: QueueRow[];
  validationAlerts: ValidationAlert[];
  syncStatus: SyncStatusDto | null;
}

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

function buildQueueSummary(rows: QueueRow[]): QueueSummaryItem[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  });

  const palette: QueueSummaryItem['className'][] = ['orange', 'blue', 'purple', 'red', 'teal'];
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, count], index) => ({
      label,
      count,
      className: palette[index % palette.length],
    }));
}

function buildVendorBars(rows: QueueRow[]): VendorBar[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    counts.set(row.vendor, (counts.get(row.vendor) ?? 0) + 1);
  });

  const max = Math.max(...counts.values(), 1);
  const colors: VendorBar['color'][] = ['red', 'orange', '', 'teal', 'green'];

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count], index) => ({
      name,
      count,
      width: Math.max(20, Math.round((count / max) * 100)),
      color: colors[index % colors.length],
    }));
}

export function renderAnalyticsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
): string {
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const approvedCount = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const queueSummary = buildQueueSummary(queueRows);
  const vendorBars = buildVendorBars(queueRows);
  const recentInvoices = invoices.slice(0, 6);
  const lastSync = syncStatus ? formatDateTime(syncStatus.lastSuccessfulRunUtc) : 'Pending';

  return `
    <section class="page active analytics-page">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Analytics', 'Live invoice trends, queue pressure, and validation signals drawn from the current workspace data.', `
            <span class="status-chip approved">Updated ${escapeHtml(lastSync)}</span>
          `)}

          <section class="summary-strip">
            <div class="summary-card summary-card-total">
              <small>Total Invoice Value</small>
              <strong>${formatCurrency(totalAmount, 'USD')}</strong>
              <span>${invoices.length} invoices in the current data set</span>
            </div>
            <div class="summary-card summary-card-pending">
              <small>Queue Items</small>
              <strong>${queueRows.length}</strong>
              <span>${queueRows.filter((row) => normalizeLabel(row.status) !== 'Approved').length} need review attention</span>
            </div>
            <div class="summary-card summary-card-sentback">
              <small>Validation Alerts</small>
              <strong>${validationAlerts.length}</strong>
              <span>${validationAlerts.length > 0 ? 'Signals surfaced from the active review bundle' : 'No active exceptions flagged'}</span>
            </div>
            <div class="summary-card summary-card-approved">
              <small>Approved</small>
              <strong>${approvedCount}</strong>
              <span>${syncStatus ? normalizeLabel(syncStatus.status) : 'Sync status pending'}</span>
            </div>
          </section>

          <section class="content-row">
            <article class="card">
              <div class="card-header">
                <div>
                  <h2>Queue Pressure</h2>
                  <p>Exceptions and review reasons grouped from the current queue.</p>
                </div>
                <span class="status-chip pending-neutral">${queueRows.length} live items</span>
              </div>
              ${renderQueueSummary(queueSummary)}
              <div style="height: 18px"></div>
              ${renderInvoiceTable(recentInvoices)}
            </article>

            <article class="card">
              <div class="card-header">
                <div>
                  <h2>Vendor Concentration</h2>
                  <p>Workload distribution across the most active vendors.</p>
                </div>
                <span class="status-chip pending-neutral">Top 5</span>
              </div>
              ${renderVendorBars(vendorBars)}
            </article>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header">
              <h2>Validation Hotspots</h2>
              <span class="status-chip exception">${validationAlerts.length}</span>
            </div>
            <div class="alert-list">${renderAlertCards(validationAlerts.slice(0, 4))}</div>
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Data Freshness</h2>
              <span class="status-chip ${syncStatus ? (normalizeLabel(syncStatus.status).toLowerCase().includes('healthy') ? 'approved' : 'warning') : 'pending-neutral'}">${syncStatus ? normalizeLabel(syncStatus.status) : 'Pending'}</span>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Last Successful Sync</strong>
                  <small>${syncStatus ? escapeHtml(lastSync) : 'Waiting for the first sync run'}</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Pending Items</strong>
                  <small>Records still moving through the workspace</small>
                </div>
                <span class="status-chip pending-neutral">${syncStatus?.pendingItems ?? queueRows.length}</span>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Failed Items</strong>
                  <small>Exceptions requiring manual follow-up</small>
                </div>
                <span class="status-chip exception">${syncStatus?.failedItems ?? validationAlerts.length}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}
