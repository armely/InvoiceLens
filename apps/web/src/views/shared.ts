import {
  AuditEntryDto,
  DashboardMetric,
  InvoiceDetailDto,
  InvoiceReviewDto,
  InvoiceSummaryDto,
  QueueRow,
  QueueSummaryItem,
  Route,
  ValidationAlert,
  ValidationCheckViewModel,
  ValidationSummaryDto,
  VendorBar,
} from '../shared/models.js';
import { formatCurrency, formatDate, formatDateTime, initials, normalizeLabel } from '../shared/utils.js';

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

export function renderInvoicePreviewModalRich(review: InvoiceReviewDto | null, loading = false): string {
  const invoice = review?.invoice ?? null;
  const isApproved = normalizeLabel(invoice?.status).toLowerCase() === 'approved';
  const lineItems = invoice?.lineItems ?? [];
  const totals = invoice?.totals ?? null;
  const invoiceCurrency = invoice?.currency ?? 'USD';
  const invoiceDate = invoice?.invoiceDateUtc ? formatDate(invoice.invoiceDateUtc) : 'Pending';
  const dueDate = invoice?.dueDateUtc ? formatDate(invoice.dueDateUtc) : 'Pending';
  const updatedAt = invoice?.updatedAtUtc ? formatDateTime(invoice.updatedAtUtc) : 'Pending';
  const paymentTerms = invoice?.paymentTerms ?? '';
  const notes = invoice?.notes ?? 'Thank you for your business. We appreciate the opportunity to support your team.';

  const formatLines = (lines: Array<string | null | undefined>): string =>
    lines
      .filter((line): line is string => Boolean(line && line.trim()))
      .map((line) => escapeHtml(line))
      .join('<br />');

  const renderPartyCard = (title: string, name: string, lines: Array<string | null | undefined>, className = ''): string => `
    <article class="invoice-summary-party invoice-summary-party--compact ${className}">
      <h3>${escapeHtml(title)}</h3>
      <strong>${escapeHtml(name)}</strong>
      <p>${formatLines(lines)}</p>
    </article>
  `;

  return `
    <div class="invoice-modal-backdrop invoice-modal-backdrop--rich" data-action="close-invoice-preview">
      <section class="invoice-modal-shell invoice-modal-shell--rich" data-action="modal-shell" role="dialog" aria-modal="true" aria-labelledby="invoicePreviewTitle">
        <header class="invoice-modal-header invoice-modal-header--rich">
          <div class="invoice-modal-header-left">
            <div class="invoice-preview-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path d="M7 3.75h6.5L19.25 9v10.25A1.75 1.75 0 0 1 17.5 21h-10A1.75 1.75 0 0 1 5.75 19.25v-13.5A1.75 1.75 0 0 1 7.5 4h-.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M13.25 3.75V9H19.25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M8.5 13.25h7M8.5 16.25h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </div>
            <div class="invoice-modal-header-copy">
              <p class="modal-kicker">Invoice Preview</p>
              <h2 id="invoicePreviewTitle">${invoice ? escapeHtml(invoice.invoiceNumber) : 'Invoice preview'}</h2>
              <p class="invoice-modal-header-subtitle">${invoice ? `${escapeHtml(invoice.vendor)} <span aria-hidden="true">&bull;</span> ${escapeHtml(normalizeLabel(invoice.status))}` : loading ? 'Loading invoice details...' : 'Select an invoice to inspect.'}</p>
            </div>
          </div>
          <div class="invoice-modal-header-badges">
            ${invoice ? statusChip(normalizeLabel(invoice.status)) : '<span class="status-chip pending-neutral">Pending</span>'}
            <button class="icon-button modal-close-button" type="button" aria-label="Close preview" data-action="close-invoice-preview">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </header>
        <div class="invoice-modal-body invoice-modal-body--rich">
          ${
            invoice
              ? `
                <div class="invoice-document invoice-document--rich">
                  <div class="invoice-document-hero">
                    <section class="invoice-summary-brand">
                      <div class="invoice-brand-header">
                        <span class="brand-mark invoice-brand-mark" aria-hidden="true"></span>
                        <div>
                          <strong>InvoiceLens</strong>
                          <span>Finance operations workspace</span>
                        </div>
                      </div>
                      <div class="invoice-summary-contact">
                        <strong>InvoiceLens LLC</strong>
                        <p>500 Market Street, Suite 800<br />San Francisco, CA 94105<br />billing@invoicelens.com<br />(415) 555-0134</p>
                      </div>
                    </section>
                    <section class="invoice-summary-meta invoice-summary-meta--hero">
                      <div class="invoice-summary-title-row">
                        <h3>Invoice</h3>
                        ${statusChip(normalizeLabel(invoice.status))}
                      </div>
                      <div class="invoice-summary-panels">
                        <article class="invoice-summary-party invoice-summary-party--compact invoice-summary-party--invoice">
                          <h3>Invoice #</h3>
                          <strong>${escapeHtml(invoice.invoiceNumber)}</strong>
                          <div class="invoice-meta-list">
                            <div class="invoice-meta-row">
                              <span>Invoice Date</span>
                              <strong>${escapeHtml(invoiceDate)}</strong>
                            </div>
                            <div class="invoice-meta-row">
                              <span>Updated</span>
                              <strong>${escapeHtml(updatedAt)}</strong>
                            </div>
                            <div class="invoice-meta-row">
                              <span>Due Date</span>
                              <strong>${escapeHtml(dueDate)}${paymentTerms ? ` <small>(${escapeHtml(paymentTerms)})</small>` : ''}</strong>
                            </div>
                          </div>
                        </article>
                        ${renderPartyCard('Bill To', invoice.billTo.name, [invoice.billTo.addressLine1, invoice.billTo.addressLine2, `${invoice.billTo.city}, ${invoice.billTo.region} ${invoice.billTo.postalCode}`.trim(), invoice.billTo.email, invoice.billTo.phone])}
                        ${renderPartyCard('Vendor', invoice.vendorContact.name, [invoice.vendorContact.addressLine1, invoice.vendorContact.addressLine2, `${invoice.vendorContact.city}, ${invoice.vendorContact.region} ${invoice.vendorContact.postalCode}`.trim(), invoice.vendorContact.email])}
                      </div>
                    </section>
                  </div>

                  <div class="invoice-line-items">
                    <div class="invoice-line-items-head">
                      <span>Description</span>
                      <span>Qty</span>
                      <span>Rate</span>
                      <span>Amount</span>
                    </div>
                    ${
                      lineItems.length > 0
                        ? lineItems
                            .map(
                              (line) => `
                                <div class="invoice-line-item">
                                  <div class="invoice-line-description">
                                    <span class="invoice-line-badge">${line.lineNumber}</span>
                                    <div>
                                      <strong>${escapeHtml(line.description ?? 'Line item')}</strong>
                                      <span>Line ${line.lineNumber}</span>
                                    </div>
                                  </div>
                                  <span>${line.quantity}</span>
                                  <span>${formatCurrency(line.unitPrice, invoiceCurrency)}</span>
                                  <strong>${formatCurrency(line.amount, invoiceCurrency)}</strong>
                                </div>
                              `,
                            )
                            .join('')
                        : `<div class="empty-state">No line items available.</div>`
                    }
                  </div>

                  <div class="invoice-summary-footer">
                    <section class="invoice-notes">
                      <h3>Notes</h3>
                      <p>${escapeHtml(notes)}</p>
                    </section>
                    <section class="invoice-totals">
                      <div class="invoice-total-row">
                        <span>Subtotal</span>
                        <strong>${totals ? formatCurrency(totals.subtotal, invoiceCurrency) : formatCurrency(invoice.amount, invoiceCurrency)}</strong>
                      </div>
                      <div class="invoice-total-row">
                        <span>Sales Tax${totals && totals.subtotal > 0 ? ` (${((totals.tax / totals.subtotal) * 100).toFixed(2)}%)` : ''}</span>
                        <strong>${totals ? formatCurrency(totals.tax, invoiceCurrency) : formatCurrency(0, invoiceCurrency)}</strong>
                      </div>
                      <div class="invoice-total-row">
                        <span>Discount</span>
                        <strong>${totals ? formatCurrency(totals.discount, invoiceCurrency) : formatCurrency(0, invoiceCurrency)}</strong>
                      </div>
                      <div class="invoice-total-row invoice-total-row--grand">
                        <span>Total</span>
                        <strong>${totals ? formatCurrency(totals.total, invoiceCurrency) : formatCurrency(invoice.amount, invoiceCurrency)} <small>${escapeHtml(invoiceCurrency)}</small></strong>
                      </div>
                    </section>
                  </div>
                </div>
              `
              : `<div class="empty-state">${loading ? 'Loading invoice preview...' : 'No invoice selected.'}</div>`
          }
        </div>
        <footer class="invoice-modal-footer invoice-modal-footer--rich">
          <div class="modal-footer-copy">
            <span class="status-chip ${isApproved ? 'approved' : 'pending-neutral'}">${invoice ? normalizeLabel(invoice.status) : 'Pending'}</span>
            <span>${invoice ? (isApproved ? 'This invoice has been approved.' : 'Review the invoice details before approving.') : 'Select an invoice to inspect.'}</span>
          </div>
          <div class="modal-footer-actions">
            <button class="button" type="button" data-action="download-pdf">Download PDF</button>
            <button class="button" type="button" data-action="open-portal">Open Portal</button>
            <button class="button success${isApproved ? ' is-complete' : ''}" type="button" data-action="approve-invoice" ${isApproved ? 'disabled aria-disabled="true"' : ''}>${isApproved ? 'Approved' : 'Approve'}</button>
            <button class="button danger" type="button" data-action="send-back">Send Back</button>
          </div>
        </footer>
      </section>
    </div>
  `;
}

