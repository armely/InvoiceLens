const state = {
  route: 'dashboard',
  selectedInvoiceId: 'INV-250511-0012',
  search: '',
  queueFilter: 'all'
};

const invoices = [
  {
    id: 'INV-250511-0012',
    vendor: 'BluePeak Services LLC',
    afe: 'AFE-10457',
    company: 'Armely Energy Partners',
    costCenter: '5040 - Field Ops',
    invoiceDate: 'May 11, 2025',
    dueDate: 'Jun 10, 2025',
    amount: 125430,
    amountText: 'USD 125,430.00',
    currency: 'USD',
    status: 'Pending Review',
    statusClass: 'pending',
    queueStatus: 'Needs Review',
    reviewer: 'Michael Chen',
    updated: '1h ago',
    confidence: 88,
    exceptionType: 'Vendor Mismatch',
    service: 'Drilling Services - Contract Labor',
    lineRate: 5816.67,
    capRate: 5250,
    variance: 566.67,
    varianceImpact: 8500.05
  },
  {
    id: 'INV-250511-0009',
    vendor: 'NorthWind Drilling',
    afe: 'AFE-10321',
    company: 'Armely Energy Partners',
    costCenter: '5010 - Drilling Ops',
    invoiceDate: 'May 11, 2025',
    dueDate: 'Jun 10, 2025',
    amount: 98750,
    amountText: 'USD 98,750.00',
    currency: 'USD',
    status: 'Exception',
    statusClass: 'exception',
    queueStatus: 'Needs Review',
    reviewer: 'Priya Nair',
    updated: '2h ago',
    confidence: 82,
    exceptionType: 'Vendor Mismatch',
    service: 'Rig Day Rate - Casing Operations',
    lineRate: 8250,
    capRate: 7200,
    variance: 1050,
    varianceImpact: 1050
  },
  {
    id: 'INV-250510-0045',
    vendor: 'Summit Logistics',
    afe: 'AFE-10502',
    company: 'Armely Energy Partners',
    costCenter: '5090 - Logistics',
    invoiceDate: 'May 10, 2025',
    dueDate: 'Jun 9, 2025',
    amount: 32110,
    amountText: 'USD 32,110.00',
    currency: 'USD',
    status: 'Pending Review',
    statusClass: 'pending',
    queueStatus: 'Awaiting Approval',
    reviewer: 'James Walker',
    updated: '3h ago',
    confidence: 94,
    exceptionType: 'None',
    service: 'Equipment Transport',
    lineRate: 32110,
    capRate: 32110,
    variance: 0,
    varianceImpact: 0
  },
  {
    id: 'INV-250510-0033',
    vendor: 'Velocity Rentals',
    afe: 'AFE-10288',
    company: 'Armely Energy Partners',
    costCenter: '5040 - Field Ops',
    invoiceDate: 'May 10, 2025',
    dueDate: 'Jun 9, 2025',
    amount: 17890,
    amountText: 'USD 17,890.00',
    currency: 'USD',
    status: 'Awaiting AFE',
    statusClass: 'afe',
    queueStatus: 'Awaiting AFE',
    reviewer: 'Lauren Mitchell',
    updated: '4h ago',
    confidence: 71,
    exceptionType: 'Missing AFE',
    service: 'Rental - BOP Equipment',
    lineRate: 1121.43,
    capRate: 1035,
    variance: 86.43,
    varianceImpact: 605.01
  },
  {
    id: 'INV-250509-0077',
    vendor: 'Global Fuel Supply',
    afe: 'AFE-10376',
    company: 'Armely Energy Partners',
    costCenter: '5100 - Fuel',
    invoiceDate: 'May 9, 2025',
    dueDate: 'Jun 8, 2025',
    amount: 63540,
    amountText: 'USD 63,540.00',
    currency: 'USD',
    status: 'Approved',
    statusClass: 'approved',
    queueStatus: 'Approved',
    reviewer: 'Daniel Ruiz',
    updated: '5h ago',
    confidence: 97,
    exceptionType: 'None',
    service: 'Fuel Supply',
    lineRate: 2135,
    capRate: 2135,
    variance: 0,
    varianceImpact: 0
  },
  {
    id: 'INV-250509-0061',
    vendor: 'Velocity Rentals',
    afe: 'AFE-10288',
    company: 'Armely Energy Partners',
    costCenter: '5040 - Field Ops',
    invoiceDate: 'May 9, 2025',
    dueDate: 'Jun 8, 2025',
    amount: 12450,
    amountText: 'EUR 12,450.00',
    currency: 'EUR',
    status: 'Exception',
    statusClass: 'exception',
    queueStatus: 'Vendor On Hold',
    reviewer: 'Priya Nair',
    updated: '6h ago',
    confidence: 76,
    exceptionType: 'Currency Variance',
    service: 'Water Hauling',
    lineRate: 735,
    capRate: 690,
    variance: 45,
    varianceImpact: 225
  }
];

