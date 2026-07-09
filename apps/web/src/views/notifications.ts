import { QueueRow, ValidationAlert } from '../shared/models.js';
import { pageHeader, renderAlertCards, renderQueueItems, renderQueueSummary, routeHref } from './shared.js';

export function renderNotificationsPage(rows: QueueRow[], alerts: ValidationAlert[], selectedInvoiceId: string): string {
  const priorityAlerts = alerts.filter((alert) => alert.className === 'red' || alert.className === 'amber').slice(0, 6);
  const selectedQueueItem = rows.find((row) => row.invoiceId === selectedInvoiceId) ?? null;

  const queueStatusCounts = rows.reduce(
    (counts, row) => {
      const normalizedStatus = row.status.toLowerCase();

      if (normalizedStatus.includes('sent')) {
        counts.sentBack += 1;
      } else if (normalizedStatus.includes('approved')) {
        counts.approved += 1;
      } else {
        counts.pending += 1;
      }

      return counts;
    },
    { pending: 0, sentBack: 0, approved: 0 },
  );

  const queueReasonMap = new Map<string, number>();
  rows.forEach((row) => {
    queueReasonMap.set(row.reason, (queueReasonMap.get(row.reason) ?? 0) + 1);
  });

  const topQueueReasons = [...queueReasonMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      className: (['orange', 'blue', 'purple', 'red', 'teal'] as const)[index % 5],
    }));

  const alertSummary = [
    { label: 'Critical', count: alerts.filter((alert) => alert.className === 'red').length, className: 'red' as const },
    { label: 'Warning', count: alerts.filter((alert) => alert.className === 'amber').length, className: 'orange' as const },
    { label: 'Pass', count: alerts.filter((alert) => alert.className === 'teal').length, className: 'teal' as const },
    { label: 'Info', count: alerts.filter((alert) => alert.className === 'blue').length, className: 'blue' as const },
  ].filter((item) => item.count > 0);

  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Notifications', 'Stay on top of queue movement, invoice exceptions, and validation signals.', `
            <a class="button primary" href="${routeHref('dashboard')}" data-route="dashboard">Open Dashboard</a>
            <a class="button" href="${routeHref('invoices')}" data-route="invoices">Open Invoices</a>
          `)}
          <section class="summary-strip">
            <div class="summary-card"><small>Queue Items</small><strong>${rows.length}</strong></div>
            <div class="summary-card"><small>Active Alerts</small><strong>${alerts.length}</strong></div>
            <div class="summary-card"><small>Needs Review</small><strong>${queueStatusCounts.pending}</strong></div>
            <div class="summary-card"><small>Selected Invoice</small><strong>${selectedQueueItem?.invoiceNumber ?? 'None'}</strong></div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Priority Alerts</h2><span class="status-chip exception">${priorityAlerts.length} urgent</span></div>
            <div class="alert-list">${renderAlertCards(priorityAlerts.length > 0 ? priorityAlerts : alerts.slice(0, 6))}</div>
          </section>

          <section class="content-row">
            <section class="card">
              <div class="card-header"><h2>Validation Results</h2><span class="status-chip pending-neutral">${alerts.length} visible</span></div>
              <div class="alert-list">${renderAlertCards(alerts)}</div>
            </section>

            <section class="card">
              <div class="card-header"><h2>Queue Status Breakdown</h2></div>
              ${renderQueueSummary(
                [
                  { label: 'Pending Review', count: queueStatusCounts.pending, className: 'orange' as const },
                  { label: 'Sent Back', count: queueStatusCounts.sentBack, className: 'red' as const },
                  { label: 'Approved', count: queueStatusCounts.approved, className: 'teal' as const },
                ].filter((item) => item.count > 0),
              )}
            </section>
          </section>

          <section class="card">
            <div class="card-header"><h2>Top Queue Reasons</h2><span class="status-chip pending-neutral">${topQueueReasons.length} tracked</span></div>
            ${renderQueueSummary(topQueueReasons)}
          </section>

          <section class="summary-strip">
            <div class="summary-card"><small>Sent Back</small><strong>${queueStatusCounts.sentBack}</strong></div>
            <div class="summary-card"><small>Approved</small><strong>${queueStatusCounts.approved}</strong></div>
            <div class="summary-card"><small>Critical Alerts</small><strong>${alerts.filter((alert) => alert.className === 'red').length}</strong></div>
            <div class="summary-card"><small>Workspace</small><strong>Live</strong></div>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header"><h2>Queue Feed</h2></div>
            <div class="queue-page-list">${renderQueueItems(rows.slice(0, 8), selectedInvoiceId)}</div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Alert Summary</h2></div>
            ${renderQueueSummary(alertSummary)}
          </section>

          <section class="card">
            <div class="card-header"><h2>Selected Invoice Context</h2></div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Invoice</strong>
                  <small>${selectedQueueItem?.invoiceNumber ?? 'No invoice selected'}</small>
                </div>
                <span class="status-chip pending-neutral">${selectedQueueItem ? 'Active' : 'None'}</span>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Vendor</strong>
                  <small>${selectedQueueItem?.vendor ?? 'N/A'}</small>
                </div>
                <strong>${selectedQueueItem?.amountText ?? '-'}</strong>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Queue Reason</strong>
                  <small>${selectedQueueItem?.reason ?? 'N/A'}</small>
                </div>
                <span class="status-chip pending-neutral">${selectedQueueItem?.status ?? 'N/A'}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}
