import { QueueRow, ValidationAlert } from '../shared/models.js';
import { pageHeader, renderAlertCards, renderQueueItems, renderQueueSummary, routeHref } from './shared.js';

export function renderNotificationsPage(rows: QueueRow[], alerts: ValidationAlert[], selectedInvoiceId: string): string {
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Notifications', 'Stay on top of queue movement, invoice exceptions, and validation signals.', `
            <a class="button primary" href="${routeHref('compliance-queue')}" data-route="compliance-queue">Open Queue</a>
            <a class="button" href="${routeHref('validation-summary')}" data-route="validation-summary">Open Validation</a>
          `)}
          <section class="summary-strip">
            <div class="summary-card"><small>Queue Items</small><strong>${rows.length}</strong></div>
            <div class="summary-card"><small>Validation Checks</small><strong>${alerts.length}</strong></div>
            <div class="summary-card"><small>Selected Invoice</small><strong>${selectedInvoiceId || 'None'}</strong></div>
            <div class="summary-card"><small>Workspace</small><strong>Live</strong></div>
          </section>
          <section class="card">
            <div class="card-header"><h2>Validation Results</h2><span class="status-chip pending-neutral">${alerts.length} visible</span></div>
            <div class="alert-list">${renderAlertCards(alerts)}</div>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header"><h2>Queue Feed</h2><a class="button ghost" href="${routeHref('compliance-queue')}" data-route="compliance-queue">Open queue -></a></div>
            <div class="queue-page-list">${renderQueueItems(rows.slice(0, 8), selectedInvoiceId)}</div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Alert Summary</h2></div>
            ${renderQueueSummary(
              alerts.map((alert) => ({
                label: alert.title,
                count: alert.count,
                className: alert.className === 'amber' ? 'orange' : alert.className,
              })),
            )}
          </section>
        </aside>
      </div>
    </section>
  `;
}
