import { AdminViewData, AuthProfile } from '../shared/models.js';
import { formatDateTime, normalizeLabel } from '../shared/utils.js';
import { pageHeader } from './shared.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detailRow(label: string, value: string | null | undefined, fallback = 'Not provided'): string {
  const display = value && value.trim() ? escapeHtml(value.trim()) : fallback;
  return `
            <div class="settings-row">
              <div>
                <strong>${label}</strong>
                <small>${display}</small>
              </div>
            </div>`;
}

function renderUserDetails(profile: AuthProfile | null): string {
  const body = profile
    ? `
            ${detailRow('Full name', profile.displayName)}
            ${detailRow('Email', profile.email)}
            ${detailRow('Role / Position', profile.jobTitle)}
            ${detailRow('Department', profile.department)}
            ${detailRow('Office', profile.officeLocation)}`
    : `
            <div class="settings-row">
              <div>
                <strong>Not signed in</strong>
                <small>Sign in with your Microsoft account to see your full profile details.</small>
              </div>
            </div>`;

  return `
        <article class="card">
          <div class="card-header"><h2>User Details</h2><p>Your full Microsoft account profile.</p></div>
          <div class="settings-list">${body}
          </div>
        </article>`;
}

function renderNotificationSettings(data: AdminViewData): string {
  const controlsDisabledClass = data.emailAlertsEnabled ? '' : 'disabled';

  return `
        <article class="card">
          <div class="card-header"><h2>Email Alerts</h2><p>Get notified when important system events happen.</p></div>
          <div class="settings-list">
            <div class="settings-row">
              <div>
                <strong>Enable email alerts</strong>
                <small>Turn on operational notifications for this workspace.</small>
              </div>
              <button class="switch ${data.emailAlertsEnabled ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="email-alerts-enabled" aria-pressed="${String(data.emailAlertsEnabled)}" aria-label="Toggle email alerts"></button>
            </div>
            <div class="settings-row ${controlsDisabledClass}">
              <div>
                <strong>Notification destination</strong>
                <small>${escapeHtml(data.notificationTargetEmail)}</small>
              </div>
              <span class="status-chip pending-neutral">Microsoft profile</span>
            </div>
            <div class="settings-row ${controlsDisabledClass}">
              <div>
                <strong>Sync failure alerts</strong>
                <small>Send an email when backend sync reports errors.</small>
              </div>
              <button class="switch ${data.emailAlertSyncFailures ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="email-alert-sync-failures" aria-pressed="${String(data.emailAlertSyncFailures)}" aria-label="Toggle sync failure alerts" ${data.emailAlertsEnabled ? '' : 'disabled'}></button>
            </div>
            <div class="settings-row ${controlsDisabledClass}">
              <div>
                <strong>Queue backlog alerts</strong>
                <small>Send an email when pending queue items spike.</small>
              </div>
              <button class="switch ${data.emailAlertQueueBacklog ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="email-alert-queue-backlog" aria-pressed="${String(data.emailAlertQueueBacklog)}" aria-label="Toggle queue backlog alerts" ${data.emailAlertsEnabled ? '' : 'disabled'}></button>
            </div>
            <div class="settings-row ${controlsDisabledClass}">
              <div>
                <strong>Approval change alerts</strong>
                <small>Send an email when invoice approvals are changed.</small>
              </div>
              <button class="switch ${data.emailAlertApprovalChanges ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="email-alert-approval-changes" aria-pressed="${String(data.emailAlertApprovalChanges)}" aria-label="Toggle approval change alerts" ${data.emailAlertsEnabled ? '' : 'disabled'}></button>
            </div>
            <div class="settings-actions">
              <button class="button" type="button" data-action="send-test-email-alert" ${data.emailAlertsEnabled ? '' : 'disabled'}>Send Test Alert</button>
            </div>
          </div>
        </article>`;
}

export function renderAdminPage(data: AdminViewData): string {
  return `
    <section class="page active">
      ${pageHeader('Admin Settings', 'Manage workspace behavior and notifications in one place.', `
        <button class="button primary" type="button" data-action="save-settings">Save Settings</button>
      `)}

      <section class="settings-grid admin-settings-grid">
        ${renderUserDetails(data.profile)}

        <article class="card">
          <div class="card-header"><h2>Sync Status</h2><p>Live status from the backend service.</p></div>
          <div class="settings-list">
            <div class="settings-row">
              <div>
                <strong>Current Status</strong>
                <small>${data.syncStatus ? normalizeLabel(data.syncStatus.status) : 'Loading'}</small>
              </div>
              <span class="status-chip ${data.syncStatus?.status.toLowerCase().includes('healthy') ? 'approved' : 'exception'}">${data.syncStatus ? normalizeLabel(data.syncStatus.status) : 'Pending'}</span>
            </div>
            <div class="settings-row">
              <div>
                <strong>Last Successful Sync</strong>
                <small>${data.syncStatus ? formatDateTime(data.syncStatus.lastSuccessfulRunUtc) : 'Pending'}</small>
              </div>
              <span class="status-chip pending-neutral">${data.syncStatus ? `${data.syncStatus.pendingItems} pending` : '0 pending'}</span>
            </div>
            <div class="settings-row">
              <div>
                <strong>Failed Items</strong>
                <small>Invoices or batches that need a closer look</small>
              </div>
              <span class="status-chip exception">${data.syncStatus?.failedItems ?? 0}</span>
            </div>
          </div>
        </article>

        ${renderNotificationSettings(data)}

        <article class="card">
          <div class="card-header"><h2>Workspace Preferences</h2><p>Local-only toggles for the browser experience.</p></div>
          <div class="settings-list">
            <div class="settings-row">
              <div>
                <strong>Compact typography</strong>
                <small>Use the smaller, cleaner UI scale</small>
              </div>
              <button class="switch ${data.compactTypography ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="compact-typography" aria-pressed="${String(data.compactTypography)}" aria-label="Toggle typography"></button>
            </div>
            <div class="settings-row">
              <div>
                <strong>Queue auto-scroll</strong>
                <small>Keep the active queue item in view</small>
              </div>
              <button class="switch ${data.queueAutoScroll ? 'active' : ''}" type="button" data-action="toggle-switch" data-setting="queue-auto-scroll" aria-pressed="${String(data.queueAutoScroll)}" aria-label="Toggle queue auto-scroll"></button>
            </div>
          </div>
        </article>
      </section>
    </section>
  `;
}
