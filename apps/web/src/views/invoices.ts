import { InvoiceDetailDto, InvoiceSummaryDto, ReviewViewData } from '../shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDate, formatDateTime, invoiceStatusTone, normalizeLabel } from '../shared/utils.js';

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

function renderInvoiceQueueItem(invoice: InvoiceSummaryDto, selectedInvoiceId: string): string {
  const tone = invoiceStatusTone(invoice.status);
  const isSelected = invoice.invoiceId === selectedInvoiceId;

  return `
    <a href="/invoices" class="queue-item invoice-queue-item ${isSelected ? 'selected' : ''}" data-invoice-id="${invoice.invoiceId}">
      <div class="queue-item-top">
        <div class="queue-item-title">
          <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
          <small>${escapeHtml(invoice.vendor)}</small>
        </div>
        <strong>${formatCurrency(invoice.amount, invoice.currency)}</strong>
      </div>
      <div class="queue-item-meta">
        <span>${escapeHtml(formatDateTime(invoice.createdAtUtc))}</span>
        <span>${escapeHtml(invoice.afe)}</span>
      </div>
      <div class="invoice-queue-item-footer">
        <span class="status-chip ${statusPillClass(invoice.status)}">${escapeHtml(normalizeLabel(invoice.status))}</span>
        <span class="queue-item-signal ${tone}" aria-hidden="true"></span>
      </div>
    </a>
  `;
}

function renderDocumentAddress(title: string, lines: Array<string | null | undefined>): string {
  const body = lines.filter((line): line is string => Boolean(line && line.trim())).map((line) => escapeHtml(line)).join('<br />');
  return `
    <div>
      <h3>${escapeHtml(title)}</h3>
      <p>${body || 'Pending'}</p>
    </div>
  `;
}

function renderInvoiceDocument(invoice: InvoiceDetailDto | null, fallbackInvoice: InvoiceSummaryDto | null): string {
  if (!invoice && !fallbackInvoice) {
    return '<div class="empty-state">No invoice selected.</div>';
  }

  const number = invoice?.invoiceNumber ?? fallbackInvoice?.invoiceNumber ?? 'Pending';
  const vendor = invoice?.vendor ?? fallbackInvoice?.vendor ?? 'Pending';
  const status = normalizeLabel(invoice?.status ?? fallbackInvoice?.status ?? 'Pending Review');
  const currency = invoice?.currency ?? fallbackInvoice?.currency ?? 'USD';
  const invoiceDate = invoice?.invoiceDateUtc ? formatDate(invoice.invoiceDateUtc) : formatDate(fallbackInvoice?.createdAtUtc ?? '');
  const dueDate = invoice?.dueDateUtc ? formatDate(invoice.dueDateUtc) : 'Pending';
  const lineItems = invoice?.lineItems ?? [];
  const subtotal = invoice?.totals?.subtotal ?? fallbackInvoice?.amount ?? 0;
  const tax = invoice?.totals?.tax ?? 0;
  const total = invoice?.totals?.total ?? fallbackInvoice?.amount ?? 0;

  return `
    <article class="invoice-document invoice-document-inline" aria-label="Selected invoice document">
      <div class="document-head">
        <div class="document-logo">
          <span class="rig-mark">&#x25EC;</span>
          <div>
            <strong>${escapeHtml(vendor)}</strong>
            <span>${escapeHtml(number)}</span>
          </div>
        </div>
        <div class="document-title">
          <h2>Invoice</h2>
          <p>${escapeHtml(status)}</p>
        </div>
      </div>
      <div class="document-meta">
        ${
          invoice
            ? renderDocumentAddress('Bill To', [
                invoice.billTo.name,
                invoice.billTo.addressLine1,
                invoice.billTo.addressLine2,
                `${invoice.billTo.city}, ${invoice.billTo.region} ${invoice.billTo.postalCode}`.trim(),
              ])
            : '<div><h3>Bill To</h3><p>Pending</p></div>'
        }
        ${
          invoice
            ? renderDocumentAddress('Vendor', [
                invoice.vendorContact.name,
                invoice.vendorContact.addressLine1,
                invoice.vendorContact.addressLine2,
                `${invoice.vendorContact.city}, ${invoice.vendorContact.region} ${invoice.vendorContact.postalCode}`.trim(),
              ])
            : '<div><h3>Vendor</h3><p>Pending</p></div>'
        }
      </div>
      <div class="document-fields">
        <div class="document-field">
          <small>Invoice Date</small>
          <strong>${escapeHtml(invoiceDate || 'Pending')}</strong>
        </div>
        <div class="document-field">
          <small>Due Date</small>
          <strong>${escapeHtml(dueDate)}</strong>
        </div>
        <div class="document-field">
          <small>Line Items</small>
          <strong>${lineItems.length || '0'}</strong>
        </div>
        <div class="document-field">
          <small>Status</small>
          <strong>${escapeHtml(status)}</strong>
        </div>
      </div>
      <div class="invoice-line-items invoice-line-items-inline">
        <div class="invoice-line-items-head">
          <span>Description</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Amount</span>
        </div>
        ${
          lineItems.length
            ? lineItems
                .slice(0, 8)
                .map(
                  (line) => `
                    <div class="invoice-line-item">
                      <div class="invoice-line-description">
                        <span class="invoice-line-badge">${line.lineNumber}</span>
                        <div>
                          <strong>${escapeHtml(line.description || 'Line item')}</strong>
                          <span>Line ${line.lineNumber}</span>
                        </div>
                      </div>
                      <span>${line.quantity}</span>
                      <span>${formatCurrency(line.unitPrice, currency)}</span>
                      <strong>${formatCurrency(line.amount, currency)}</strong>
                    </div>
                  `,
                )
                .join('')
            : '<div class="empty-state">No line items available.</div>'
        }
      </div>
      <div class="invoice-summary-footer invoice-summary-footer-inline">
        <section class="invoice-notes">
          <h3>Notes</h3>
          <p>${escapeHtml(invoice?.notes ?? 'No notes provided for this invoice.')}</p>
        </section>
        <section class="invoice-totals">
          <div class="invoice-total-row">
            <span>Subtotal</span>
            <strong>${formatCurrency(subtotal, currency)}</strong>
          </div>
          <div class="invoice-total-row">
            <span>Tax</span>
            <strong>${formatCurrency(tax, currency)}</strong>
          </div>
          <div class="invoice-total-row invoice-total-row--grand">
            <span>Total</span>
            <strong>${formatCurrency(total, currency)}</strong>
          </div>
        </section>
      </div>
    </article>
  `;
}

