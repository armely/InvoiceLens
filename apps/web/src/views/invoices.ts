import { InvoiceDetailDto, InvoicePanelTab, InvoiceSummaryDto, ReviewViewData } from '../shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDate, formatDateTime, invoiceStatusTone, normalizeLabel } from '../shared/utils.js';
import { routeHref } from './shared.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
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

function statusPillClass(status: string): string {
  const normalized = normalizeLabel(status).toLowerCase();

  if (normalized.includes('approved')) {
    return 'approved';
  }

  if (normalized.includes('sent') || normalized.includes('exception')) {
    return 'exception';
  }

  return 'pending';
}

function queueBadgeClass(label: string): string {
  const normalized = label.toLowerCase();

  if (normalized.includes('approved') || normalized.includes('matched')) {
    return 'green';
  }

  if (normalized.includes('review')) {
    return 'blue';
  }

  return 'orange';
}

function renderInvoiceQueueItem(invoice: InvoiceSummaryDto, selectedInvoiceId: string, reviewData: ReviewViewData): string {
  const tone = invoiceStatusTone(invoice.status);
  const isSelected = invoice.invoiceId === selectedInvoiceId;
  const queueRow = reviewData.queueRows.find((row) => row.invoiceId === invoice.invoiceId) ?? null;
  const badgeLabel = queueRow?.reason ?? normalizeLabel(invoice.status);
  const confidenceText = `Conf: ${tone === 'approved' ? '95%' : tone === 'exception' ? '68%' : '82%'}`;
  const dotClass = tone === 'approved' ? 'good' : tone === 'exception' ? 'warn' : 'good';

  return `
    <a href="${routeHref('invoices', invoice.invoiceId)}" class="invoice-card ${isSelected ? 'active' : ''}" data-invoice-id="${invoice.invoiceId}">
      <div class="check" aria-hidden="true"></div>
      <div class="invoice-main">
        <h3>${escapeHtml(invoice.invoiceNumber)} <span class="queue-title-dot ${dotClass}" aria-hidden="true">&#9679;</span> <span class="queue-title-detail">${escapeHtml(badgeLabel)}</span></h3>
        <div class="meta">
          <span class="queue-vendor">${escapeHtml(invoice.vendor)}</span>
          <span class="meta-date"><span class="meta-cal" aria-hidden="true"></span>${escapeHtml(formatDate(invoice.createdAtUtc))}</span>
          <span>Ref: ${escapeHtml(invoice.afe)}</span>
        </div>
        <div class="queue-badge-row">
          <span class="badge ${queueBadgeClass(badgeLabel)}">${escapeHtml(badgeLabel)}</span>
          <span class="confidence">${escapeHtml(confidenceText)}</span>
        </div>
      </div>
      <div class="amount">${formatCurrency(invoice.amount, invoice.currency)}</div>
      <div class="status-icon ${tone === 'approved' ? 'good' : 'warn'}" aria-hidden="true">${tone === 'approved' ? '&#10003;' : '&#9650;'}</div>
    </a>
  `;
}

function renderSummaryListRow(label: string, value: string): string {
  return `
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>
  `;
}