function toneClass(value: string): string {
  const normalized = value.toLowerCase();

  if (normalized.includes('approved') || normalized === 'pass') {
    return 'approved';
  }

  if (normalized.includes('pending')) {
    return 'pending';
  }

  if (normalized.includes('warning')) {
    return 'warning';
  }

  if (normalized.includes('fail') || normalized.includes('exception') || normalized.includes('sent')) {
    return 'exception';
  }

  if (normalized.includes('blue')) {
    return 'afe';
  }

  if (normalized.includes('teal')) {
    return 'verified';
  }

  return 'pending-neutral';
}

export function routeHref(route: Route, invoiceId?: string): string {
  switch (route) {
    case 'dashboard':
      return '/';
    case 'invoices':
      return invoiceId ? `/invoices/${encodeURIComponent(invoiceId)}` : '/invoices';
    case 'analytics':
      return '/analytics';
    case 'contracts':
      return '/contracts';
    case 'vendors':
      return '/vendors';
    case 'reports':
      return '/reports';
    case 'notifications':
      return '/notifications';
    case 'help':
      return '/help';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

export function pageHeader(title: string, subtitle: string, actions = ''): string {
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

export function statusChip(status: string): string {
  return `<span class="status-chip ${toneClass(status)}">${status}</span>`;
}

export function metricCards(metrics: DashboardMetric[]): string {
  return `
    <section class="kpi-grid" aria-label="Dashboard metrics">
      ${metrics
        .map(
          (metric) => `
            <article class="metric-card">
              <span class="metric-icon ${metric.tone}">${metric.icon}</span>
              <div>
                <p>${metric.label}</p>
                <strong>${metric.value}</strong>
                <small>${metric.delta}</small>
              </div>
            </article>
          `,
        )
        .join('')}
    </section>
  `;
}

export function renderQueueSummary(items: QueueSummaryItem[]): string {
  if (items.length === 0) {
    return `<div class="empty-state">No queue items found.</div>`;
  }

  return `
    <div class="queue-summary">
      ${items
        .map(
          (item) => `
            <div class="queue-row">
              <span>${item.label}</span>
              <span class="count-pill ${item.className}">${item.count}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderAlertCards(alerts: ValidationAlert[]): string {
  if (alerts.length === 0) {
    return `<div class="empty-state">No alerts available.</div>`;
  }

  return alerts
    .map(
      (alert) => `
        <article class="alert-card">
          <header>
            <span class="alert-title"><span class="alert-icon ${alert.className}">!</span>${alert.title}</span>
            <span class="count-pill ${alert.className === 'amber' ? 'orange' : alert.className}">${alert.count}</span>
          </header>
          <p>${alert.message}</p>
          <div class="alert-meta">
            <span>Example: <a href="${routeHref('invoices', alert.invoiceId)}" data-invoice-id="${alert.invoiceId}">${alert.invoiceNo}</a></span>
            <span>Amount: ${alert.amount}</span>
          </div>
        </article>
      `,
    )
    .join('');
}

export function renderInvoiceTable(rows: InvoiceSummaryDto[]): string {
  if (rows.length === 0) {
    return `<div class="empty-state">No invoices match the current search or filters. Use Clear Filters to restore the full list.</div>`;
  }

  return `
    <div class="table-wrap">
      <table aria-label="Invoice results">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>AFE / Company</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (invoice) => `
                <tr>
                  <td>
                    <div class="invoice-number-stack">
                      <a href="${routeHref('invoices', invoice.invoiceId)}" class="invoice-link" data-invoice-id="${invoice.invoiceId}">${invoice.invoiceNumber}</a>
                      <small>${invoice.invoiceId.slice(0, 8)}</small>
                    </div>
                  </td>
                  <td>
                    <div class="invoice-cell-stack">
                      <strong>${invoice.vendor}</strong>
                      <small>${invoice.currency}</small>
                    </div>
                  </td>
                  <td>
                    <div class="invoice-cell-stack">
                      <strong>${invoice.afe}</strong>
                      <small>${invoice.company}</small>
                    </div>
                  </td>
                  <td>
                    <div class="invoice-cell-stack">
                      <strong>${formatDateTime(invoice.createdAtUtc)}</strong>
                      <small>Created</small>
                    </div>
                  </td>
                  <td>
                    <div class="invoice-cell-stack">
                      <strong>${formatDateTime(invoice.updatedAtUtc)}</strong>
                      <small>Updated</small>
                    </div>
                  </td>
                  <td>
                    <div class="invoice-amount-stack">
                      <strong>${formatCurrency(invoice.amount, invoice.currency)}</strong>
                      <small>Total</small>
                    </div>
                  </td>
                  <td>${statusChip(normalizeLabel(invoice.status))}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderVendorBars(items: VendorBar[]): string {
  if (items.length === 0) {
    return `<div class="empty-state">No vendor data available.</div>`;
  }

  return `
    <div class="vendor-bars">
      ${items
        .map(
          (vendor) => `
            <div class="vendor-bar-row">
              <span>${vendor.name}</span>
              <span class="bar-track">
                <span class="bar-fill ${vendor.color}" style="width:${vendor.width}%"></span>
              </span>
              <span class="vendor-count">${vendor.count}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderQueueItems(rows: QueueRow[], selectedInvoiceId: string): string {
  if (rows.length === 0) {
    return `<div class="empty-state">No queue items match the current filters.</div>`;
  }

  return rows
    .map(
      (invoice) => `
        <a href="${routeHref('invoices', invoice.invoiceId)}" class="queue-item ${invoice.invoiceId === selectedInvoiceId ? 'selected' : ''}" data-invoice-id="${invoice.invoiceId}">
          <div class="queue-item-top">
            <div class="queue-item-title">
              <strong>${invoice.invoiceNumber}</strong>
              <small>${invoice.vendor}</small>
            </div>
            <strong>${invoice.amountText}</strong>
          </div>
          <div class="queue-item-meta">
            <span>${invoice.reason}</span>
            <span>${formatDateTime(invoice.queuedAt)}</span>
            <span>${normalizeLabel(invoice.status)}</span>
          </div>
          <div>${statusChip(normalizeLabel(invoice.status))}</div>
        </a>
      `,
    )
    .join('');
}

export function renderValidationChecklist(checks: ValidationCheckViewModel[]): string {
  if (checks.length === 0) {
    return `<div class="empty-state">No validation checks found.</div>`;
  }

  return `
    <div class="validation-list">
      ${checks
        .map(
          (check) => `
            <div class="validation-check">
              <div>
                <strong>${check.label}</strong>
                <small>${check.value}</small>
              </div>
              <span class="check-pass ${check.passed ? 'pass' : 'fail'}">${check.passed ? '✓' : '!'}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderInvoiceSummaryCard(invoice: InvoiceDetailDto): string {
  return `
    <div class="invoice-document" aria-label="Invoice summary">
      <div class="document-head">
        <div class="document-logo">
          <span class="rig-mark">⌬</span>
          <div>
            <strong>InvoiceLens</strong>
            <span>Finance operations workspace</span>
          </div>
        </div>
        <div class="document-title">
          <h2>${invoice.invoiceNumber}</h2>
          <p>${normalizeLabel(invoice.status)}</p>
        </div>
      </div>
      <div class="document-meta">
        <div>
          <h3>Vendor</h3>
          <p>${invoice.vendor}</p>
        </div>
        <div>
          <h3>Company</h3>
          <p>${invoice.company}</p>
        </div>
      </div>
      <div class="document-fields">
        <div class="document-field">
          <small>AFE</small>
          <strong>${invoice.afe}</strong>
        </div>
        <div class="document-field">
          <small>Amount</small>
          <strong>${formatCurrency(invoice.amount, invoice.currency)}</strong>
        </div>
        <div class="document-field">
          <small>Created</small>
          <strong>${formatDateTime(invoice.createdAtUtc)}</strong>
        </div>
        <div class="document-field">
          <small>Updated</small>
          <strong>${formatDateTime(invoice.updatedAtUtc)}</strong>
        </div>
      </div>
    </div>
  `;
}

export function renderInvoicePreviewModal(
  review: InvoiceReviewDto | null,
  validationSummary: ValidationSummaryDto | null,
  auditTrail: AuditEntryDto[],
  loading = false,
): string {
  const invoice = review?.invoice ?? null;
  const checklist = validationSummary?.checks.map((check) => ({
    label: check.ruleName,
    value: `${normalizeLabel(check.status)} · ${normalizeLabel(check.severity)} · ${check.message}`,
    passed: check.status.toLowerCase() === 'pass',
  })) ?? [];
  const summaryStatus = validationSummary ? normalizeLabel(validationSummary.overallStatus) : 'Pending';
  const summaryStatusChip = validationSummary ? statusChip(summaryStatus) : '<span class="status-chip pending-neutral">Pending</span>';

  return `
    <div class="invoice-modal-backdrop" data-action="close-invoice-preview">
      <section class="invoice-modal-shell" data-action="modal-shell" role="dialog" aria-modal="true" aria-labelledby="invoicePreviewTitle">
        <header class="invoice-modal-header">
          <div>
            <p class="modal-kicker">Invoice Preview</p>
            <h2 id="invoicePreviewTitle">${invoice ? invoice.invoiceNumber : 'Invoice preview'}</h2>
            <p>${invoice ? `${invoice.vendor} • ${normalizeLabel(invoice.status)}` : loading ? 'Loading invoice details...' : 'Select an invoice to inspect.'}</p>
          </div>
          <button class="icon-button modal-close-button" type="button" aria-label="Close preview" data-action="close-invoice-preview">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="invoice-modal-grid">
          <section class="invoice-modal-column">
            ${
              invoice
                ? renderInvoiceSummaryCard(invoice)
                : `<div class="empty-state">${loading ? 'Loading invoice preview...' : 'No invoice selected.'}</div>`
            }
          </section>
          <section class="invoice-modal-column">
            <section class="card">
              <div class="card-header">
                <div>
                  <h2>Review Summary</h2>
                  <p>${validationSummary ? `Executed ${formatDateTime(validationSummary.executedAt)}` : loading ? 'Preparing review summary...' : 'No validation summary available.'}</p>
                </div>
                ${summaryStatusChip}
              </div>
              <div class="review-summary-grid">
                <div class="review-summary-item">
                  <small>Invoice</small>
                  <strong>${validationSummary?.invoiceId ?? 'Pending'}</strong>
                </div>
                <div class="review-summary-item">
                  <small>Checks</small>
                  <strong>${validationSummary?.checks.length ?? 0}</strong>
                </div>
                <div class="review-summary-item">
                  <small>Audit Entries</small>
                  <strong>${auditTrail.length}</strong>
                </div>
              </div>
              <div class="review-summary-section">
                <h3>Validation Highlights</h3>
                ${validationSummary ? renderValidationChecklist(checklist) : `<div class="empty-state">${loading ? 'Loading validation highlights...' : 'No validation highlights available.'}</div>`}
              </div>
            </section>
            <section class="card">
              <div class="card-header">
                <h2>Audit Trail</h2>
                <span class="status-chip pending-neutral">${auditTrail.length}</span>
              </div>
              ${loading ? '<div class="empty-state">Loading audit trail...</div>' : renderAuditTrail(auditTrail)}
            </section>
            <div class="viewer-actions">
              <button class="button success" type="button" data-action="approve-invoice">Approve</button>
              <button class="button danger" type="button" data-action="send-back">Send Back</button>
            </div>
          </section>
        </div>
      </section>
    </div>
  `;
}

export function renderInvoiceModal(
  review: InvoiceReviewDto | null,
  loading = false,
): string {
  const invoice = review?.invoice ?? null;
  const isApproved = normalizeLabel(invoice?.status).toLowerCase() === 'approved';

  return `
    <div class="invoice-modal-backdrop" data-action="close-invoice-preview">
      <section class="invoice-modal-shell" data-action="modal-shell" role="dialog" aria-modal="true" aria-labelledby="invoicePreviewTitle">
        <header class="invoice-modal-header">
          <div>
            <p class="modal-kicker">Invoice Preview</p>
            <h2 id="invoicePreviewTitle">${invoice ? invoice.invoiceNumber : 'Invoice preview'}</h2>
            <p>${invoice ? `${invoice.vendor} • ${normalizeLabel(invoice.status)}` : loading ? 'Loading invoice details...' : 'Select an invoice to inspect.'}</p>
          </div>
          <button class="icon-button modal-close-button" type="button" aria-label="Close preview" data-action="close-invoice-preview">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="invoice-modal-body">
          ${
            invoice
              ? renderInvoiceSummaryCard(invoice)
              : `<div class="empty-state">${loading ? 'Loading invoice preview...' : 'No invoice selected.'}</div>`
          }
        </div>
        <footer class="invoice-modal-footer">
          <div class="modal-footer-copy">
            <span class="status-chip pending-neutral">${invoice ? normalizeLabel(invoice.status) : 'Pending'}</span>
          </div>
          <div class="modal-footer-actions">
            <button class="button" type="button" data-action="download-pdf">Download PDF</button>
            <button class="button" type="button" data-action="open-portal">Open Portal</button>
            <button class="button success${isApproved ? ' is-complete' : ''}" type="button" data-action="approve-invoice" ${isApproved ? 'disabled aria-disabled="true"' : ''}>${isApproved ? 'Approved' : 'Approve'}</button>
            <button class="button danger" type="button" data-action="send-back">Send Back</button>
          </div>
        </footer>
      </section>
    </div>
  `;
}

export function renderAttachmentList(attachments: string[]): string {
  if (attachments.length === 0) {
    return `<div class="empty-state">No attachments available.</div>`;
  }

  return `
    <div class="validation-list">
      ${attachments
        .map(
          (attachment) => `
            <div class="validation-check">
              <div>
                <strong>${attachment}</strong>
                <small>Stored in SQL-backed invoice attachments</small>
              </div>
              <span class="check-pass pass">✓</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderAuditTrail(entries: AuditEntryDto[]): string {
  if (entries.length === 0) {
    return `<div class="empty-state">No audit entries found.</div>`;
  }

  return `
    <div class="validation-list">
      ${entries
        .map(
          (entry) => `
            <div class="validation-check">
              <div>
                <strong>${normalizeLabel(entry.actionType)}</strong>
                <small>${entry.details}</small>
              </div>
              <span class="check-pass pass">${initials(entry.performedBy)}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export function renderRichInvoiceModal(review: InvoiceReviewDto | null, loading = false): string {
  const invoice = review?.invoice ?? null;
  const isApproved = normalizeLabel(invoice?.status).toLowerCase() === 'approved';
  const lineItems = invoice?.lineItems ?? [];
  const totals = invoice?.totals ?? null;
  const billToLines = invoice
    ? [
        invoice.billTo.name,
        invoice.billTo.addressLine1,
        invoice.billTo.addressLine2,
        `${invoice.billTo.city}, ${invoice.billTo.region} ${invoice.billTo.postalCode}`.trim(),
        invoice.billTo.email,
        invoice.billTo.phone,
      ].filter((line) => Boolean(line && line.trim()))
    : [];
  const vendorLines = invoice
    ? [
        invoice.vendorContact.name,
        invoice.vendorContact.addressLine1,
        invoice.vendorContact.addressLine2,
        `${invoice.vendorContact.city}, ${invoice.vendorContact.region} ${invoice.vendorContact.postalCode}`.trim(),
        invoice.vendorContact.email,
      ].filter((line) => Boolean(line && line.trim()))
    : [];
  const invoiceDate = invoice?.invoiceDateUtc ? formatDateTime(invoice.invoiceDateUtc) : 'Pending';
  const dueDate = invoice?.dueDateUtc ? formatDateTime(invoice.dueDateUtc) : 'Pending';
  const notes = invoice?.notes ?? 'Thank you for your business. We appreciate the opportunity to support your team.';

  return `
    <div class="invoice-modal-backdrop invoice-modal-backdrop--rich" data-action="close-invoice-preview">
      <section class="invoice-modal-shell invoice-modal-shell--rich" data-action="modal-shell" role="dialog" aria-modal="true" aria-labelledby="invoicePreviewTitle">
        <header class="invoice-modal-header invoice-modal-header--rich">
          <div class="invoice-modal-header-copy">
            <p class="modal-kicker">Invoice Preview</p>
            <h2 id="invoicePreviewTitle">${invoice ? invoice.invoiceNumber : 'Invoice preview'}</h2>
            <p>${invoice ? `${invoice.vendor} • ${normalizeLabel(invoice.status)}` : loading ? 'Loading invoice details...' : 'Select an invoice to inspect.'}</p>
          </div>
          <div class="invoice-modal-header-badges">
            ${invoice ? statusChip(normalizeLabel(invoice.status)) : '<span class="status-chip pending-neutral">Pending</span>'}
            <button class="icon-button modal-close-button" type="button" aria-label="Close preview" data-action="close-invoice-preview">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div class="invoice-modal-body invoice-modal-body--rich">
          ${
            invoice
              ? `
                <div class="invoice-document invoice-document--rich">
                  <div class="invoice-summary-grid">
                    <section class="invoice-summary-brand">
                      <div class="invoice-brand-header">
                        <div class="invoice-brand-badge">IL</div>
                        <div>
                          <strong>InvoiceLens LLC</strong>
                          <span>Finance operations workspace</span>
                        </div>
                      </div>
                      <p>500 Market Street, Suite 800<br />San Francisco, CA 94105<br />billing@invoicelens.com<br />(415) 555-0134</p>
                    </section>
                    <section class="invoice-summary-meta">
                      <div class="invoice-summary-title-row">
                        <h3>Invoice</h3>
                        ${statusChip(normalizeLabel(invoice.status))}
                      </div>
                      <div class="invoice-summary-meta-grid">
                        <div class="invoice-summary-meta-item">
                          <small>Invoice #</small>
                          <strong>${invoice.invoiceNumber}</strong>
                        </div>
                        <div class="invoice-summary-meta-item">
                          <small>Invoice Date</small>
                          <strong>${invoiceDate}</strong>
                        </div>
                        <div class="invoice-summary-meta-item">
                          <small>Updated</small>
                          <strong>${formatDateTime(invoice.updatedAtUtc)}</strong>
                        </div>
                        <div class="invoice-summary-meta-item">
                          <small>Due Date</small>
                          <strong>${dueDate}</strong>
                        </div>
                      </div>
                    </section>
                    <section class="invoice-summary-party">
                      <h3>Bill To</h3>
                      <strong>${invoice.billTo.name}</strong>
                      <p>${billToLines.slice(1).join('<br />')}</p>
                    </section>
                    <section class="invoice-summary-party">
                      <h3>Vendor</h3>
                      <strong>${invoice.vendor}</strong>
                      <p>${vendorLines.slice(1).join('<br />')}</p>
                    </section>
                  </div>

                  <div class="invoice-line-items">
                    <div class="invoice-line-items-head">
                      <span>Description</span>
                      <span>Qty</span>
                      <span>Rate</span>
                      <span>Amount</span>
                    </div>
                    ${
                      lineItems.length > 0
                        ? lineItems
                            .map(
                              (line) => `
                                <div class="invoice-line-item">
                                  <div class="invoice-line-description">
                                    <strong>${line.description ?? 'Line item'}</strong>
                                    <span>Line ${line.lineNumber}</span>
                                  </div>
                                  <span>${line.quantity}</span>
                                  <span>${formatCurrency(line.unitPrice, invoice.currency)}</span>
                                  <strong>${formatCurrency(line.amount, invoice.currency)}</strong>
                                </div>
                              `,
                            )
                            .join('')
                        : `<div class="empty-state">No line items available.</div>`
                    }
                  </div>

                  <div class="invoice-summary-footer">
                    <section class="invoice-notes">
                      <h3>Notes</h3>
                      <p>${notes}</p>
                    </section>
                    <section class="invoice-totals">
                      <div class="invoice-total-row">
                        <span>Subtotal</span>
                        <strong>${totals ? formatCurrency(totals.subtotal, invoice.currency) : formatCurrency(invoice.amount, invoice.currency)}</strong>
                      </div>
                      <div class="invoice-total-row">
                        <span>Sales Tax</span>
                        <strong>${totals ? formatCurrency(totals.tax, invoice.currency) : formatCurrency(0, invoice.currency)}</strong>
                      </div>
                      <div class="invoice-total-row">
                        <span>Discount</span>
                        <strong>${totals ? formatCurrency(totals.discount, invoice.currency) : formatCurrency(0, invoice.currency)}</strong>
                      </div>
                      <div class="invoice-total-row invoice-total-row--grand">
                        <span>Total</span>
                        <strong>${totals ? formatCurrency(totals.total, invoice.currency) : formatCurrency(invoice.amount, invoice.currency)} <small>${invoice.currency}</small></strong>
                      </div>
                    </section>
                  </div>
                </div>
              `
              : `<div class="empty-state">${loading ? 'Loading invoice preview...' : 'No invoice selected.'}</div>`
          }
        </div>
        <footer class="invoice-modal-footer invoice-modal-footer--rich">
          <div class="modal-footer-copy">
            <span class="status-chip ${isApproved ? 'approved' : 'pending-neutral'}">${invoice ? normalizeLabel(invoice.status) : 'Pending'}</span>
            <span>${invoice ? 'This invoice is fully seeded with vendor, billing, line item, and totals data.' : 'Select an invoice to inspect.'}</span>
          </div>
          <div class="modal-footer-actions">
            <button class="button" type="button" data-action="download-pdf">Download PDF</button>
            <button class="button" type="button" data-action="open-portal">Open Portal</button>
            <button class="button success${isApproved ? ' is-complete' : ''}" type="button" data-action="approve-invoice" ${isApproved ? 'disabled aria-disabled="true"' : ''}>${isApproved ? 'Approved' : 'Approve'}</button>
            <button class="button danger" type="button" data-action="send-back">Send Back</button>
          </div>
        </footer>
      </section>
    </div>
  `;
}