const queueSummary = [
  { label: 'Needs Review', count: 312, className: 'orange' },
  { label: 'Awaiting AFE', count: 118, className: 'blue' },
  { label: 'Awaiting Approval', count: 86, className: 'purple' },
  { label: 'Vendor On Hold', count: 24, className: 'red' },
  { label: 'Info Requested', count: 42, className: 'teal' }
];

const validationAlerts = [
  { title: 'Vendor Mismatch', count: 18, className: 'red', message: 'Vendor on invoice does not match approved vendor master.', invoiceNo: 'INV-250511-0009', amount: 'USD 98,750.00' },
  { title: 'Missing AFE', count: 11, className: 'amber', message: 'No AFE found for invoice line items.', invoiceNo: 'INV-250510-0033', amount: 'USD 17,890.00' },
  { title: 'Cost Center Check', count: 14, className: 'blue', message: 'Cost center is invalid or inactive.', invoiceNo: 'INV-250510-0022', amount: 'USD 26,340.00' },
  { title: 'Currency Variance', count: 9, className: 'teal', message: 'Invoice currency does not match PO or AFE currency.', invoiceNo: 'INV-250509-0061', amount: 'EUR 12,450.00' }
];

const validationChecks = [
  { label: 'Vendor Match', value: 'Approved vendor master', passed: true },
  { label: 'AFE Match', value: 'AFE exists and is active', passed: true },
  { label: 'Cost Center', value: 'Valid operational cost center', passed: true },
  { label: 'Currency', value: 'Expected invoice currency', passed: true },
  { label: 'MSA Rate', value: 'Rate cap variance check', passed: false }
];

const pageHost = document.getElementById('pageHost');
const appShell = document.querySelector('.app-shell');
const globalSearch = document.getElementById('globalSearch');
const toast = document.getElementById('toast');
let toastTimer;

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function initials(name) {
  return name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
}

function getSelectedInvoice() {
  return invoices.find(invoice => invoice.id === state.selectedInvoiceId) || invoices[0];
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function navigate(route) {
  state.route = route;
  document.querySelectorAll('[data-route]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-route') === route);
  });
  render();
  pageHost.focus({ preventScroll: true });
}

function setSelectedInvoice(id, route = 'invoice-review') {
  state.selectedInvoiceId = id;
  navigate(route);
}

function filteredInvoices() {
  const term = state.search.trim().toLowerCase();
  if (!term) return invoices;
  return invoices.filter(invoice => [
    invoice.id,
    invoice.vendor,
    invoice.afe,
    invoice.company,
    invoice.costCenter,
    invoice.invoiceDate,
    invoice.amountText,
    invoice.status,
    invoice.queueStatus
  ].some(value => String(value).toLowerCase().includes(term)));
}

function syncGlobalSearchInput() {
  if (globalSearch && globalSearch.value !== state.search) {
    globalSearch.value = state.search;
  }
}

function syncActivePageSearchInput() {
  const pageSearch = pageHost.querySelector('[data-input="page-search"]');
  if (pageSearch instanceof HTMLInputElement && pageSearch.value !== state.search) {
    pageSearch.value = state.search;
  }
}

function statusChip(status, className) {
  return `<span class="status-chip ${className}">${status}</span>`;
}

function pageHeader(title, subtitle, actions = '') {
  return `
    <section class="page-header">
      <div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="header-actions">${actions}</div>
    </section>
  `;
}

function renderQueueSummary() {
  return `<div class="queue-summary">${queueSummary.map(item => `
    <div class="queue-row">
      <span>${item.label}</span>
      <span class="count-pill ${item.className}">${item.count}</span>
    </div>
  `).join('')}</div>`;
}