function renderInvoiceDocument(invoice: InvoiceDetailDto | null, fallbackInvoice: InvoiceSummaryDto | null, snapshotUrl: string | null = null): string {
  if (!invoice && !fallbackInvoice) {
    return '<div class="empty-state">No invoice selected.</div>';
  }

  const number = invoice?.invoiceNumber ?? fallbackInvoice?.invoiceNumber ?? 'Pending';
  const vendor = invoice?.vendor ?? fallbackInvoice?.vendor ?? 'Pending';
  const status = normalizeLabel(invoice?.status ?? fallbackInvoice?.status ?? 'Pending Review');
  const currency = invoice?.currency ?? fallbackInvoice?.currency ?? 'USD';
  const invoiceDate = invoice?.invoiceDateUtc ? formatDate(invoice.invoiceDateUtc) : formatDate(fallbackInvoice?.createdAtUtc ?? '');
  const dueDate = invoice?.dueDateUtc ? formatDate(invoice.dueDateUtc) : 'Pending';
  const updatedAt = invoice?.updatedAtUtc ? formatDateTime(invoice.updatedAtUtc) : formatDateTime(fallbackInvoice?.updatedAtUtc ?? '');
  const lineItems = invoice?.lineItems ?? [];
  const subtotal = invoice?.totals?.subtotal ?? fallbackInvoice?.amount ?? 0;
  const tax = invoice?.totals?.tax ?? 0;
  const total = invoice?.totals?.total ?? fallbackInvoice?.amount ?? 0;
  const serviceLocation = invoice ? `${invoice.billTo.city}, ${invoice.billTo.region}`.trim().replace(/^,|,$/g, '') : 'Pending';
  const headline = 'IL';
  const remitTo = [invoice?.vendorContact.name, invoice?.vendorContact.addressLine1, invoice?.vendorContact.addressLine2, `${invoice?.vendorContact.city ?? ''}, ${invoice?.vendorContact.region ?? ''} ${invoice?.vendorContact.postalCode ?? ''}`.trim()]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => escapeHtml(line))
    .join('<br />');
  const contactBlock = [invoice?.vendorContact.email, invoice?.vendorContact.phone].filter((line): line is string => Boolean(line && line.trim())).map((line) => escapeHtml(line)).join('<br />');

  const paperHtml = `
    <div class="invoice-paper">
      <div class="invoice-top">
        <div class="vendor-brand">
          <div class="logo-mark">${escapeHtml(headline)}</div>
        </div>

        <div class="invoice-title">INVOICE</div>
      </div>

      <div class="invoice-info">
        <div class="bill-to">
          <h4>Bill To:</h4>
          <p>
            ${escapeHtml(invoice?.billTo.name ?? 'Pending')}<br>
            ${escapeHtml(invoice?.billTo.addressLine1 ?? '')}${invoice?.billTo.addressLine2 ? `<br>${escapeHtml(invoice.billTo.addressLine2)}` : ''}<br>
            ${escapeHtml(`${invoice?.billTo.city ?? ''}, ${invoice?.billTo.region ?? ''} ${invoice?.billTo.postalCode ?? ''}`.trim())}
          </p>
        </div>

        <div class="details-table">
          <strong>Invoice #</strong><span>${escapeHtml(number)}</span>
          <strong>Invoice Date</strong><span>${escapeHtml(invoiceDate)}</span>
          <strong>Due Date</strong><span>${escapeHtml(dueDate)}</span>
          <strong>Status</strong><span>${escapeHtml(status)}</span>
          <strong>Service Location</strong><span>${escapeHtml(serviceLocation || 'Pending')}</span>
          <strong>Updated</strong><span>${escapeHtml(updatedAt)}</span>
        </div>
      </div>

      <div class="invoice-line"></div>

      <div class="invoice-table-wrap">
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Service Dates</th>
              <th>Qty</th>
              <th>UOM</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              lineItems.length
                ? lineItems
                    .map(
                      (line) => `
                        <tr>
                          <td>${escapeHtml(line.description ?? 'Line item')}</td>
                          <td>${escapeHtml(invoiceDate)}</td>
                          <td>${line.quantity.toFixed(2)}</td>
                          <td>--</td>
                          <td>${formatCurrency(line.unitPrice, currency)}</td>
                          <td>${formatCurrency(line.amount, currency)}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="6">No line items available.</td></tr>'
            }
          </tbody>
        </table>
      </div>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal, currency)}</span>
        </div>
        <div class="totals-row">
          <span>Tax</span>
          <span>${formatCurrency(tax, currency)}</span>
        </div>
        <div class="totals-row total">
          <span>Total Due ${escapeHtml(currency)}</span>
          <span>${formatCurrency(total, currency)}</span>
        </div>
      </div>

      <div class="invoice-bottom">
        <div>
          <h4>Remit To:</h4>
          <p>${remitTo || 'Pending'}</p>
        </div>

        <div>
          <h4>Invoice Terms:</h4>
          <p>
            ${escapeHtml(invoice?.paymentTerms ?? 'Pending')}<br>
            Currency: ${escapeHtml(currency)}<br>
            Updated: ${escapeHtml(updatedAt)}
          </p>
        </div>

        <div>
          <h4>Contact:</h4>
          <p>${contactBlock || escapeHtml(invoice?.notes ?? 'No notes provided.')}</p>
        </div>
      </div>
    </div>
  `;

  if (!snapshotUrl) {
    return paperHtml;
  }

  return `
    <object class="invoice-pdf-frame" data="${escapeHtml(snapshotUrl)}#toolbar=0&navpanes=0&view=FitH" type="application/pdf" aria-label="Invoice PDF preview">
      ${paperHtml}
    </object>
  `;
}

function renderValidationRow(label: string, value: string, toneClass = 'pass'): string {
  return `
    <div class="validation-check">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(value)}</small>
      </div>
      <span class="check-pass ${toneClass}">${toneClass === 'pass' ? '&#10003;' : '!'}</span>
    </div>
  `;
}

function renderLineItemDetailRow(
  lineNumber: number,
  description: string,
  quantity: number,
  unitPrice: number,
  amount: number,
  currency: string,
): string {
  return `
    <div class="invoice-line-item invoice-line-item--detail">
      <div class="invoice-line-description">
        <span class="invoice-line-badge">${lineNumber}</span>
        <div>
          <strong>${escapeHtml(description)}</strong>
          <span>Line ${lineNumber}</span>
        </div>
      </div>
      <span>${quantity}</span>
      <span>${formatCurrency(unitPrice, currency)}</span>
      <strong>${formatCurrency(amount, currency)}</strong>
    </div>
  `;
}

export function renderInvoiceQueueItems(rows: InvoiceSummaryDto[], selectedInvoiceId: string, reviewData: ReviewViewData): string {
  if (rows.length === 0) {
    return '<div class="empty-state">No invoices match current filters.</div>';
  }

  return rows.map((invoice) => renderInvoiceQueueItem(invoice, selectedInvoiceId, reviewData)).join('');
}

export function renderInvoicesPage(
  invoices: InvoiceSummaryDto[],
  search: string,
  statusFilter: 'All Statuses' | 'Pending Review' | 'Sent Back' | 'Approved',
  dateRange: 'All Time' | 'Last 30 Days' | 'This Week' | 'This Quarter',
  dateFrom: string,
  dateTo: string,
  queueSort: 'Oldest First' | 'Newest First' | 'Highest Amount',
  selectedInvoiceId: string,
  reviewData: ReviewViewData,
  activeInvoicePanel: InvoicePanelTab,
): string {
  const rows = applyInvoiceFilters(invoices, {
    search,
    status: statusFilter,
    dateRange,
    dateFrom,
    dateTo,
    sort: queueSort,
  });

  const selectedInvoice = rows.find((invoice) => invoice.invoiceId === selectedInvoiceId) ?? rows[0] ?? null;
  const selectedReviewInvoice =
    reviewData.review && selectedInvoice && reviewData.review.invoice.invoiceId === selectedInvoice.invoiceId
      ? reviewData.review.invoice
      : null;
  const validationSummary =
    reviewData.validationSummary && selectedInvoice && reviewData.validationSummary.invoiceId === selectedInvoice.invoiceId
      ? reviewData.validationSummary
      : null;
  const checks = validationSummary?.checks ?? [];
  const passedChecks = checks.filter((check) => check.status.toLowerCase() === 'pass').length;
  const confidenceScore = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;
  const firstFailedCheck = checks.find((check) => check.status.toLowerCase() !== 'pass') ?? null;
  const selectedIndex = selectedInvoice ? rows.findIndex((invoice) => invoice.invoiceId === selectedInvoice.invoiceId) : -1;
  const selectedPosition = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const totalInvoices = rows.length;
  const invoiceCurrency = selectedReviewInvoice?.currency ?? selectedInvoice?.currency ?? 'USD';
  const lineItems = selectedReviewInvoice?.lineItems ?? [];
  const invoiceDate = selectedReviewInvoice?.invoiceDateUtc ? formatDate(selectedReviewInvoice.invoiceDateUtc) : selectedInvoice ? formatDate(selectedInvoice.createdAtUtc) : 'Pending';
  const updatedAt = selectedReviewInvoice?.updatedAtUtc ? formatDateTime(selectedReviewInvoice.updatedAtUtc) : selectedInvoice ? formatDateTime(selectedInvoice.updatedAtUtc) : 'Pending';
  const totalAmount = selectedReviewInvoice?.totals?.total ?? selectedInvoice?.amount ?? 0;
  const vendorName = selectedReviewInvoice?.vendor ?? selectedInvoice?.vendor ?? 'Pending';
  const invoiceNumber = selectedReviewInvoice?.invoiceNumber ?? selectedInvoice?.invoiceNumber ?? 'Pending';
  const serviceLocation = selectedReviewInvoice
    ? `${selectedReviewInvoice.billTo.city}, ${selectedReviewInvoice.billTo.region}`.trim().replace(/^,|,$/g, '') || 'Pending'
    : 'Pending';
  const riskTone = firstFailedCheck || confidenceScore < 80 ? 'warning' : 'approved';
  const lineItemDetails = lineItems.length
    ? lineItems
        .slice(0, 6)
        .map((line) => renderLineItemDetailRow(line.lineNumber, line.description ?? 'Line item', line.quantity, line.unitPrice, line.amount, invoiceCurrency))
        .join('')
    : '<div class="empty-state">No line items available.</div>';
  const activePanel = activeInvoicePanel === 'details' ? 'details' : 'insights';
  const failedCount = checks.filter((check) => check.status.toLowerCase() !== 'pass').length;
  const rateCapImpact = firstFailedCheck ? totalAmount * 0.1458 : 0;
  const priceImpact = failedCount > 1 ? totalAmount * 0.049 : 0;
  const quantityImpact = lineItems.length > 3 ? totalAmount * 0.0054 : 0;
  const impactTotal = rateCapImpact + priceImpact + quantityImpact;
  const donutStyle = `background: radial-gradient(circle at center, #ffffff 0 52%, transparent 53%), conic-gradient(var(--red) 0 ${impactTotal > 0 ? (rateCapImpact / impactTotal) * 100 : 0}%, var(--orange) ${impactTotal > 0 ? (rateCapImpact / impactTotal) * 100 : 0}% ${impactTotal > 0 ? ((rateCapImpact + priceImpact) / impactTotal) * 100 : 0}%, var(--yellow) ${impactTotal > 0 ? ((rateCapImpact + priceImpact) / impactTotal) * 100 : 0}% 100%)`;

  return `
    <section class="page active invoices-layout invoices-page">
      <main class="invoice-lens-page">
        <section class="workspace">
          <aside class="panel queue">
            <div class="panel-header">
              <div class="title">
                <span class="queue-header-icon" aria-hidden="true">◫</span>
                Review Queue
                <span class="count">${rows.length}</span>
              </div>
              <div class="queue-header-actions" aria-hidden="true">
                <span>⌁</span>
                <span>⋮</span>
              </div>
            </div>

            <div class="sortbar">
              <span>Sort:</span>
              <select class="invoice-sort-select" data-filter="queue-sort" aria-label="Sort queue">
                ${['Oldest First', 'Newest First', 'Highest Amount']
                  .map((option) => `<option value="${option}" ${queueSort === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
              <span class="sortbar-filter-icon" aria-hidden="true">⌁</span>
            </div>

            <div class="queue-list">
              ${
                rows.length > 0
                  ? rows.map((invoice) => renderInvoiceQueueItem(invoice, selectedInvoice?.invoiceId ?? '', reviewData)).join('')
                  : '<div class="empty-state">No invoices match current filters.</div>'
              }
            </div>

            <div class="queue-footer">
              <span>Showing 1 - ${rows.length} of ${rows.length}</span>
              <button class="load-more" type="button" data-action="load-more">Load More</button>
            </div>

          </aside>

          <section class="panel viewer">
            <div class="viewer-toolbar">
              <div class="tool-group">
                <span>Page</span>
                <button class="tool-icon tool-icon-sm" type="button" data-action="prev-invoice" aria-label="Previous invoice" title="Previous">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
                </button>
                <strong>${selectedPosition > 0 ? selectedPosition : 1}</strong>
                <span>/ ${Math.max(totalInvoices, 1)}</span>
                <button class="tool-icon tool-icon-sm" type="button" data-action="next-invoice" aria-label="Next invoice" title="Next">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
                </button>
                <span class="toolbar-divider"></span>
                <button class="tool-icon tool-icon-sm" type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"></path></svg>
                </button>
                <button class="tool-icon tool-icon-sm" type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"></path></svg>
                </button>
                <button class="zoom" type="button" data-action="zoom-reset" title="Reset zoom">100%</button>
              </div>

              <div class="tool-group tool-group-actions">
                <button class="tool-icon" type="button" data-action="download-pdf" aria-label="Download" title="Download">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4"></path><path d="M5 19h14"></path></svg>
                </button>
                <button class="tool-icon" type="button" data-action="print-invoice" aria-label="Print" title="Print">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V4h10v4"></path><rect x="5" y="8" width="14" height="8" rx="1.5"></rect><path d="M7 16h10v4H7z"></path></svg>
                </button>
                <button class="tool-icon" type="button" data-action="more-actions" aria-label="Open in new tab" title="Open in new tab">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="12" cy="19" r="1.4"></circle></svg>
                </button>
              </div>
            </div>

            <div class="document-area">
              ${renderInvoiceDocument(selectedReviewInvoice, selectedInvoice)}
            </div>
          </section>

          <aside class="panel insights">
            <div class="tabs" role="tablist" aria-label="Invoice side panels">
              <button class="tab ${activePanel === 'insights' ? 'active' : ''}" type="button" data-action="switch-invoice-panel" data-panel="insights" role="tab" aria-selected="${String(activePanel === 'insights')}">Insights</button>
              <button class="tab ${activePanel === 'details' ? 'active' : ''}" type="button" data-action="switch-invoice-panel" data-panel="details" role="tab" aria-selected="${String(activePanel === 'details')}">Line Item Details</button>
            </div>

            <div class="insights-content">
              <section class="invoice-tab-panel ${activePanel === 'insights' ? 'is-active' : ''}" role="tabpanel" ${activePanel === 'insights' ? '' : 'aria-hidden="true"'}>
                <section class="info-card summary-grid">
                  <div>
                    <div class="card-title">Invoice Summary</div>

                    <div class="summary-list">
                      ${renderSummaryListRow('Invoice #', invoiceNumber)}
                      ${renderSummaryListRow('Vendor', vendorName)}
                      ${renderSummaryListRow('Invoice Date', invoiceDate)}
                      ${renderSummaryListRow('Total Amount', formatCurrency(totalAmount, invoiceCurrency))}
                      ${renderSummaryListRow('Location', serviceLocation)}
                    </div>
                  </div>

                  <div class="score-box">
                    <div class="score-title">Confidence Score</div>
                    <div class="score-row">
                      <div class="score-circle">
                        <canvas class="invoice-score-chart" width="74" height="74" data-score="${confidenceScore}" aria-label="Confidence score chart"></canvas>
                        <span class="score-circle-label">${confidenceScore}%</span>
                      </div>
                      <strong>${confidenceScore >= 80 ? 'High Confidence' : confidenceScore >= 60 ? 'Medium Confidence' : 'Needs Review'}</strong>
                    </div>

                    <div class="metric-row">
                      <span>Extracted Line Items</span>
                      <strong>${lineItems.length}</strong>
                    </div>

                    <div class="metric-row">
                      <span>Exceptions</span>
                      <strong class="red">${failedCount}</strong>
                    </div>
                  </div>
                </section>

                <section class="info-card">
                  <div class="validation-head">
                    <div class="card-title" style="margin-bottom: 0;">Validation Results</div>
                    <span class="passed">${passedChecks} / ${checks.length || 0} Passed</span>
                  </div>

                  <div class="validation-list">
                    ${
                      checks.length > 0
                        ? checks
                            .map(
                              (check) => `
                                <div class="valid-row">
                                  <span class="ok">●</span>
                                  <span>${escapeHtml(check.ruleName)}</span>
                                  <strong>${escapeHtml(normalizeLabel(check.status))}</strong>
                                </div>
                              `,
                            )
                            .join('')
                        : '<div class="empty-state">Validation details will appear after loading invoice review data.</div>'
                    }
                  </div>
                </section>

                ${
                  firstFailedCheck
                    ? `
                      <section class="alert-card">
                        <div class="alert-title">
                          ▲ ${escapeHtml(firstFailedCheck.ruleName)}
                        </div>

                        <div class="alert-body">
                          <span>Invoice</span>
                          <strong>${escapeHtml(invoiceNumber)}</strong>

                          <span>Vendor</span>
                          <strong>${escapeHtml(vendorName)}</strong>

                          <span>Status</span>
                          <strong>${escapeHtml(normalizeLabel(firstFailedCheck.status))}</strong>

                          <span>Variance</span>
                          <strong class="variance">${escapeHtml(firstFailedCheck.message)}</strong>

                          <button class="view-btn" data-action="open-portal">View Details</button>
                        </div>
                      </section>
                    `
                    : ''
                }

                <section class="info-card variance-card">
                  <div class="variance-header">
                    <div class="card-title" style="margin-bottom: 0;">Variance Impact</div>
                    <span class="load-more">View All</span>
                  </div>

                  <div class="variance-chart-body">
                    <div class="donut-wrap">
                      <div class="impact-donut">
                        <canvas
                          class="invoice-impact-chart"
                          width="138"
                          height="138"
                          data-rate-cap="${rateCapImpact}"
                          data-price="${priceImpact}"
                          data-quantity="${quantityImpact}"
                          aria-label="Variance impact chart"></canvas>
                        <div class="donut-center">
                          <div>
                            <strong>${formatCurrency(impactTotal, invoiceCurrency)}</strong>
                            <span>Total Impact</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="variance-legend">
                      <div class="legend-row">
                        <span class="legend-dot red"></span>
                        <div class="legend-text">
                          <strong>Rate Cap Variance</strong>
                          <span>${firstFailedCheck ? '1 exception' : '0 exception'}</span>
                        </div>
                        <div class="legend-value">
                          ${formatCurrency(rateCapImpact, invoiceCurrency)}
                          <span>${impactTotal > 0 ? `${((rateCapImpact / impactTotal) * 100).toFixed(1)}%` : '0%'}</span>
                        </div>
                      </div>

                      <div class="legend-row">
                        <span class="legend-dot orange"></span>
                        <div class="legend-text">
                          <strong>Price Variance</strong>
                          <span>${failedCount > 1 ? `${failedCount - 1} exception` : '0 exception'}</span>
                        </div>
                        <div class="legend-value">
                          ${formatCurrency(priceImpact, invoiceCurrency)}
                          <span>${impactTotal > 0 ? `${((priceImpact / impactTotal) * 100).toFixed(1)}%` : '0%'}</span>
                        </div>
                      </div>

                      <div class="legend-row">
                        <span class="legend-dot yellow"></span>
                        <div class="legend-text">
                          <strong>Quantity Variance</strong>
                          <span>${lineItems.length > 3 ? `${lineItems.length - 3} exception` : '0 exception'}</span>
                        </div>
                        <div class="legend-value">
                          ${formatCurrency(quantityImpact, invoiceCurrency)}
                          <span>${impactTotal > 0 ? `${((quantityImpact / impactTotal) * 100).toFixed(1)}%` : '0%'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="impact-total-bar">
                    <span>Total Financial Impact</span>
                    <strong>${formatCurrency(impactTotal, invoiceCurrency)}</strong>
                  </div>
                </section>

                <section class="info-card">
                  <div class="risk-head">
                    <div class="card-title" style="margin-bottom: 0;">Compliance & Risk</div>
                    <span class="risk-label">${riskTone === 'approved' ? 'LOW RISK' : 'REVIEW'}</span>
                  </div>

                  <div class="risk-row">
                    <span>OFAC Screening</span>
                    <strong>Clear</strong>
                    <span class="ok">●</span>
                  </div>

                  <div class="risk-row">
                    <span>Insurance on File</span>
                    <strong>${selectedReviewInvoice ? 'Valid' : 'Pending'}</strong>
                    <span class="ok">●</span>
                  </div>

                  <div class="risk-row">
                    <span>W-9 on File</span>
                    <strong>${selectedReviewInvoice ? 'Valid' : 'Pending'}</strong>
                    <span class="ok">●</span>
                  </div>
                </section>
              </section>

              <section class="invoice-tab-panel ${activePanel === 'details' ? 'is-active' : ''}" role="tabpanel" ${activePanel === 'details' ? '' : 'aria-hidden="true"'}>
                <section class="info-card">
                  <div class="card-title">Line Item Details</div>
                  <div class="invoice-line-item-detail-list">
                    ${lineItemDetails}
                  </div>
                </section>
              </section>
            </div>
          </aside>
        </section>
      </main>
    </section>
  `;
}
