import { routeHref, pageHeader } from './shared.js';

export function renderHelpPage(): string {
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          ${pageHeader('Help Center', 'Quick guidance for filters, usage, and the simplest deployment path.', `
            <a class="button primary" href="${routeHref('dashboard')}" data-route="dashboard">Go to Dashboard</a>
            <a class="button" href="${routeHref('admin')}" data-route="admin">Open Settings</a>
          `)}

          <section class="summary-strip">
            <div class="summary-card"><small>Search</small><strong>Global + page filters</strong></div>
            <div class="summary-card"><small>Date Range</small><strong>Preset or custom</strong></div>
            <div class="summary-card"><small>Workspace</small><strong>Backend + frontend App Services</strong></div>
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
                  <strong>Open the dashboard</strong>
                  <small>Use the dashboard for the live summary and operational signals.</small>
                </div>
                <a class="button" href="${routeHref('dashboard')}" data-route="dashboard">Open Dashboard</a>
              </div>
              <div class="settings-row">
                <div>
                  <strong>Check notifications</strong>
                  <small>Review recent alerts and queue activity in the notifications view.</small>
                </div>
                <a class="button" href="${routeHref('notifications')}" data-route="notifications">Open Notifications</a>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header"><h2>Install / Deploy</h2></div>
            <div class="settings-list">
              <div class="settings-row">
                <div>
                  <strong>1. Deploy Azure resources</strong>
                  <small>Run <code>pwsh ./infra/bicep/scripts/deploy-dev.ps1</code> to create the backend and frontend App Services.</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>2. Build and push images</strong>
                  <small>Build the API image from <code>src/InvoiceLens.Api/Dockerfile</code> and the web image from <code>apps/web/Dockerfile</code>.</small>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <strong>3. Set the published redirect URI</strong>
                  <small>Use the Azure web app URL in Entra, not the local <code>http://localhost:4200/</code> value.</small>
                </div>
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