function renderAlertCards() {
  return validationAlerts.map(alert => `
    <article class="alert-card">
      <header>
        <span class="alert-title"><span class="alert-icon ${alert.className}">!</span>${alert.title}</span>
        <span class="count-pill ${alert.className === 'amber' ? 'orange' : alert.className}">${alert.count}</span>
      </header>
      <p>${alert.message}</p>
      <div class="alert-meta">
        <span>Example: <a href="#" data-invoice-id="${alert.invoiceNo}" data-route="invoice-review">${alert.invoiceNo}</a></span>
        <span>Amount: ${alert.amount}</span>
      </div>
    </article>
  `).join('');
}

function renderDashboard() {
  const rows = filteredInvoices();
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Dashboard', 'Overview of invoice compliance and operational review.', `
            <select class="select-field" aria-label="Date range">
              <option>May 5 - May 11, 2025</option>
              <option>Last 30 Days</option>
              <option>This Quarter</option>
            </select>
          `)}

          <section class="kpi-grid" aria-label="Dashboard metrics">
            <article class="metric-card"><span class="metric-icon blue">▤</span><div><p>Total Invoices</p><strong>1,248</strong><small>↑ 12.4% <span>vs Apr 28 - May 4</span></small></div></article>
            <article class="metric-card"><span class="metric-icon amber">◷</span><div><p>Pending Review</p><strong>312</strong><small>↑ 8.7% <span>vs Apr 28 - May 4</span></small></div></article>
            <article class="metric-card"><span class="metric-icon red">△</span><div><p>Exceptions</p><strong>64</strong><small>↑ 15.3% <span>vs Apr 28 - May 4</span></small></div></article>
            <article class="metric-card"><span class="metric-icon green">✓</span><div><p>Approved Today</p><strong>178</strong><small>↑ 21.6% <span>vs Apr 28 - May 4</span></small></div></article>
          </section>

          <section class="filter-bar">
            <div class="search-input-wrap">
              <span class="search-glyph">⌕</span>
              <input class="search-input" type="search" value="${state.search}" data-input="page-search" placeholder="Search invoices by number, vendor, AFE, or keywords..." />
            </div>
            <button class="button" type="button" data-action="clear-search">Clear</button>
          </section>

          <section class="content-row">
            <article class="card">
              <div class="card-header"><h2>Invoice Volume Trend</h2><select class="select-field"><option>Weekly</option><option>Monthly</option></select></div>
              <div class="chart-wrap">
                <svg viewBox="0 0 720 300" role="img" aria-label="Invoice volume trend chart">
                  <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2f7df6" stop-opacity="0.22"/><stop offset="100%" stop-color="#2f7df6" stop-opacity="0"/></linearGradient></defs>
                  <g class="grid-lines"><line x1="56" y1="40" x2="690" y2="40"/><line x1="56" y1="88" x2="690" y2="88"/><line x1="56" y1="136" x2="690" y2="136"/><line x1="56" y1="184" x2="690" y2="184"/><line x1="56" y1="232" x2="690" y2="232"/></g>
                  <path class="chart-area" d="M72 218 L190 176 L308 148 L426 112 L544 82 L662 56 L662 250 L72 250 Z"/><polyline class="chart-line" points="72,218 190,176 308,148 426,112 544,82 662,56"/>
                  <g class="chart-points"><circle cx="72" cy="218" r="6"/><circle cx="190" cy="176" r="6"/><circle cx="308" cy="148" r="6"/><circle cx="426" cy="112" r="6"/><circle cx="544" cy="82" r="6"/><circle cx="662" cy="56" r="6"/></g>
                  <g class="axis-text y-axis"><text x="16" y="45">1,500</text><text x="24" y="93">1,250</text><text x="24" y="141">1,000</text><text x="30" y="189">750</text><text x="30" y="237">500</text></g>
                  <g class="axis-text x-axis"><text x="44" y="282">Apr 14-20</text><text x="160" y="282">Apr 21-27</text><text x="285" y="282">Apr 28-May 4</text><text class="active-axis" x="418" y="282">May 5-11</text><text x="535" y="282">May 12-18</text></g>
                </svg>
              </div>
            </article>
            <article class="card">
              <div class="card-header"><h2>Compliance Queue</h2></div>
              ${renderQueueSummary()}
              <button class="button ghost card-link" type="button" data-route="compliance-queue">View full queue →</button>
            </article>
          </section>

          <section class="card">
            <div class="card-header"><h2>Recent Invoice Activity</h2></div>
            <div id="dashboardRecentActivityTable">${renderInvoiceTable(rows.slice(0, 5))}</div>
            <button class="button ghost card-link" type="button" data-route="invoices">View all invoices →</button>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header"><h2>Insights & Alerts</h2><button class="button ghost" type="button" data-route="validation-summary">View all →</button></div>
            <div class="card-header"><h2>Validation Alerts <span class="count-pill red">64</span></h2></div>
            <div class="alert-list">${renderAlertCards()}</div>
          </section>
          <section class="card">
            <div class="card-header"><h2>Top Vendors by Exceptions</h2><span class="status-chip pending-neutral">This Week</span></div>
            ${renderVendorBars()}
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderInvoiceTable(rows) {
  if (!rows.length) return `<div class="empty-state">No invoices match the current search.</div>`;
  return `
    <div class="table-wrap">
      <table aria-label="Invoice results">
        <thead><tr><th>Invoice #</th><th>Vendor</th><th>AFE / Project</th><th>Invoice Date</th><th>Amount</th><th>Status</th><th>Reviewer</th><th>Updated</th></tr></thead>
        <tbody id="invoiceResultsRows">${renderInvoiceTableRows(rows)}</tbody>
      </table>
    </div>
  `;
}

function renderInvoiceTableRows(rows) {
  return rows.map(invoice => `
    <tr>
      <td><a href="#" class="invoice-link" data-invoice-id="${invoice.id}" data-route="invoice-review">${invoice.id}</a></td>
      <td>${invoice.vendor}</td>
      <td>${invoice.afe}</td>
      <td>${invoice.invoiceDate}</td>
      <td>${invoice.amountText}</td>
      <td>${statusChip(invoice.status, invoice.statusClass)}</td>
      <td><span class="reviewer"><span class="reviewer-avatar">${initials(invoice.reviewer)}</span>${invoice.reviewer}</span></td>
      <td>${invoice.updated}</td>
    </tr>
  `).join('');
}

function getInvoiceSearchStats(rows) {
  return {
    total: rows.length,
    pending: rows.filter(i => i.status === 'Pending Review').length,
    exceptions: rows.filter(i => i.status === 'Exception').length,
    approved: rows.filter(i => i.status === 'Approved').length
  };
}

function renderVendorBars() {
  const vendors = [
    { name: 'NorthWind Drilling', count: 9, width: 96, color: 'red' },
    { name: 'BluePeak Services LLC', count: 7, width: 74, color: 'orange' },
    { name: 'Summit Logistics', count: 5, width: 58, color: '' },
    { name: 'Global Fuel Supply', count: 4, width: 42, color: 'teal' },
    { name: 'Velocity Rentals', count: 3, width: 34, color: 'green' }
  ];
  return `<div class="vendor-bars">${vendors.map(vendor => `
    <div class="vendor-bar-row">
      <span>${vendor.name}</span><span class="bar-track"><span class="bar-fill ${vendor.color}" style="width:${vendor.width}%"></span></span><strong>${vendor.count}</strong>
    </div>
  `).join('')}</div>`;
}

function renderInvoicesPage() {
  const rows = filteredInvoices();
  const stats = getInvoiceSearchStats(rows);
  return `
    <section class="page active invoices-layout">
      ${pageHeader('Invoices', 'Search invoice metadata by invoice ID, invoice number, vendor, AFE, company, and cost center.', `
        <button class="button" type="button" data-action="clear-search">Clear Filters</button>
      `)}
      <section class="summary-strip" aria-label="Invoice search summary">
        <div class="summary-card"><small>Total Results</small><strong id="invoiceTotalResults">${stats.total}</strong></div>
        <div class="summary-card"><small>Pending Review</small><strong id="invoicePendingResults">${stats.pending}</strong></div>
        <div class="summary-card"><small>Exceptions</small><strong id="invoiceExceptionResults">${stats.exceptions}</strong></div>
        <div class="summary-card"><small>Approved</small><strong id="invoiceApprovedResults">${stats.approved}</strong></div>
      </section>
      <section class="filter-bar">
        <div class="search-input-wrap"><span class="search-glyph">⌕</span><input class="search-input" type="search" value="${state.search}" data-input="page-search" placeholder="Search invoice ID, vendor, AFE, company, cost center..." /></div>
        <div class="filter-fields">
          <select class="select-field"><option>Status: All</option><option>Pending Review</option><option>Exception</option><option>Approved</option></select>
          <select class="select-field"><option>Date: Last 30 Days</option><option>This Week</option><option>This Quarter</option></select>
        </div>
      </section>
      <section class="card" id="invoiceResultsCard">
        <div class="card-header"><h2>Invoice Results</h2><span class="status-chip pending-neutral" id="invoiceShownResults">${stats.total} shown</span></div>
        <div id="invoiceResultsTable">${renderInvoiceTable(rows)}</div>
      </section>
    </section>
  `;
}

function updateInvoiceSearchResults() {
  if (state.route !== 'invoices') {
    return;
  }

  const rows = filteredInvoices();
  const stats = getInvoiceSearchStats(rows);

  const totalResults = pageHost.querySelector('#invoiceTotalResults');
  const pendingResults = pageHost.querySelector('#invoicePendingResults');
  const exceptionResults = pageHost.querySelector('#invoiceExceptionResults');
  const approvedResults = pageHost.querySelector('#invoiceApprovedResults');
  const shownResults = pageHost.querySelector('#invoiceShownResults');
  const resultsTable = pageHost.querySelector('#invoiceResultsTable');
  const resultsRows = pageHost.querySelector('#invoiceResultsRows');

  if (totalResults) totalResults.textContent = String(stats.total);
  if (pendingResults) pendingResults.textContent = String(stats.pending);
  if (exceptionResults) exceptionResults.textContent = String(stats.exceptions);
  if (approvedResults) approvedResults.textContent = String(stats.approved);
  if (shownResults) shownResults.textContent = `${stats.total} shown`;
  if (resultsRows && rows.length) {
    resultsRows.innerHTML = renderInvoiceTableRows(rows);
  } else if (resultsTable) {
    resultsTable.innerHTML = renderInvoiceTable(rows);
  }

  syncGlobalSearchInput();
}

function updateDashboardSearchResults() {
  if (state.route !== 'dashboard') {
    return;
  }

  const rows = filteredInvoices();
  const dashboardTable = pageHost.querySelector('#dashboardRecentActivityTable');
  if (dashboardTable) {
    dashboardTable.innerHTML = renderInvoiceTable(rows.slice(0, 5));
  }

  syncGlobalSearchInput();
}

function updateQueueSearchResults() {
  if (state.route !== 'compliance-queue') {
    return;
  }

  const rows = filteredInvoices();
  const queueVisibleCount = pageHost.querySelector('#queueVisibleCount');
  const queueItemList = pageHost.querySelector('#queueItemList');

  if (queueVisibleCount) queueVisibleCount.textContent = `${rows.length} visible`;
  if (queueItemList) queueItemList.innerHTML = renderQueueItems(rows);

  syncGlobalSearchInput();
}

function refreshSearchResultsForCurrentRoute() {
  switch (state.route) {
    case 'dashboard':
      updateDashboardSearchResults();
      return;
    case 'invoices':
      updateInvoiceSearchResults();
      return;
    case 'compliance-queue':
      updateQueueSearchResults();
      return;
    default:
      return;
  }
}

function renderQueueItems(rows = invoices) {
  return rows.map(invoice => `
    <article class="queue-item ${invoice.id === state.selectedInvoiceId ? 'selected' : ''}" data-invoice-id="${invoice.id}" data-route="invoice-review">
      <div class="queue-item-top">
        <div class="queue-item-title"><strong>${invoice.id}</strong><small>${invoice.vendor}</small></div>
        <strong>${invoice.amountText}</strong>
      </div>
      <div class="queue-item-meta"><span>${invoice.afe}</span><span>${invoice.invoiceDate}</span><span>${invoice.confidence}% confidence</span></div>
      <div>${statusChip(invoice.queueStatus, invoice.statusClass === 'exception' ? 'exception' : invoice.statusClass)}</div>
    </article>
  `).join('');
}

function renderComplianceQueuePage() {
  const rows = filteredInvoices();
  return `
    <section class="page active">
      ${pageHeader('Compliance Queue', 'Review invoices that need action, validation, or approval.', `
        <select class="select-field"><option>Sort: Oldest First</option><option>Newest First</option><option>Highest Amount</option></select>
      `)}
      <section class="queue-page-grid">
        <div class="workspace">
          <section class="filter-bar">
            <div class="search-input-wrap"><span class="search-glyph">⌕</span><input class="search-input" type="search" value="${state.search}" data-input="page-search" placeholder="Search queue by invoice, vendor, AFE, or status..." /></div>
            <button class="button" type="button" data-action="clear-search">Clear</button>
          </section>
          <section class="card">
            <div class="card-header"><h2>Queue Items</h2><span class="status-chip pending-neutral" id="queueVisibleCount">${rows.length} visible</span></div>
            <div class="queue-page-list" id="queueItemList">${renderQueueItems(rows)}</div>
          </section>
        </div>
        <aside class="side-panel">
          <section class="card"><div class="card-header"><h2>Queue Summary</h2></div>${renderQueueSummary()}</section>
          <section class="card"><div class="card-header"><h2>Validation Alerts</h2></div><div class="alert-list">${renderAlertCards()}</div></section>
        </aside>
      </section>
    </section>
  `;
}

function renderInvoiceDocument(invoice) {
  return `
    <div class="invoice-document" aria-label="Invoice document preview">
      <div class="document-head">
        <div class="document-logo"><span class="rig-mark">⌂</span><div><strong>EDS</strong><span>Energy Drilling Services</span></div></div>
        <div class="document-title"><h2>INVOICE</h2><p>${invoice.id}</p></div>
      </div>
      <div class="document-meta">
        <div><h3>Bill To</h3><p>${invoice.company}<br />1234 Oilfield Drive<br />Houston, TX 77001</p></div>
        <div><h3>From</h3><p>${invoice.vendor}<br />5678 Rig Road<br />Midland, TX 79701</p></div>
      </div>
      <div class="document-fields">
        <div class="document-field"><small>AFE Number</small><strong>${invoice.afe}</strong></div>
        <div class="document-field"><small>Cost Center</small><strong>${invoice.costCenter}</strong></div>
        <div class="document-field"><small>Currency</small><strong>${invoice.currency}</strong></div>
      </div>
      <table class="document-table" aria-label="Invoice line item table">
        <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>${invoice.service}<br /><small>07/01/24 - 07/15/24</small></td><td>15</td><td>${formatCurrency(invoice.lineRate)}</td><td>${invoice.amountText}</td></tr>
        </tbody>
      </table>
      <div class="document-total">
        <div class="total-row"><span>Subtotal</span><strong>${invoice.amountText}</strong></div>
        <div class="total-row"><span>Total Due</span><strong>${invoice.amountText}</strong></div>
      </div>
    </div>
  `;
}

function renderValidationPanel(invoice) {
  const checksHtml = validationChecks.map(check => `
    <div class="validation-check">
      <div><strong>${check.label}</strong><small>${check.value}</small></div>
      <span class="check-pass">${check.passed ? '✓' : '!'}</span>
    </div>
  `).join('');
  return `
    <aside class="validation-panel">
      <div class="card-header"><div><h2>Validation Summary</h2><p>${invoice.confidence}% confidence score</p></div><span class="status-chip ${invoice.statusClass}">${invoice.status}</span></div>
      <div class="validation-list">${checksHtml}</div>
      <div class="variance-card">
        <div class="variance-head"><span>!</span><span>Rate Variance Detected</span></div>
        <div class="variance-body">
          <div class="variance-row"><span>Billed Rate</span><strong>${formatCurrency(invoice.lineRate)} / day</strong></div>
          <div class="variance-row"><span>MSA Rate Cap</span><strong>${formatCurrency(invoice.capRate)} / day</strong></div>
          <div class="variance-row"><span>Variance</span><strong>+${formatCurrency(invoice.variance)} / day</strong></div>
          <div class="variance-row"><span>Total Impact</span><strong>+${formatCurrency(invoice.varianceImpact)}</strong></div>
        </div>
      </div>
      <div class="action-stack">
        <button class="button success" type="button" data-action="approve-invoice">✓ Approve</button>
        <button class="button danger" type="button" data-action="send-back">↩ Send Back</button>
      </div>
    </aside>
  `;
}

function renderInvoiceReviewPage() {
  const invoice = getSelectedInvoice();
  return `
    <section class="page active">
      <div class="review-workspace">
        <aside class="review-column">
          <div class="card-header"><h2>Review Queue</h2><span class="count-pill blue">${invoices.length}</span></div>
          <div class="queue-page-list">${renderQueueItems(invoices)}</div>
        </aside>
        <section class="viewer-panel">
          <div class="viewer-toolbar">
            <div><strong>Invoice Viewer</strong><p style="margin:4px 0 0;color:var(--muted);font-size:13px;">${invoice.vendor} • ${invoice.id}</p></div>
            <div class="viewer-tools"><button class="tool-button">‹</button><span>1 of 1</span><button class="tool-button">›</button><button class="tool-button">−</button><span class="status-chip pending-neutral">100%</span><button class="tool-button">+</button></div>
          </div>
          ${renderInvoiceDocument(invoice)}
          <div class="viewer-actions"><button class="button primary" type="button" data-action="download-pdf">↓ Download PDF</button><button class="button" type="button" data-action="open-portal">↗ Open in Portal</button></div>
        </section>
        ${renderValidationPanel(invoice)}
      </div>
    </section>
  `;
}

function renderValidationSummaryPage() {
  const invoice = getSelectedInvoice();
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Validation Summary', 'Review validation checks, variance cards, and audit-ready exception details.', `
            <button class="button primary" type="button" data-route="invoice-review">Open Review Page</button>
          `)}
          <section class="summary-strip">
            <div class="summary-card"><small>Checks Passed</small><strong>4 / 5</strong></div>
            <div class="summary-card"><small>Confidence</small><strong>${invoice.confidence}%</strong></div>
            <div class="summary-card"><small>Exceptions</small><strong>${validationAlerts.length}</strong></div>
            <div class="summary-card"><small>Selected Invoice</small><strong>${invoice.id}</strong></div>
          </section>
          <section class="card"><div class="card-header"><h2>Validation Checklist</h2></div><div class="validation-list">${validationChecks.map(check => `
            <div class="validation-check"><div><strong>${check.label}</strong><small>${check.value}</small></div><span class="check-pass">${check.passed ? '✓' : '!'}</span></div>`).join('')}</div></section>
          <section class="card"><div class="card-header"><h2>Validation Alerts</h2></div><div class="alert-list">${renderAlertCards()}</div></section>
        </div>
        <aside class="side-panel">${renderValidationPanel(invoice)}</aside>
      </div>
    </section>
  `;
}

