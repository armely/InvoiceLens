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

export function renderAdminPage(data: AdminViewData): string {
  return `
    <section class="page active">
      ${pageHeader('Admin Settings', 'Operational snapshots from the SQL database plus a few local workspace toggles.', `
        <button class="button primary" type="button" data-action="save-settings">Save Settings</button>
      `)}

      <section class="summary-strip">
        <div class="summary-card"><small>Total Invoices</small><strong>${data.invoiceCount}</strong></div>
        <div class="summary-card"><small>Queue Items</small><strong>${data.queueCount}</strong></div>
        <div class="summary-card"><small>Approved</small><strong>${data.approvedCount}</strong></div>
        <div class="summary-card"><small>Last Updated</small><strong>${data.lastUpdated}</strong></div>
      </section>

      <section class="settings-grid">
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
