import { InvoiceSummaryDto, QueueRow, SyncStatusDto, ValidationAlert } from '../shared/models.js';
import { formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderAlertCards, renderInvoiceTable, statusChip } from './shared.js';

interface ContractVendorRow {
  vendor: string;
  invoiceCount: number;
  queueCount: number;
  totalAmount: number;
  approvedCount: number;
  posture: string;
  nextReview: string;
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

function buildVendorRows(invoices: InvoiceSummaryDto[], queueRows: QueueRow[]): ContractVendorRow[] {
  const queueCounts = new Map<string, number>();
  queueRows.forEach((row) => {
    queueCounts.set(row.vendor, (queueCounts.get(row.vendor) ?? 0) + 1);
  });

  const invoiceGroups = new Map<string, InvoiceSummaryDto[]>();
  invoices.forEach((invoice) => {
    const current = invoiceGroups.get(invoice.vendor) ?? [];
    current.push(invoice);
    invoiceGroups.set(invoice.vendor, current);
  });

  return [...invoiceGroups.entries()]
    .map(([vendor, vendorInvoices], index) => {
      const totalAmount = vendorInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
      const queueCount = queueCounts.get(vendor) ?? 0;
      const approvedCount = vendorInvoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
      const posture = queueCount > 0 ? 'Review Required' : approvedCount === vendorInvoices.length ? 'Stable' : 'Monitored';
      const nextReview = new Date(Date.UTC(2026, (index % 12) + 1, Math.min(28, 7 + index * 3)));

      return {
        vendor,
        invoiceCount: vendorInvoices.length,
        queueCount,
        totalAmount,
        approvedCount,
        posture,
        nextReview: formatDateTime(nextReview.toISOString()),
      };
    })
    .sort((left, right) => right.totalAmount - left.totalAmount)
    .slice(0, 6);
}

function renderVendorTable(rows: ContractVendorRow[]): string {
  if (rows.length === 0) {
    return '<div class="empty-state">No contract vendors available.</div>';
  }

  return `
    <div class="table-wrap">
      <table aria-label="Contract coverage">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Invoices</th>
            <th>Queue</th>
            <th>Total Spend</th>
            <th>Posture</th>
            <th>Next Review</th>
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
                      <small>Derived from the active invoice set</small>
                    </div>
                  </td>
                  <td>${row.invoiceCount}</td>
                  <td>${row.queueCount}</td>
                  <td>${formatCurrency(row.totalAmount, 'USD')}</td>
                  <td>${statusChip(row.queueCount > 0 ? 'Warning' : row.approvedCount === row.invoiceCount ? 'Approved' : 'Pending')}</td>
                  <td>${escapeHtml(row.nextReview)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderContractsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
): string {
  const vendorRows = buildVendorRows(invoices, queueRows);
  const contractLinkedInvoices = invoices.slice(0, 5);
  const syncLabel = syncStatus ? normalizeLabel(syncStatus.status) : 'Pending';

  return `
    <section class="page active contracts-page">
      ${pageHeader('Contracts', 'Contract posture, vendor coverage, and review status pulled from the current workspace records.', `
        <span class="status-chip ${syncStatus ? (syncLabel.toLowerCase().includes('healthy') ? 'approved' : 'warning') : 'pending-neutral'}">${escapeHtml(syncLabel)}</span>
      `)}

      <section class="summary-strip contracts-summary-strip">
        <div class="summary-card summary-card-total">
          <small>Active Vendors</small>
          <strong>${vendorRows.length}</strong>
          <span>Top vendors represented in current invoices</span>
        </div>
        <div class="summary-card summary-card-pending">
          <small>Queue Items</small>
          <strong>${queueRows.length}</strong>
          <span>Contracts needing review attention</span>
        </div>
        <div class="summary-card summary-card-sentback">
          <small>Validation Alerts</small>
          <strong>${validationAlerts.length}</strong>
          <span>Signals flagged during contract checks</span>
        </div>
      </section>

      <div class="page-grid">
        <div class="workspace">
          <section class="card">
            <div class="card-header">
              <div>
                <h2>Contract Coverage Matrix</h2>
                <p>Vendor totals, queue pressure, and review posture.</p>
              </div>
              <span class="status-chip pending-neutral">Top 6</span>
            </div>
            ${renderVendorTable(vendorRows)}
          </section>

          <section class="card page-snapshot-card">
            <div class="card-header">
              <div>
                <h2>Contract-Linked Invoices</h2>
                <p>Recent invoice records supporting contract review.</p>
              </div>
              <a class="button ghost" href="/invoices">Open invoices -></a>
            </div>
            ${renderInvoiceTable(contractLinkedInvoices)}
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header">
              <h2>Data Freshness</h2>
              <span class="status-chip ${syncStatus ? (syncLabel.toLowerCase().includes('healthy') ? 'approved' : 'warning') : 'pending-neutral'}">${escapeHtml(syncLabel)}</span>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Last Successful Sync</strong>
                  <small>${syncStatus ? escapeHtml(formatDateTime(syncStatus.lastSuccessfulRunUtc)) : 'Waiting for the first sync run'}</small>
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

          <section class="card">
            <div class="card-header">
              <h2>Guardrails</h2>
              <span class="status-chip approved">Policy</span>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>MSA rate caps</strong>
                  <small>Comparing billed rates with the contract ceiling</small>
                </div>
                <span class="status-chip warning">Active</span>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Tax validation</strong>
                  <small>Ensuring totals stay aligned with the tax profile</small>
                </div>
                <span class="status-chip approved">Active</span>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Insurance and W-9</strong>
                  <small>Vendor registration records are checked automatically</small>
                </div>
                <span class="status-chip approved">Active</span>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Duplicate invoice detection</strong>
                  <small>Matching invoice identifiers before approval</small>
                </div>
                <span class="status-chip warning">Active</span>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Validation Signals</h2>
              <span class="status-chip exception">${validationAlerts.length}</span>
            </div>
            <div class="alert-list">${renderAlertCards(validationAlerts.slice(0, 4))}</div>
          </section>
        </aside>
      </div>
    </section>
  `;
}