function renderAdminPage() {
  return `
    <section class="page active">
      ${pageHeader('Admin Settings', 'Manage mappings, sync visibility, and reference settings for the workspace.', `
        <button class="button primary" type="button" data-action="save-settings">Save Settings</button>
      `)}
      <section class="settings-grid">
        <article class="card">
          <div class="card-header"><h2>Reference Data</h2><p>Mappings used by invoice validation.</p></div>
          <div class="settings-list">
            <div class="settings-row"><div><strong>Vendor Mapping</strong><small>Approved vendor master matching</small></div><button class="switch active" type="button" data-action="toggle-switch" aria-label="Toggle vendor mapping"></button></div>
            <div class="settings-row"><div><strong>AFE Mapping</strong><small>AFE and project validation</small></div><button class="switch active" type="button" data-action="toggle-switch" aria-label="Toggle AFE mapping"></button></div>
            <div class="settings-row"><div><strong>Cost Center Mapping</strong><small>Operational cost center checks</small></div><button class="switch active" type="button" data-action="toggle-switch" aria-label="Toggle cost center mapping"></button></div>
          </div>
        </article>
        <article class="card">
          <div class="card-header"><h2>Sync Status</h2><p>Operational sync visibility only.</p></div>
          <div class="settings-list">
            <div class="settings-row"><div><strong>Last Successful Sync</strong><small>Today, 6:00 AM</small></div><span class="status-chip approved">Healthy</span></div>
            <div class="settings-row"><div><strong>OpenInvoice Metadata Sync</strong><small>Invoice list and detail refresh</small></div><span class="status-chip pending-neutral">Hourly</span></div>
            <div class="settings-row"><div><strong>Document Streaming</strong><small>PDF fetched only on user action</small></div><span class="status-chip approved">On Demand</span></div>
          </div>
        </article>
        <article class="card">
          <div class="card-header"><h2>User Roles</h2><p>Role visibility for the application.</p></div>
          <div class="settings-list">
            <div class="settings-row"><div><strong>Viewer</strong><small>Search and view invoices</small></div><span class="status-chip pending-neutral">Read</span></div>
            <div class="settings-row"><div><strong>Reviewer</strong><small>Run validations and add notes</small></div><span class="status-chip afe">Review</span></div>
            <div class="settings-row"><div><strong>Approver</strong><small>Approve or send back invoices</small></div><span class="status-chip approved">Approve</span></div>
          </div>
        </article>
        <article class="card">
          <div class="card-header"><h2>MSA Contracts</h2><p>Rate cap checks used by validation.</p></div>
          <div class="settings-list">
            <div class="settings-row"><div><strong>Rate Cap Validation</strong><small>Compare billing rate against agreement cap</small></div><button class="switch active" type="button" data-action="toggle-switch" aria-label="Toggle MSA validation"></button></div>
            <div class="settings-row"><div><strong>Variance Audit Entries</strong><small>Write permanent exception records</small></div><button class="switch active" type="button" data-action="toggle-switch" aria-label="Toggle audit entries"></button></div>
          </div>
        </article>
      </section>
    </section>
  `;
}

