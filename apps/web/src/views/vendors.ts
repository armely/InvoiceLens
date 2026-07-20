import {
  InvoiceSummaryDto,
  InvoiceStatusFilter,
  QueueRow,
  QueueSortFilter,
  SyncStatusDto,
  ValidationAlert,
  VendorBar,
} from '../shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader, renderVendorBars, routeHref, statusChip } from './shared.js';

interface VendorSummary {
  vendor: string;
  invoiceCount: number;
  totalAmount: number;
  queueCount: number;
  approvedCount: number;
  lastUpdated: string;
}

interface VendorInvoiceFilters {
  search: string;
  status: InvoiceStatusFilter;
  sort: QueueSortFilter;
  expandedCompanies: string[];
}

interface CompanyInvoiceGroup {
  company: string;
  invoices: InvoiceSummaryDto[];
  invoiceCount: number;
  vendorCount: number;
  totalAmount: number;
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

function renderVendorInvoiceFilters(filters: VendorInvoiceFilters, invoiceCount: number, companyCount: number): string {
  return `
    <div class="vendors-invoice-toolbar">
      <div class="vendors-invoice-toolbar-copy">
        <div>
          <strong>${companyCount} companies</strong>
          <small>${invoiceCount} invoices grouped by company</small>
        </div>
        <span class="status-chip pending-neutral">Grouped view</span>
      </div>
      <div class="vendors-invoice-filter-grid">
        <label class="filter-field vendors-invoice-filter vendors-invoice-search">
          <span class="field-label">Search</span>
          <input class="input-field" type="search" value="${escapeHtml(filters.search)}" data-filter="vendor-invoices-search" placeholder="Search company, vendor, invoice..." aria-label="Search company, vendor, or invoice" />
        </label>
        <label class="filter-field vendors-invoice-filter">
          <span class="field-label">Status</span>
          <select class="select-field" data-filter="vendor-invoices-status" aria-label="Filter vendor invoices by status">
            ${['All Statuses', 'Pending Review', 'Sent Back', 'Approved']
              .map(
                (option) => `
                  <option value="${option}" ${filters.status === option ? 'selected' : ''}>${option}</option>
                `,
              )
              .join('')}
          </select>
        </label>
        <label class="filter-field vendors-invoice-filter">
          <span class="field-label">Sort</span>
          <select class="select-field" data-filter="vendor-invoices-sort" aria-label="Sort vendor invoices">
            ${['Newest First', 'Oldest First', 'Highest Amount']
              .map(
                (option) => `
                  <option value="${option}" ${filters.sort === option ? 'selected' : ''}>${option}</option>
                `,
              )
              .join('')}
          </select>
        </label>
        <button class="button ghost vendors-invoice-reset" type="button" data-action="reset-vendor-invoice-filters">Reset</button>
      </div>
    </div>
  `;
}

function buildCompanyInvoiceGroups(invoices: InvoiceSummaryDto[]): CompanyInvoiceGroup[] {
  const groups = new Map<string, InvoiceSummaryDto[]>();

  invoices.forEach((invoice) => {
    const company = invoice.company.trim() || 'Unassigned company';
    const current = groups.get(company) ?? [];
    current.push(invoice);
    groups.set(company, current);
  });

  return [...groups.entries()]
    .map(([company, companyInvoices]) => {
      const lastUpdated = [...companyInvoices].sort((left, right) => right.updatedAtUtc.localeCompare(left.updatedAtUtc))[0]?.updatedAtUtc ?? '';
      return {
        company,
        invoices: companyInvoices,
        invoiceCount: companyInvoices.length,
        vendorCount: new Set(companyInvoices.map((invoice) => invoice.vendor)).size,
        totalAmount: companyInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
        approvedCount: companyInvoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length,
        lastUpdated,
      };
    })
    .sort((left, right) => right.totalAmount - left.totalAmount || left.company.localeCompare(right.company));
}

function renderCompanyInvoiceTable(group: CompanyInvoiceGroup): string {
  return `
    <table aria-label="${escapeHtml(group.company)} invoices">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Vendor</th>
          <th>AFE</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        ${group.invoices
          .map(
            (invoice) => `
              <tr>
                <td>
                  <div class="invoice-cell-stack">
                    <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
                    <small>${escapeHtml(group.company)}</small>
                  </div>
                </td>
                <td>${escapeHtml(invoice.vendor)}</td>
                <td>${escapeHtml(invoice.afe || 'Pending')}</td>
                <td>${formatCurrency(invoice.amount, invoice.currency || 'USD')}</td>
                <td>${statusChip(normalizeLabel(invoice.status) || 'Pending')}</td>
                <td>${escapeHtml(formatDateTime(invoice.updatedAtUtc))}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderCompanyInvoiceGroups(rows: InvoiceSummaryDto[], expandedCompanies: string[]): string {
  const groups = buildCompanyInvoiceGroups(rows);
  const openCompanies = new Set(expandedCompanies.map((value) => value.trim().toLowerCase()));

  if (groups.length === 0) {
    return '<div class="empty-state">No vendor invoices match the current filters.</div>';
  }

  return `
    <div class="vendors-company-list">
      ${groups
        .map((group) => {
          const isOpen = openCompanies.has(group.company.toLowerCase());
          return `
            <article class="vendor-company-group ${isOpen ? 'is-open' : ''}">
              <button class="vendor-company-toggle" type="button" data-action="toggle-vendor-company" data-company="${escapeHtml(group.company)}" aria-expanded="${String(isOpen)}">
                <div class="vendor-company-toggle-copy">
                  <strong>${escapeHtml(group.company)}</strong>
                  <small>${group.invoiceCount} invoices | ${group.vendorCount} vendors | ${group.lastUpdated ? `Updated ${escapeHtml(formatDateTime(group.lastUpdated))}` : 'Updated pending'}</small>
                </div>
                <div class="vendor-company-toggle-meta">
                  <span class="count-pill teal">${group.invoiceCount}</span>
                  <span class="vendor-company-total">${formatCurrency(group.totalAmount, 'USD')}</span>
                  <span class="vendor-company-chevron" aria-hidden="true">${isOpen ? '-' : '+'}</span>
                </div>
              </button>
              <div class="vendor-company-body ${isOpen ? 'is-open' : ''}" ${isOpen ? '' : 'hidden'}>
                ${renderCompanyInvoiceTable(group)}
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderCompactAlerts(alerts: ValidationAlert[]): string {
  if (alerts.length === 0) {
    return '<div class="empty-state">No alerts available.</div>';
  }

  return `
    <div class="vendors-alert-preview">
      ${alerts
        .map(
          (alert) => `
            <div class="vendors-alert-row">
              <div>
                <strong>${escapeHtml(alert.title)}</strong>
                <small>${escapeHtml(alert.message)}</small>
              </div>
              <span class="count-pill ${alert.className === 'amber' ? 'orange' : alert.className}">${alert.count}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderVendorsPage(
  invoices: InvoiceSummaryDto[],
  queueRows: QueueRow[],
  validationAlerts: ValidationAlert[],
  syncStatus: SyncStatusDto | null,
  vendorInvoiceFilters: VendorInvoiceFilters,
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
  const filteredVendorInvoices = applyInvoiceFilters(invoices, {
    search: vendorInvoiceFilters.search,
    status: vendorInvoiceFilters.status,
    sort: vendorInvoiceFilters.sort,
  });
  const companyCount = buildCompanyInvoiceGroups(filteredVendorInvoices).length;

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
          ${renderCompactAlerts(validationAlerts.slice(0, 2))}
          <a class="button ghost" href="${routeHref('notifications')}" data-route="notifications">Open alerts</a>
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
          <article class="card vendors-panel-card">
            <div class="card-header">
              <div>
                <h2>Vendor Scorecard</h2>
                <p>Spend, queue, and approval signals sorted by supplier value.</p>
              </div>
              <span class="status-chip pending-neutral">${vendorRows.length} vendors</span>
            </div>
            ${renderVendorTable(vendorRows)}
          </article>

          <article class="card vendors-panel-card">
            <div class="card-header">
              <div>
                <h2>Top Supplier Mix</h2>
                <p>Invoice volume distribution across active vendors.</p>
              </div>
              <span class="status-chip approved">Ranked</span>
            </div>
            ${renderVendorBars(vendorBars)}
          </article>

          <section class="card vendors-panel-card">
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
            <p>Recent invoices grouped by company with collapsible sections and filters.</p>
          </div>
          <a class="button ghost" href="/invoices">Open invoices -></a>
        </div>
        ${renderVendorInvoiceFilters(vendorInvoiceFilters, filteredVendorInvoices.length, companyCount)}
        ${renderCompanyInvoiceGroups(filteredVendorInvoices, vendorInvoiceFilters.expandedCompanies)}
      </section>
    </section>
  `;
}
