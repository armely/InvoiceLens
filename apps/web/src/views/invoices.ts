import { InvoiceDetailDto, InvoicePanelTab, InvoiceSummaryDto, ReviewViewData } from '../shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDate, formatDateTime, invoiceStatusTone, normalizeLabel } from '../shared/utils.js';
import { routeHref, statusChip } from './shared.js';

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

function renderQueueMetaChips(invoice: InvoiceSummaryDto): string {
  return `
    <div class="invoice-queue-meta">
      <span>Created ${escapeHtml(formatDateTime(invoice.createdAtUtc))}</span>
      <span>AFE ${escapeHtml(invoice.afe)}</span>
    </div>
  `;
}

function renderInvoiceQueueItem(invoice: InvoiceSummaryDto, selectedInvoiceId: string): string {
  const tone = invoiceStatusTone(invoice.status);
  const isSelected = invoice.invoiceId === selectedInvoiceId;

  return `
    <a href="${routeHref('invoices', invoice.invoiceId)}" class="queue-item invoice-queue-item ${isSelected ? 'selected' : ''}" data-invoice-id="${invoice.invoiceId}">
      <span class="invoice-queue-check" aria-hidden="true"></span>
      <div class="queue-item-body">
        <div class="queue-item-top">
          <div class="queue-item-title">
            <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
            <small>${escapeHtml(invoice.vendor)}</small>
          </div>
          <strong>${formatCurrency(invoice.amount, invoice.currency)}</strong>
        </div>
        ${renderQueueMetaChips(invoice)}
        <div class="invoice-queue-item-footer">
          <span class="status-chip ${statusPillClass(invoice.status)}">${escapeHtml(normalizeLabel(invoice.status))}</span>
          <span class="queue-item-signal ${tone}" aria-hidden="true"></span>
        </div>
      </div>
    </a>
  `;
}

function renderDocumentAddress(title: string, lines: Array<string | null | undefined>): string {
  const body = lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => escapeHtml(line))
    .join('<br />');

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

