import { InvoiceSummaryDto, QueueRow, SyncStatusDto, ValidationAlert, VendorBar } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderInvoiceTable, renderVendorBars, statusChip } from './shared.js';

interface VendorSummary {
  vendor: string;
  invoiceCount: number;
  totalAmount: number;
  queueCount: number;
  approvedCount: number;
  lastUpdated: string;
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

function buildVendorSummaries(invoices: InvoiceSummaryDto[], queueRows: QueueRow[]): VendorSummary[] {
  const queueCounts = new Map<string, number>();
  queueRows.forEach((row) => {
    queueCounts.set(row.vendor, (queueCounts.get(row.vendor) ?? 0) + 1);
  });

  const groups = new Map<string, InvoiceSummaryDto[]>();
  invoices.forEach((invoice) => {
    const current = groups.get(invoice.vendor) ?? [];
    current.push(invoice);
    groups.set(invoice.vendor, current);
  });

  return [...groups.entries()]
    .map(([vendor, vendorInvoices]) => ({
      vendor,
      invoiceCount: vendorInvoices.length,
      totalAmount: vendorInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      queueCount: queueCounts.get(vendor) ?? 0,
      approvedCount: vendorInvoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length,
      lastUpdated: vendorInvoices.sort((left, right) => right.updatedAtUtc.localeCompare(left.updatedAtUtc))[0]?.updatedAtUtc ?? '',
    }))
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 8);
}

function renderVendorTable(rows: VendorSummary[]): string {
  if (rows.length === 0) {
    return '<div class="empty-state">No vendor records are available yet.</div>';
  }

  return `
    <div class="table-wrap">
      <table aria-label="Vendor scorecard">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Invoices</th>
            <th>Total Spend</th>
            <th>Queue</th>
            <th>Approval</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>
                    <div class="invoice-cell-stack">
                      <strong>${escapeHtml(row.vendor)}</strong>
                      <small>Workspace supplier record</small>
                    </div>
                  </td>
                  <td>${row.invoiceCount}</td>
                  <td>${formatCurrency(row.totalAmount, 'USD')}</td>
                  <td>${row.queueCount}</td>
                  <td>${statusChip(row.approvedCount === row.invoiceCount ? 'Approved' : row.queueCount > 0 ? 'Warning' : 'Pending')}</td>
                  <td>${row.lastUpdated ? escapeHtml(formatDateTime(row.lastUpdated)) : 'Pending'}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderVendorsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
): string {
  const vendorRows = buildVendorSummaries(invoices, queueRows);
  const totalSpend = vendorRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const approvedShare = invoices.length > 0 ? Math.round((invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length / invoices.length) * 100) : 0;
  const vendorBars: VendorBar[] = vendorRows.map((row, index) => ({
    name: row.vendor,
    count: row.invoiceCount,
    width: Math.max(24, 100 - index * 10),
    color: index % 2 === 0 ? 'teal' : 'green',
  }));

  return `
    <section class="page active vendors-page">
      ${pageHeader('Vendors', 'Supplier performance, queue exposure, and spend concentration from the current invoice set.', `
        <span class="status-chip pending-neutral">${syncStatus ? normalizeLabel(syncStatus.status) : 'Pending sync'}</span>
      `)}

      <section class="vendors-top-grid">
        <section class="summary-strip vendors-summary-strip">
          <div class="summary-card summary-card-total">
            <small>Tracked Vendors</small>
            <strong>${vendorRows.length}</strong>
            <span>Top suppliers active in the workspace</span>
          </div>
          <div class="summary-card summary-card-pending">
            <small>Total Spend</small>
            <strong>${formatCurrency(totalSpend, 'USD')}</strong>
            <span>Concentrated across the displayed vendor set</span>
          </div>
          <div class="summary-card summary-card-sentback">
            <small>Queue Exposure</small>
            <strong>${queueRows.length}</strong>
            <span>Invoices waiting on vendor review</span>
          </div>
          <div class="summary-card summary-card-approved">
            <small>Approved Share</small>
            <strong>${approvedShare}%</strong>
            <span>${syncStatus ? `Updated ${formatDateTime(syncStatus.lastSuccessfulRunUtc)}` : 'Sync details pending'}</span>
          </div>
        </section>

        <section class="card vendors-alerts-card">
          <div class="card-header">
            <div>
              <h2>Validation Alerts</h2>
              <p>Open exceptions tied to the current vendor set.</p>
            </div>
            <span class="status-chip exception">${validationAlerts.length}</span>
          </div>
          <div class="alert-list">${renderAlertCards(validationAlerts.slice(0, 4))}</div>
        </section>
      </section>

      <section class="page-section">
        <div class="page-section-header">
          <div>
            <h2>Vendor Performance</h2>
            <p>Scorecard, supplier mix, and notes arranged in three clean columns.</p>
          </div>
        </div>
        <div class="vendors-three-column-grid">
          <article class="card">
            <div class="card-header">
              <div>
                <h2>Vendor Scorecard</h2>
                <p>Spend, queue, and approval signals sorted by supplier value.</p>
              </div>
              <span class="status-chip pending-neutral">${vendorRows.length} vendors</span>
            </div>
            ${renderVendorTable(vendorRows)}
          </article>

          <article class="card">
            <div class="card-header">
              <div>
                <h2>Top Supplier Mix</h2>
                <p>Invoice volume distribution across active vendors.</p>
              </div>
              <span class="status-chip approved">Ranked</span>
            </div>
            ${renderVendorBars(vendorBars)}
          </article>

          <section class="card">
            <div class="card-header">
              <h2>Vendor Notes</h2>
              <span class="status-chip pending-neutral">Live</span>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>High-volume suppliers</strong>
                  <small>The largest suppliers appear first for quick review</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Review queue exposure</strong>
                  <small>Queue counts are surfaced next to each vendor</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Approval state</strong>
                  <small>Vendor records reflect the current invoice status</small>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section class="card page-snapshot-card">
        <div class="card-header">
          <div>
            <h2>Vendor Invoices</h2>
            <p>Recent invoices that feed the vendor view.</p>
          </div>
          <a class="button ghost" href="/invoices">Open invoices -></a>
        </div>
        ${renderInvoiceTable(invoices.slice(0, 6))}
      </section>
    </section>
  `;
}
