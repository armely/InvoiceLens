import { QueueRow, ValidationAlert } from '../shared/models.js';
import { formatDateTime } from '../shared/utils.js';
import { pageHeader, routeHref } from './shared.js';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  amount: string;
  invoiceId: string;
  invoiceNo: string;
  queuedAt: string;
  severity: 'critical' | 'warning' | 'info';
  isRead: boolean;
};

function notificationId(alert: ValidationAlert): string {
  return `${alert.invoiceId}:${alert.title}`;
}

export function renderNotificationsPage(rows: QueueRow[], alerts: ValidationAlert[], readNotificationIds: string[]): string {
  const readSet = new Set(readNotificationIds);
  const queueByInvoiceId = new Map(rows.map((row) => [row.invoiceId, row]));

  const notifications: NotificationItem[] = alerts.map((alert) => {
    const row = queueByInvoiceId.get(alert.invoiceId);
    const severity: NotificationItem['severity'] = alert.className === 'red' ? 'critical' : alert.className === 'amber' ? 'warning' : 'info';

    return {
      id: notificationId(alert),
      title: alert.title,
      message: alert.message,
      amount: alert.amount,
      invoiceId: alert.invoiceId,
      invoiceNo: alert.invoiceNo,
      queuedAt: row?.queuedAt ?? '',
      severity,
      isRead: readSet.has(notificationId(alert)),
    };
  });

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const readCount = notifications.length - unreadCount;

  return `
    <section class="page active notifications-page">
      <div class="workspace">
        ${pageHeader('Notifications', 'Review alerts and mark them as read.', `
          <button class="button" type="button" data-action="mark-all-notifications-read" ${notifications.length === 0 ? 'disabled' : ''}>Mark all as read</button>
          <a class="button" href="${routeHref('invoices')}" data-route="invoices">Open Invoices</a>
        `)}

        <section class="summary-strip">
          <div class="summary-card"><small>Total</small><strong>${notifications.length}</strong></div>
          <div class="summary-card"><small>Unread</small><strong>${unreadCount}</strong></div>
          <div class="summary-card"><small>Read</small><strong>${readCount}</strong></div>
          <div class="summary-card"><small>Status</small><strong>${unreadCount > 0 ? 'Action Needed' : 'All Clear'}</strong></div>
        </section>

        <section class="card notifications-card">
          <div class="card-header">
            <h2>Notification Inbox</h2>
            <span class="status-chip pending-neutral">${unreadCount} unread</span>
          </div>

          ${notifications.length === 0 ? '<div class="empty-state">No notifications right now.</div>' : `
            <div class="notifications-list">
              ${notifications
                .map(
                  (item) => `
                    <article class="notification-item ${item.isRead ? 'is-read' : ''}" data-notification-id="${item.id}">
                      <div class="notification-main">
                        <div class="notification-title-row">
                          <span class="notification-dot ${item.severity}"></span>
                          <strong>${item.title}</strong>
                          <span class="status-chip ${item.severity === 'critical' ? 'exception' : item.severity === 'warning' ? 'pending' : 'blue'}">${item.severity}</span>
                        </div>
                        <p>${item.message}</p>
                        <div class="notification-meta">
                          <a href="${routeHref('invoices', item.invoiceId)}" data-invoice-id="${item.invoiceId}">${item.invoiceNo}</a>
                          <span>${item.amount}</span>
                          <span>${item.queuedAt ? formatDateTime(item.queuedAt) : 'N/A'}</span>
                        </div>
                      </div>
                      <div class="notification-actions">
                        <button class="button" type="button" data-action="mark-notification-read" data-notification-id="${item.id}" ${item.isRead ? 'disabled' : ''}>Mark as read</button>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `}
        </section>
      </div>
    </section>
  `;
}