export function renderInvoicesPage(
  invoices: InvoiceSummaryDto[],
  search: string,
  statusFilter: 'All Statuses' | 'Pending Review' | 'Sent Back' | 'Approved',
  dateRange: 'All Time' | 'Last 30 Days' | 'This Week' | 'This Quarter',
  dateFrom: string,
  dateTo: string,
  selectedInvoiceId: string,
  reviewData: ReviewViewData,
): string {
  const rows = applyInvoiceFilters(invoices, {
    search,
    status: statusFilter,
    dateRange,
    dateFrom,
    dateTo,
    sort: 'Oldest First',
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

  return `
    <section class="page active invoices-layout invoice-three-panel">
      <section class="review-workspace invoice-three-panel-grid">
        <section class="review-column invoice-queue-column">
          <div class="viewer-toolbar invoice-queue-toolbar">
            <div>
              <p class="card-kicker">Review Queue</p>
              <h2>${rows.length} Invoices</h2>
            </div>
            <span class="status-chip pending-neutral">${rows.length}</span>
          </div>
          <section class="filter-bar invoice-filter-bar-inline">
            <div class="filter-field invoice-search-field">
              <span class="field-label">Search</span>
              <div class="search-input-wrap invoice-search">
                <span aria-hidden="true" class="search-glyph">
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5"></circle>
                    <path d="M16.2 16.2 20 20"></path>
                  </svg>
                </span>
                <input class="search-input" type="search" value="${search}" data-input="page-search" placeholder="Search invoice number, vendor, AFE, company, or amount..." />
              </div>
            </div>
            <div class="invoice-filter-grid-inline">
              <label class="filter-field">
                <span class="field-label">Status</span>
                <select class="select-field" data-filter="invoice-status">
                  ${['All Statuses', 'Pending Review', 'Sent Back', 'Approved']
                    .map((option) => `<option value="${option}" ${statusFilter === option ? 'selected' : ''}>${option}</option>`)
                    .join('')}
                </select>
              </label>
              <label class="filter-field">
                <span class="field-label">Date Range</span>
                <select class="select-field" data-filter="invoice-date-range">
                  ${['All Time', 'Last 30 Days', 'This Week', 'This Quarter']
                    .map((option) => `<option value="${option}" ${dateRange === option ? 'selected' : ''}>${option}</option>`)
                    .join('')}
                </select>
              </label>
            </div>
            <div class="invoice-filter-grid-inline invoice-filter-grid-inline-dates">
              <label class="filter-field">
                <span class="field-label">From</span>
                <input class="input-field" type="date" value="${dateFrom}" data-filter="invoice-date-from" aria-label="From date" />
              </label>
              <label class="filter-field">
                <span class="field-label">To</span>
                <input class="input-field" type="date" value="${dateTo}" data-filter="invoice-date-to" aria-label="To date" />
              </label>
            </div>
            <button class="button primary invoice-filter-reset" type="button" data-action="reset-invoice-filters">Clear</button>
          </div>
          <div class="queue-page-list">
            ${rows.length > 0 ? rows.map((invoice) => renderInvoiceQueueItem(invoice, selectedInvoice?.invoiceId ?? '')).join('') : '<div class="empty-state">No invoices match current filters.</div>'}
          </div>
        </section>
        <section class="viewer-panel invoice-preview-column">
          <div class="viewer-toolbar">
            <div class="viewer-tools">
              <button class="tool-button" type="button" aria-label="Previous invoice">&#x2039;</button>
              <button class="tool-button" type="button" aria-label="Next invoice">&#x203A;</button>
              <span class="status-chip pending-neutral">${selectedInvoice ? escapeHtml(selectedInvoice.invoiceNumber) : 'No invoice'}</span>
            </div>
            <div class="viewer-tools">
              <button class="tool-button" type="button" data-action="download-pdf" aria-label="Download PDF">&#x2B07;</button>
            </div>
          </div>
          ${renderInvoiceDocument(selectedReviewInvoice, selectedInvoice)}
        </section>
        <aside class="validation-panel invoice-insights-column">
          <section class="card invoice-insight-card">
            <div class="card-header">
              <h2>Insights</h2>
              <span class="status-chip pending-neutral">Line Item Details</span>
            </div>
            <div class="invoice-insight-grid">
              <div class="invoice-insight-summary">
                <h3>Invoice Summary</h3>
                <dl>
                  <div><dt>Invoice #</dt><dd>${escapeHtml(selectedReviewInvoice?.invoiceNumber ?? selectedInvoice?.invoiceNumber ?? 'Pending')}</dd></div>
                  <div><dt>Vendor</dt><dd>${escapeHtml(selectedReviewInvoice?.vendor ?? selectedInvoice?.vendor ?? 'Pending')}</dd></div>
                  <div><dt>Invoice Date</dt><dd>${escapeHtml(selectedReviewInvoice?.invoiceDateUtc ? formatDate(selectedReviewInvoice.invoiceDateUtc) : selectedInvoice ? formatDate(selectedInvoice.createdAtUtc) : 'Pending')}</dd></div>
                  <div><dt>Total</dt><dd>${selectedReviewInvoice || selectedInvoice ? formatCurrency(selectedReviewInvoice?.amount ?? selectedInvoice?.amount ?? 0, selectedReviewInvoice?.currency ?? selectedInvoice?.currency ?? 'USD') : 'Pending'}</dd></div>
                </dl>
              </div>
              <div class="invoice-confidence">
                <div class="invoice-confidence-ring" style="--confidence:${confidenceScore};">
                  <strong>${confidenceScore}%</strong>
                </div>
                <span>${confidenceScore >= 80 ? 'High Confidence' : confidenceScore >= 60 ? 'Medium Confidence' : 'Needs Review'}</span>
              </div>
            </div>
          </section>
          <section class="card invoice-insight-card">
            <div class="card-header">
              <h2>Validation Results</h2>
              <span class="status-chip ${checks.length > 0 && passedChecks === checks.length ? 'approved' : 'pending'}">${passedChecks} / ${checks.length || 0} Passed</span>
            </div>
            <div class="validation-list invoice-validation-list-inline">
              ${
                checks.length > 0
                  ? checks
                      .map(
                        (check) => `
                          <div class="validation-check">
                            <div>
                              <strong>${escapeHtml(check.ruleName)}</strong>
                              <small>${escapeHtml(normalizeLabel(check.status))}</small>
                            </div>
                            <span class="check-pass ${check.status.toLowerCase() === 'pass' ? 'pass' : 'fail'}">${check.status.toLowerCase() === 'pass' ? '&#10003;' : '!'}</span>
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
                <section class="card invoice-insight-card invoice-warning-card">
                  <div class="card-header">
                    <h2>Variance Detected</h2>
                    <span class="status-chip exception">Action Required</span>
                  </div>
                  <p>${escapeHtml(firstFailedCheck.ruleName)}</p>
                  <p>${escapeHtml(firstFailedCheck.message)}</p>
                </section>
              `
              : ''
          }
        </aside>
      </section>
    </section>
  `;
}