function render() {
  const routeMap = {
    dashboard: renderDashboard,
    invoices: renderInvoicesPage,
    'compliance-queue': renderComplianceQueuePage,
    'invoice-review': renderInvoiceReviewPage,
    'validation-summary': renderValidationSummaryPage,
    admin: renderAdminPage
  };
  pageHost.innerHTML = (routeMap[state.route] || renderDashboard)();
  document.querySelectorAll('[data-count="queue"]').forEach(item => item.textContent = invoices.filter(i => i.status !== 'Approved').length);
  if (globalSearch) globalSearch.value = state.search;
}

function clearSearch() {
  state.search = '';
  syncGlobalSearchInput();
  syncActivePageSearchInput();
  refreshSearchResultsForCurrentRoute();
}

document.addEventListener('click', event => {
  const invoiceLink = event.target.closest('[data-invoice-id]');
  if (invoiceLink) {
    event.preventDefault();
    setSelectedInvoice(invoiceLink.getAttribute('data-invoice-id'), invoiceLink.getAttribute('data-route') || 'invoice-review');
    return;
  }

  const routeElement = event.target.closest('[data-route]');
  if (routeElement) {
    event.preventDefault();
    navigate(routeElement.getAttribute('data-route'));
    return;
  }

  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.getAttribute('data-action');

  if (action === 'toggle-sidebar') {
    const current = appShell.getAttribute('data-sidebar');
    appShell.setAttribute('data-sidebar', current === 'collapsed' ? 'expanded' : 'collapsed');
  }
  if (action === 'clear-search') clearSearch();
  if (action === 'download-pdf') showToast('PDF download action triggered.');
  if (action === 'open-portal') showToast('OpenInvoice portal action triggered.');
  if (action === 'approve-invoice') showToast('Invoice approved and audit entry created.');
  if (action === 'send-back') showToast('Invoice sent back for review.');
  if (action === 'save-settings') showToast('Settings saved.');
  if (action === 'toggle-switch') actionElement.classList.toggle('active');
});

document.addEventListener('input', event => {
  if (event.target.matches('[data-input="page-search"]')) {
    state.search = event.target.value;
    syncGlobalSearchInput();
    refreshSearchResultsForCurrentRoute();
    return;
  }
});

globalSearch.addEventListener('input', event => {
  state.search = event.target.value;
  syncGlobalSearchInput();
  syncActivePageSearchInput();
  refreshSearchResultsForCurrentRoute();
});

globalSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    navigate('invoices');
  }
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    globalSearch.focus();
  }
});

render();