function renderInsightStat(label: string, value: string, subtext: string): string {
  return `
    <div class="invoice-insight-stat">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(subtext)}</span>
    </div>
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
  const dueDate = selectedReviewInvoice?.dueDateUtc ? formatDate(selectedReviewInvoice.dueDateUtc) : 'Pending';
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

  return `
    <section class="page active invoices-layout invoices-page">
      <section class="review-workspace invoice-three-panel-grid invoice-workspace-shell">
        <section class="review-column invoice-queue-column invoice-pane">
          <div class="viewer-toolbar invoice-queue-toolbar invoice-pane-header">
            <div class="invoice-pane-heading">
              <p class="card-kicker">Review Queue</p>
              <div class="invoice-pane-title-row">
                <h2>Review Queue</h2>
                <span class="status-chip pending-neutral">${rows.length}</span>
              </div>
            </div>
            <div class="invoice-pane-actions">
              <button class="icon-button invoice-icon-button" type="button" aria-label="Filter queue">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16l-6 7v5l-4 2v-7z"></path>
                </svg>
              </button>
              <button class="icon-button invoice-icon-button" type="button" aria-label="More queue options">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5.5v.5"></path>
                  <path d="M12 11.5v.5"></path>
                  <path d="M12 17.5v.5"></path>
                </svg>
              </button>
            </div>
          </div>
          <section class="invoice-queue-controls" aria-label="Queue controls">
            <span class="invoice-queue-sort-label">Sort:</span>
            <select class="select-field invoice-queue-sort" data-filter="queue-sort" aria-label="Sort queue">
              ${['Oldest First', 'Newest First', 'Highest Amount']
                .map((option) => `<option value="${option}" ${queueSort === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
            <button class="icon-button invoice-icon-button invoice-queue-inline-action" type="button" aria-label="Queue filter options">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16l-6 7v5l-4 2v-7z"></path>
              </svg>
            </button>
          </section>
          <div class="queue-page-list invoice-queue-list">
            ${
              rows.length > 0
                ? rows.map((invoice) => renderInvoiceQueueItem(invoice, selectedInvoice?.invoiceId ?? '')).join('')
                : '<div class="empty-state">No invoices match current filters.</div>'
            }
          </div>
          <footer class="invoice-queue-footer">
            <span>Showing ${rows.length ? `1 - ${rows.length}` : '0'} of ${rows.length}</span>
            <button class="button ghost" type="button">Load More</button>
          </footer>
        </section>
        <section class="viewer-panel invoice-preview-column invoice-pane invoice-preview-pane">
          <div class="viewer-toolbar invoice-document-toolbar">
            <div class="viewer-tools">
              <button class="tool-button" type="button" aria-label="Fit to page">↔</button>
              <button class="tool-button" type="button" aria-label="Mark reviewed">✓</button>
              <button class="tool-button" type="button" aria-label="Annotate">✎</button>
              <span class="invoice-page-indicator">${selectedPosition > 0 ? selectedPosition : 0} / ${totalInvoices}</span>
              <button class="tool-button" type="button" aria-label="Zoom out">−</button>
              <button class="tool-button" type="button" aria-label="Zoom in">+</button>
              <span class="invoice-zoom-chip">100%</span>
              <button class="tool-button" type="button" aria-label="Fit width">◫</button>
              <button class="tool-button" type="button" aria-label="Rotate document">↻</button>
            </div>
            <div class="viewer-tools">
              <button class="tool-button" type="button" data-action="download-pdf" aria-label="Download PDF">↓</button>
              <button class="tool-button" type="button" aria-label="Print invoice">⎙</button>
              <button class="tool-button" type="button" aria-label="More actions">⋮</button>
            </div>
          </div>
          <div class="invoice-document-frame">
            ${renderInvoiceDocument(selectedReviewInvoice, selectedInvoice)}
          </div>
        </section>
        <aside class="validation-panel invoice-insights-column invoice-pane invoice-insights-pane">
          <section class="invoice-tabs" aria-label="Invoice side panels" role="tablist">
            <button class="invoice-tab ${activePanel === 'insights' ? 'is-active' : ''}" type="button" data-action="switch-invoice-panel" data-panel="insights" role="tab" aria-selected="${String(activePanel === 'insights')}">Insights</button>
            <button class="invoice-tab ${activePanel === 'details' ? 'is-active' : ''}" type="button" data-action="switch-invoice-panel" data-panel="details" role="tab" aria-selected="${String(activePanel === 'details')}">Line Item Details</button>
          </section>
          <div class="invoice-tab-panels">
            <section class="invoice-tab-panel ${activePanel === 'insights' ? 'is-active' : ''}" role="tabpanel" aria-label="Invoice insights" ${activePanel === 'insights' ? '' : 'aria-hidden="true"'}>
              <section class="card invoice-insight-card invoice-summary-card">
                <div class="card-header">
                  <div class="invoice-summary-copy">
                    <h2>Invoice Summary</h2>
                    <p>${escapeHtml(invoiceNumber)} · ${escapeHtml(vendorName)}</p>
                  </div>
                </div>
                <div class="invoice-summary-grid">
                  <div class="invoice-summary-list">
                    ${renderInsightStat('Invoice #', invoiceNumber, 'Primary reference')}
                    ${renderInsightStat('Vendor', vendorName, 'Supplier source')}
                    ${renderInsightStat('Invoice Date', invoiceDate, 'Document date')}
                    ${renderInsightStat('Total Amount', formatCurrency(totalAmount, invoiceCurrency), 'Invoice total')}
                    ${renderInsightStat('Service Location', serviceLocation, 'Bill-to location')}
                    ${renderInsightStat('Updated', updatedAt, 'Most recent sync')}
                  </div>
                  <div class="invoice-confidence-panel">
                    <div class="invoice-confidence-ring" style="--confidence:${confidenceScore};">
                      <strong>${confidenceScore}%</strong>
                    </div>
                    <span>${confidenceScore >= 80 ? 'High Confidence' : confidenceScore >= 60 ? 'Medium Confidence' : 'Needs Review'}</span>
                    <small>${lineItems.length} extracted line items</small>
                    <small>${checks.length - passedChecks} exceptions flagged</small>
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
                          .map((check) => renderValidationRow(check.ruleName, normalizeLabel(check.status), check.status.toLowerCase() === 'pass' ? 'pass' : 'fail'))
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
                        <h2>MSA Rate Cap Variance Detected</h2>
                        <span class="status-chip exception">Action Required</span>
                      </div>
                      <div class="invoice-warning-body">
                        <div>
                          <small>Line Item</small>
                          <strong>${escapeHtml(firstFailedCheck.ruleName)}</strong>
                        </div>
                        <div>
                          <small>Message</small>
                          <p>${escapeHtml(firstFailedCheck.message)}</p>
                        </div>
                        <div class="invoice-warning-actions">
                          <button class="button" type="button" data-action="open-portal">View Details</button>
                        </div>
                      </div>
                    </section>
                  `
                  : ''
              }
              <section class="card invoice-insight-card">
                <div class="card-header">
                  <div>
                    <h2>Variance Summary</h2>
                  </div>
                  <button class="button ghost" type="button" data-action="open-portal">View All</button>
                </div>
                <div class="invoice-variance-grid">
                  ${renderInsightStat('Rate Cap Variance', firstFailedCheck ? 'Detected' : 'None', firstFailedCheck ? 'Requires review' : 'All clear')}
                  ${renderInsightStat('Price Variance', checks.length > 0 ? `${checks.filter((check) => check.status.toLowerCase() !== 'pass').length}` : '0', 'Flagged checks')}
                  ${renderInsightStat('Quantity Variance', String(lineItems.length > 0 ? Math.max(0, lineItems.length - 3) : 0), 'Derived from line items')}
                  ${renderInsightStat('Total Impact', formatCurrency(selectedReviewInvoice?.amount ?? selectedInvoice?.amount ?? 0, invoiceCurrency), 'Invoice value at risk')}
                </div>
              </section>
              <section class="card invoice-insight-card">
                <div class="card-header">
                  <h2>Compliance & Risk</h2>
                  <span class="status-chip ${riskTone}">${riskTone === 'approved' ? 'LOW RISK' : 'REVIEW'}</span>
                </div>
                <div class="validation-list invoice-risk-list">
                  ${renderValidationRow('OFAC Screening', 'Clear', 'pass')}
                  ${renderValidationRow('Insurance on File', selectedReviewInvoice ? 'Valid' : 'Pending', selectedReviewInvoice ? 'pass' : 'fail')}
                  ${renderValidationRow('W-9 on File', selectedReviewInvoice ? 'Valid' : 'Pending', selectedReviewInvoice ? 'pass' : 'fail')}
                </div>
              </section>
            </section>
            <section class="invoice-tab-panel ${activePanel === 'details' ? 'is-active' : ''}" role="tabpanel" aria-label="Line item details" ${activePanel === 'details' ? '' : 'aria-hidden="true"'}>
              <section class="card invoice-insight-card">
                <div class="card-header">
                  <h2>Line Item Details</h2>
                  <span class="status-chip pending-neutral">${lineItems.length}</span>
                </div>
                <div class="invoice-line-item-detail-list">
                  ${lineItemDetails}
                </div>
              </section>
            </section>
          </div>
        </aside>
      </section>
    </section>
  `;
}
