import { DashboardViewData } from '../shared/models.js';
import { metricCards, pageHeader, renderAlertCards, renderInvoiceTable, renderQueueSummary, renderVendorBars, routeHref } from './shared.js';

export function renderDashboard(data: DashboardViewData): string {
  const rows = data.filteredInvoices;

  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Dashboard', 'Live invoice activity, queue pressure, and validation signals from SQL-backed records.', `
            <button class="button" type="button" data-action="reset-dashboard-filters">Clear Filters</button>
          `)}

          ${metricCards(data.metrics)}

          <section class="card dashboard-filters">
            <div class="card-header">
              <div>
                <h2>Dashboard Filters</h2>
                <p>Search the recent activity table and narrow it by date.</p>
              </div>
              <span class="status-chip pending-neutral">${rows.length} shown of ${data.recentInvoices.length}</span>
            </div>
            <div class="dashboard-filter-grid">
              <div class="filter-field dashboard-search-field">
                <span class="field-label">Search</span>
                <div class="search-input-wrap">
                  <span aria-hidden="true" class="search-glyph">
                    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5"></circle>
                      <path d="M16.2 16.2 20 20"></path>
                    </svg>
                  </span>
                  <input class="search-input" type="search" value="${data.search}" data-input="page-search" placeholder="Search invoice number, vendor, company, AFE, or amount..." />
                </div>
              </div>
              <div class="dashboard-date-group">
                <label class="field-label" for="dashboardDateRange">Date range</label>
                <div class="date-range-controls dashboard-date-controls">
                  <select id="dashboardDateRange" class="select-field" aria-label="Date range" data-filter="dashboard-date-range">
                    ${['Last 30 Days', 'This Week', 'This Quarter']
                      .map((option) => `<option value="${option}" ${data.dashboardDateRange === option ? 'selected' : ''}>${option}</option>`)
                      .join('')}
                  </select>
                  <input class="input-field" type="date" value="${data.dashboardDateFrom}" data-filter="dashboard-date-from" aria-label="Dashboard from date" />
                  <input class="input-field" type="date" value="${data.dashboardDateTo}" data-filter="dashboard-date-to" aria-label="Dashboard to date" />
                </div>
              </div>
            </div>
          </section>

          <section class="content-row">
            <article class="card">
              <div class="card-header">
                <h2>Recent Invoice Activity</h2>
                <span class="status-chip pending-neutral">${rows.length} shown</span>
              </div>
              ${renderInvoiceTable(rows.slice(0, 5))}
              <a class="button ghost card-link" href="${routeHref('invoices')}" data-route="invoices">View all invoices -></a>
            </article>
            <article class="card">
              <div class="card-header">
                <h2>Queue Snapshot</h2>
              </div>
              ${renderQueueSummary(data.queueSummary)}
              <div style="height: 18px"></div>
              ${renderVendorBars(data.vendorBars)}
            </article>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header">
              <h2>Validation Signals</h2>
            </div>
            <div class="alert-list">${renderAlertCards(data.validationAlerts)}</div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Top Vendors by Queue Activity</h2><span class="status-chip pending-neutral">Live</span></div>
            ${renderVendorBars(data.vendorBars)}
          </section>
        </aside>
      </div>
    </section>
  `;
}
