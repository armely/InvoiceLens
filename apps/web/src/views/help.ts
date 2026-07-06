import { routeHref, pageHeader } from './shared.js';

export function renderHelpPage(): string {
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Help Center', 'Quick guidance for filters, routes, and common review actions.', `
            <a class="button primary" href="${routeHref('dashboard')}" data-route="dashboard">Go to Dashboard</a>
            <a class="button" href="${routeHref('admin')}" data-route="admin">Open Settings</a>
          `)}

          <section class="summary-strip">
            <div class="summary-card"><small>Search</small><strong>Global + page filters</strong></div>
            <div class="summary-card"><small>Date Range</small><strong>Preset or custom</strong></div>
            <div class="summary-card"><small>Review Flow</small><strong>Approve / Send Back</strong></div>
            <div class="summary-card"><small>Storage</small><strong>SQL-backed</strong></div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Common Tasks</h2></div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Filter invoices by exact dates</strong>
                  <small>Use the From and To date fields on the Invoices and Dashboard pages.</small>
                </div>
                <a class="button" href="${routeHref('invoices')}" data-route="invoices">Open Invoices</a>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Review queue items</strong>
                  <small>Open the compliance queue to inspect pending or returned invoices.</small>
                </div>
                <a class="button" href="${routeHref('compliance-queue')}" data-route="compliance-queue">Open Queue</a>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Validate and audit an invoice</strong>
                  <small>Use the validation summary and invoice preview modal for audit history.</small>
                </div>
                <a class="button" href="${routeHref('validation-summary')}" data-route="validation-summary">Open Validation</a>
              </div>
            </div>
          </section>
        </div>

        <aside class="side-panel">
          <section class="card">
            <div class="card-header"><h2>Navigation</h2></div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>Notifications</strong>
                  <small>Open queue alerts and recent activity.</small>
                </div>
                <a class="button" href="${routeHref('notifications')}" data-route="notifications">Open</a>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Settings</strong>
                  <small>Workspace and sync preferences.</small>
                </div>
                <a class="button" href="${routeHref('admin')}" data-route="admin">Open</a>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}
