import { ApiAuthorizationError, InvoiceLensApiClient } from './shared/api.js';
import { clearMicrosoftAuth, getCurrentAuthProfile, initializeMicrosoftAuth, restorePostLoginRoute, signOutMicrosoft, startMicrosoftSignIn } from './shared/auth.js';
import {
  AdminViewData,
  AppState,
  AuditEntryDto,
  ComparisonFieldViewModel,
  ComparisonViewData,
  DashboardMetric,
  DashboardViewData,
  InvoiceComparisonResultDto,
  InvoiceComparisonRunDto,
  InvoiceReviewDto,
  LocalInvoiceFileDto,
  InvoiceSummaryDto,
  QueueItemDto,
  QueueRow,
  QueueSummaryItem,
  ReviewViewData,
  Route,
  SyncStatusDto,
  ValidationAlert,
  ValidationCheckViewModel,
  ValidationSummaryDto,
  ValidationSummaryViewData,
  VendorBar,
} from './shared/models.js';
import { applyInvoiceFilters, formatCurrency, formatDateTime, invoiceStatusTone, normalizeLabel } from './shared/utils.js';
import { renderAdminPage } from './views/admin.js';
import { renderComparisonPage } from './views/comparison.js';
import { renderComplianceQueuePage } from './views/compliance-queue.js';
import { renderDashboard } from './views/dashboard.js';
import { renderHelpPage } from './views/help.js';
import { renderInvoicesPage } from './views/invoices.js';
import { renderNotificationsPage } from './views/notifications.js';
import { renderInvoicePreviewModalRich } from './views/shared.js';
import { renderValidationSummaryPage } from './views/validation-summary.js';

type ReviewBundle = {
  review: InvoiceReviewDto | null;
  validationSummary: ValidationSummaryDto | null;
  auditTrail: AuditEntryDto[];
};

const api = new InvoiceLensApiClient(window.location.origin);
const compactTypographyStorageKey = 'InvoiceLens:compactTypography';
const queueAutoScrollStorageKey = 'InvoiceLens:queueAutoScroll';
const comparisonSelectionStorageKey = 'InvoiceLens:selectedComparisonLocalInvoiceId';
const userRoleLabel = 'Finance Operations';

const state: AppState = {
  route: 'dashboard',
  selectedInvoiceId: '',
  selectedComparisonLocalInvoiceId: 0,
  comparisonDetailFieldIndex: null,
  invoicePreviewOpen: false,
  search: '',
  sidebarCollapsed: true,
  dashboardDateRange: 'Last 30 Days',
  dashboardDateFrom: '',
  dashboardDateTo: '',
  invoiceStatusFilter: 'All Statuses',
  invoiceDateRange: 'All Time',
  invoiceDateFrom: '',
  invoiceDateTo: '',
  queueSort: 'Oldest First',
  compactTypography: true,
  queueAutoScroll: true,
  comparisonLoading: false,
  comparisonError: null,
  loading: true,
  error: null,
};

const store = {
  invoices: [] as InvoiceSummaryDto[],
  localInvoices: [] as LocalInvoiceFileDto[],
  queue: [] as QueueItemDto[],
  queueRows: [] as QueueRow[],
  syncStatus: null as SyncStatusDto | null,
  comparisonRun: null as InvoiceComparisonRunDto | null,
  selected: new Map<string, ReviewBundle>(),
};

const routePaths: Record<Route, string> = {
  dashboard: '/',
  invoices: '/invoices',
  comparison: '/comparison',
  'compliance-queue': '/compliance-queue',
  'validation-summary': '/validation-summary',
  notifications: '/notifications',
  help: '/help',
  admin: '/admin',
};
const routeStorageKey = 'InvoiceLens:lastRoute';
const appDebugStorageKey = 'InvoiceLens:debug-auth';

const appShellElement = document.querySelector<HTMLElement>('.app-shell');
const sidebarToggleButton = document.querySelector<HTMLButtonElement>('.sidebar-toggle');
const profileButton = document.querySelector<HTMLButtonElement>('.profile-button');
const profileAvatar = document.querySelector<HTMLElement>('.profile-avatar');
const profileAvatarImage = document.querySelector<HTMLImageElement>('.profile-avatar-image');
const profileAvatarFallback = document.querySelector<HTMLElement>('.profile-avatar-fallback');
const profileName = document.querySelector<HTMLElement>('.profile-copy strong');
const profileRole = document.querySelector<HTMLElement>('.profile-copy small');
const pageHostElement = document.getElementById('pageHost');
const globalSearchElement = document.getElementById('globalSearch');
const globalSearchForm = document.querySelector<HTMLFormElement>('.global-search');
const toastElement = document.getElementById('toast');

if (!appShellElement || !pageHostElement || !globalSearchElement || !toastElement) {
  throw new Error('InvoiceLens web shell is missing required elements.');
}

const appShell = appShellElement;
const pageHost = pageHostElement as HTMLElement;
const globalSearch = globalSearchElement as HTMLInputElement;
const toast = toastElement;

let toastTimer: number | undefined;
let bootstrapping = false;

function isAppDebugEnabled(): boolean {
  try {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true;
    }

    return window.localStorage.getItem(appDebugStorageKey) === 'true';
  } catch {
    return false;
  }
}

function appDebug(message: string, details?: Record<string, unknown>): void {
  if (!isAppDebugEnabled()) {
    return;
  }

  if (details) {
    console.info(`[InvoiceLens app] ${message}`, details);
    return;
  }

  console.info(`[InvoiceLens app] ${message}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
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

function setAuthState(isAuthenticated: boolean): void {
  document.body.dataset['authState'] = isAuthenticated ? 'signed-in' : 'signed-out';
  appShell.dataset['authState'] = isAuthenticated ? 'signed-in' : 'signed-out';
}

function setBootstrapState(isReady: boolean): void {
  document.body.dataset['bootstrapState'] = isReady ? 'ready' : 'pending';
}

function isWorkspaceLocked(): boolean {
  return document.body.dataset['authState'] !== 'signed-in';
}

function readBooleanSetting(storageKey: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return fallback;
    }

    return raw === 'true';
  } catch {
    return fallback;
  }
}

function persistBooleanSetting(storageKey: string, value: boolean): void {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    // Keep the in-memory state if storage is unavailable.
  }
}

function loadWorkspaceSettings(): void {
  state.compactTypography = readBooleanSetting(compactTypographyStorageKey, true);
  state.queueAutoScroll = readBooleanSetting(queueAutoScrollStorageKey, true);
  state.selectedComparisonLocalInvoiceId = readNumberSetting(comparisonSelectionStorageKey, 0);
}

function applyWorkspaceSettings(): void {
  appShell.dataset['density'] = state.compactTypography ? 'compact' : 'comfortable';
  document.body.dataset['density'] = state.compactTypography ? 'compact' : 'comfortable';
}

function persistWorkspaceSettings(): void {
  persistBooleanSetting(compactTypographyStorageKey, state.compactTypography);
  persistBooleanSetting(queueAutoScrollStorageKey, state.queueAutoScroll);
  persistNumberSetting(comparisonSelectionStorageKey, state.selectedComparisonLocalInvoiceId);
  applyWorkspaceSettings();
}

function readNumberSetting(storageKey: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function persistNumberSetting(storageKey: string, value: number): void {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    // Keep the in-memory state if storage is unavailable.
  }
}

function syncProfile(profile = getCurrentAuthProfile()): void {
  if (!profileButton || !profileAvatar || !profileAvatarImage || !profileAvatarFallback || !profileName || !profileRole) {
    return;
  }

  if (profile) {
    setAuthState(true);
    appDebug('Rendering signed-in profile.', {
      displayName: profile.displayName,
      initials: profile.initials,
      hasEmail: Boolean(profile.email),
      hasPhoto: Boolean(profile.photoDataUrl),
    });
    if (profile.photoDataUrl) {
      profileAvatarFallback.textContent = '';
      profileAvatarImage.src = profile.photoDataUrl;
      profileAvatarImage.hidden = false;
      profileAvatarFallback.hidden = true;
      profileAvatar.setAttribute('aria-label', `${profile.displayName} profile photo`);
      profileAvatarImage.onerror = () => {
        profileAvatarImage.hidden = true;
        profileAvatarFallback.hidden = false;
        profileAvatarFallback.textContent = profile.initials || 'IN';
        profileAvatar.setAttribute('aria-label', `${profile.displayName} initials`);
      };
    } else {
      profileAvatarImage.removeAttribute('src');
      profileAvatarImage.hidden = true;
      profileAvatarFallback.hidden = false;
      profileAvatarFallback.textContent = profile.initials || 'IN';
      profileAvatar.setAttribute('aria-label', `${profile.displayName} initials`);
    }
    profileName.textContent = profile.displayName;
    profileRole.textContent = profile.email || userRoleLabel;
    profileButton.setAttribute('aria-label', `Signed in as ${profile.displayName}`);
  } else {
    setAuthState(false);
    appDebug('Rendering signed-out profile.');
    profileAvatarImage.removeAttribute('src');
    profileAvatarImage.hidden = true;
    profileAvatarFallback.hidden = false;
    profileAvatarFallback.textContent = 'IN';
    profileAvatarImage.onerror = null;
    profileName.textContent = 'Sign in';
    profileRole.textContent = 'Microsoft account';
    profileButton.setAttribute('aria-label', 'Sign in with Microsoft');
  }
}

function buildRouteUrl(route: Route, invoiceId = '', invoicePreviewOpen = false): string {
  if (route === 'invoices' && invoicePreviewOpen && invoiceId) {
    return invoiceId ? `/invoices/${encodeURIComponent(invoiceId)}` : '/invoices';
  }

  return routePaths[route];
}

function readRouteFromLocation(): {
  route: Route;
  selectedInvoiceId: string;
  invoicePreviewOpen: boolean;
} {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  let storedRoute: Route | null = null;
  let selectedInvoiceId = '';

  if (pathname === '/invoices' || pathname.startsWith('/invoices/')) {
    const queryInvoiceId = new URLSearchParams(window.location.search).get('invoiceId') ?? '';
    const maybeInvoiceId = pathname.startsWith('/invoices/') ? pathname.slice('/invoices/'.length) : '';
    const selected = decodeURIComponent(maybeInvoiceId || queryInvoiceId);
    return {
      route: 'invoices',
      selectedInvoiceId: selected,
      invoicePreviewOpen: Boolean(selected),
    };
  }

  if (pathname === '/comparison') {
    return {
      route: 'comparison',
      selectedInvoiceId: '',
      invoicePreviewOpen: false,
    };
  }

  const routeEntry = (Object.entries(routePaths) as Array<[Route, string]>).find(([, routePath]) => routePath === pathname);

  try {
    storedRoute = window.sessionStorage.getItem(routeStorageKey) as Route | null;
  } catch {
    storedRoute = null;
  }

  const route = routeEntry?.[0] ?? storedRoute ?? 'dashboard';

  return { route, selectedInvoiceId, invoicePreviewOpen: false };
}

function syncBrowserLocation(route: Route, selectedInvoiceId = '', replace = false, invoicePreviewOpen = false): void {
  const nextUrl = buildRouteUrl(route, selectedInvoiceId, invoicePreviewOpen);
  const currentUrl = `${window.location.pathname}${window.location.search}`;

  if (currentUrl === nextUrl) {
    try {
      window.sessionStorage.setItem(routeStorageKey, route);
    } catch {
      // Ignore storage failures and keep the URL state authoritative.
    }
    return;
  }

  if (replace) {
    window.history.replaceState({ route, selectedInvoiceId }, '', nextUrl);
  } else {
    window.history.pushState({ route, selectedInvoiceId }, '', nextUrl);
  }

  try {
    window.sessionStorage.setItem(routeStorageKey, route);
  } catch {
    // Ignore storage failures and keep the URL state authoritative.
  }
}

function navigateTo(route: Route, selectedInvoiceId = state.selectedInvoiceId, replace = false): void {
  if (isWorkspaceLocked()) {
    return;
  }

  state.route = route;
  state.invoicePreviewOpen = false;

  if (state.route === 'invoices') {
    state.selectedInvoiceId = selectedInvoiceId || store.invoices[0]?.invoiceId ?? state.selectedInvoiceId;
  }

  syncBrowserLocation(state.route, state.route === 'invoices' ? state.selectedInvoiceId : '', replace, false);
  render();

  if (state.route === 'comparison') {
    const selectedComparisonInvoice = getSelectedComparisonInvoice();
    if (selectedComparisonInvoice) {
      persistComparisonSelection(selectedComparisonInvoice.localInvoiceFileId);
      void loadComparisonRun(selectedComparisonInvoice.localInvoiceFileId).then(() => {
        if (!state.loading && !state.error) {
          render();
        }
      });
    }
  }
}

globalSearchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
});

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function buildInvoiceLookup(): Map<string, InvoiceSummaryDto> {
  return new Map(store.invoices.map((invoice) => [invoice.invoiceId, invoice]));
}

function buildQueueRows(): QueueRow[] {
  const invoiceLookup = buildInvoiceLookup();

  return store.queue.map((item) => {
    const invoice = invoiceLookup.get(item.invoiceId);
    const amount = invoice?.amount ?? 0;
    const currency = invoice?.currency ?? 'USD';

    return {
      invoiceId: item.invoiceId,
      invoiceNumber: item.invoiceNumber,
      vendor: item.vendor,
      reason: item.reason,
      queuedAt: item.queuedAt,
      amount,
      amountText: formatCurrency(amount, currency),
      status: invoice?.status ?? 'PendingReview',
      statusTone: invoiceStatusTone(invoice?.status ?? 'PendingReview'),
    };
  });
}

function buildQueueSummary(rows: QueueRow[]): QueueSummaryItem[] {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    totals.set(row.reason, (totals.get(row.reason) ?? 0) + 1);
  });

  const palette: QueueSummaryItem['className'][] = ['orange', 'blue', 'purple', 'red', 'teal'];
  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label, count], index) => ({
      label,
      count,
      className: palette[index % palette.length],
    }));
}

function validationAlertTone(status: string | null | undefined, severity: string | null | undefined): ValidationAlert['className'] {
  const normalizedStatus = normalizeLabel(status ?? '').toLowerCase();
  const normalizedSeverity = normalizeLabel(severity ?? '').toLowerCase();

  if (normalizedStatus.includes('fail') || normalizedSeverity.includes('high')) {
    return 'red';
  }

  if (normalizedStatus.includes('warning') || normalizedSeverity.includes('medium')) {
    return 'amber';
  }

  if (normalizedStatus.includes('pass')) {
    return 'teal';
  }

  return 'blue';
}

function buildValidationAlerts(bundle: ReviewBundle | null): ValidationAlert[] {
  const review = bundle?.review ?? null;
  const summary = bundle?.validationSummary ?? null;

  if (!review || !summary) {
    return [];
  }

  return summary.checks.map((check) => ({
    title: check.ruleName,
    count: 1,
    className: validationAlertTone(check.status, check.severity),
    message: check.message,
    invoiceId: review.invoice.invoiceId,
    invoiceNo: review.invoice.invoiceNumber,
    amount: formatCurrency(review.invoice.amount, review.invoice.currency),
  }));
}

function buildVendorBars(rows: QueueRow[]): VendorBar[] {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    groups.set(row.vendor, (groups.get(row.vendor) ?? 0) + 1);
  });

  const max = Math.max(...groups.values(), 1);
  const colors: VendorBar['color'][] = ['red', 'orange', '', 'teal', 'green'];

  return [...groups.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count], index) => ({
      name,
      count,
      width: Math.max(20, Math.round((count / max) * 100)),
      color: colors[index % colors.length],
    }));
}

function getFilteredDashboardInvoices(): InvoiceSummaryDto[] {
  return applyInvoiceFilters(store.invoices, {
    search: state.search,
    dateRange: state.dashboardDateRange,
    dateFrom: state.dashboardDateFrom,
    dateTo: state.dashboardDateTo,
    sort: 'Newest First',
  });
}

function buildFilteredDashboardMetrics(invoices: InvoiceSummaryDto[]): DashboardMetric[] {
  const approved = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const pending = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Pending Review').length;
  const sentBack = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Sent Back').length;

  return [
    { label: 'Total Invoices', value: String(invoices.length), delta: 'Filtered dashboard view', tone: 'blue', icon: 'â—Œ' },
    { label: 'Pending Review', value: String(pending), delta: `${store.queueRows.length} queued items`, tone: 'amber', icon: 'â—·' },
    { label: 'Sent Back', value: String(sentBack), delta: 'Returned for correction', tone: 'red', icon: 'â–³' },
    { label: 'Approved', value: String(approved), delta: 'Ready for downstream sync', tone: 'green', icon: 'âœ“' },
  ];
}

function buildDashboardMetrics(invoices: InvoiceSummaryDto[], filtered = false): DashboardMetric[] {
  const approved = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const pending = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Pending Review').length;
  const sentBack = invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Sent Back').length;

  return [
    {
      label: 'Total Invoices',
      value: String(invoices.length),
      delta: filtered ? 'Filtered dashboard view' : 'Live from SQL',
      tone: 'blue',
      icon: '&#9676;',
    },
    {
      label: 'Pending Review',
      value: String(pending),
      delta: `${store.queueRows.length} queued items`,
      tone: 'amber',
      icon: '&#9711;',
    },
    {
      label: 'Sent Back',
      value: String(sentBack),
      delta: 'Returned for correction',
      tone: 'red',
      icon: '&#9651;',
    },
    {
      label: 'Approved',
      value: String(approved),
      delta: 'Ready for downstream sync',
      tone: 'green',
      icon: '&#10003;',
    },
  ];
}

function buildMetrics(): DashboardMetric[] {
  const approved = store.invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length;
  const pending = store.invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Pending Review').length;
  const sentBack = store.invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Sent Back').length;

  return [
    { label: 'Total Invoices', value: String(store.invoices.length), delta: 'Live from SQL', tone: 'blue', icon: '◌' },
    { label: 'Pending Review', value: String(pending), delta: `${store.queueRows.length} queued items`, tone: 'amber', icon: '◷' },
    { label: 'Sent Back', value: String(sentBack), delta: 'Returned for correction', tone: 'red', icon: '△' },
    { label: 'Approved', value: String(approved), delta: 'Ready for downstream sync', tone: 'green', icon: '✓' },
  ];
}

function buildDashboardData(): DashboardViewData {
  const filteredInvoices = getFilteredDashboardInvoices();
  const selectedReviewBundle = getSelectedReviewBundle();

  return {
    metrics: buildDashboardMetrics(filteredInvoices, true),
    queueSummary: buildQueueSummary(store.queueRows),
    validationAlerts: buildValidationAlerts(selectedReviewBundle),
    vendorBars: buildVendorBars(store.queueRows),
    recentInvoices: store.invoices,
    filteredInvoices,
    search: state.search,
    dashboardDateRange: state.dashboardDateRange,
    dashboardDateFrom: state.dashboardDateFrom,
    dashboardDateTo: state.dashboardDateTo,
  };
}

function getSelectedReviewBundle(): ReviewBundle | null {
  return store.selected.get(state.selectedInvoiceId) ?? null;
}

function buildReviewViewData(): ReviewViewData {
  const selected = getSelectedReviewBundle();

  return {
    queueRows: store.queueRows,
    review: selected?.review ?? null,
    validationSummary: selected?.validationSummary ?? null,
    auditTrail: selected?.auditTrail ?? [],
  };
}

function buildValidationChecklist(summary: ValidationSummaryDto | null): ValidationCheckViewModel[] {
  return summary?.checks.map((check) => ({
    label: check.ruleName,
    value: `${normalizeLabel(check.status)} · ${normalizeLabel(check.severity)} · ${check.message}`,
    passed: check.status.toLowerCase() === 'pass',
  })) ?? [];
}

function buildValidationViewData(): ValidationSummaryViewData {
  const selected = getSelectedReviewBundle();
  const validationSummary = selected?.validationSummary ?? null;

  return {
    review: selected?.review ?? null,
    validationSummary,
    checklist: buildValidationChecklist(validationSummary),
    validationAlerts: buildValidationAlerts(selected),
    auditTrail: selected?.auditTrail ?? [],
  };
}

function buildAdminData(): AdminViewData {
  const selectedInvoice = store.invoices.find((invoice) => invoice.invoiceId === state.selectedInvoiceId) ?? store.invoices[0];

  return {
    syncStatus: store.syncStatus,
    invoiceCount: store.invoices.length,
    queueCount: store.queueRows.length,
    approvedCount: store.invoices.filter((invoice) => normalizeLabel(invoice.status) === 'Approved').length,
    selectedInvoiceId: state.selectedInvoiceId,
    selectedInvoiceStatus: selectedInvoice ? normalizeLabel(selectedInvoice.status) : 'Pending',
    lastUpdated: selectedInvoice ? formatDateTime(selectedInvoice.updatedAtUtc) : 'Pending',
    compactTypography: state.compactTypography,
    queueAutoScroll: state.queueAutoScroll,
  };
}

function updateNavState(): void {
  document.querySelectorAll<HTMLElement>('[data-route]').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-route') === state.route);
  });

  sidebarToggleButton?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
}

function updateQueueCount(): void {
  document.querySelectorAll<HTMLElement>('[data-count="queue"]').forEach((item) => {
    item.textContent = String(store.queueRows.length);
  });
}

function renderError(message: string): void {
  pageHost.innerHTML = `
    <section class="page active">
      <div class="empty-state">${message}</div>
    </section>
  `;
}

function renderTableSkeletonRow(): string {
  return `
    <tr>
      <td><span class="skeleton skeleton-line" style="width: 72%; display:block;"></span></td>
      <td><div class="skeleton-stack"><span class="skeleton skeleton-line" style="width: 84%;"></span><span class="skeleton skeleton-line" style="width: 48%;"></span></div></td>
      <td><div class="skeleton-stack"><span class="skeleton skeleton-line" style="width: 68%;"></span><span class="skeleton skeleton-line" style="width: 42%;"></span></div></td>
      <td><span class="skeleton skeleton-line" style="width: 78%; display:block;"></span></td>
      <td><span class="skeleton skeleton-line" style="width: 74%; display:block;"></span></td>
      <td><span class="skeleton skeleton-line" style="width: 60%; display:block;"></span></td>
      <td><span class="skeleton skeleton-chip"></span></td>
    </tr>
  `;
}

function renderInvoiceTableSkeleton(rowCount = 5): string {
  return `
    <div class="table-wrap" aria-hidden="true">
      <table aria-label="Loading invoices">
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
        <tbody class="skeleton-table">
          ${Array.from({ length: rowCount }, () => renderTableSkeletonRow()).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboardLoadingState(): string {
  return `
    <section class="page active">
      <div class="page-grid">
        <div class="workspace">
          <section class="page-header">
            <div class="skeleton-stack" style="min-width: 280px; max-width: 560px;">
              <span class="skeleton skeleton-line" style="width: 34%;"></span>
              <span class="skeleton skeleton-line" style="width: 58%; height: 24px;"></span>
              <span class="skeleton skeleton-line" style="width: 82%;"></span>
            </div>
            <div class="header-actions">
              <span class="skeleton skeleton-chip"></span>
            </div>
          </section>
          <section class="kpi-grid" aria-hidden="true">
            ${Array.from({ length: 4 }, () => `
              <article class="metric-card">
                <span class="skeleton skeleton-avatar"></span>
                <div class="skeleton-stack" style="width: 100%;">
                  <span class="skeleton skeleton-line" style="width: 42%;"></span>
                  <span class="skeleton skeleton-line" style="width: 64%; height: 22px;"></span>
                  <span class="skeleton skeleton-line" style="width: 28%;"></span>
                </div>
              </article>
            `).join('')}
          </section>
          <section class="card">
            <div class="skeleton-stack" style="margin-bottom: 14px;">
              <span class="skeleton skeleton-line" style="width: 24%;"></span>
              <span class="skeleton skeleton-line" style="width: 44%; height: 18px;"></span>
              <span class="skeleton skeleton-line" style="width: 64%;"></span>
            </div>
            <div class="dashboard-filter-grid">
              <div class="skeleton-card">
                <span class="skeleton skeleton-line" style="width: 18%;"></span>
                <span class="skeleton skeleton-block" style="height: 44px;"></span>
              </div>
              <div class="skeleton-card">
                <span class="skeleton skeleton-line" style="width: 28%;"></span>
                <div class="skeleton-card-grid">
                  <span class="skeleton skeleton-block" style="height: 42px;"></span>
                  <span class="skeleton skeleton-block" style="height: 42px;"></span>
                  <span class="skeleton skeleton-block" style="height: 42px;"></span>
                </div>
              </div>
            </div>
          </section>
          <section class="content-row">
            <article class="card">
              <div class="skeleton-stack" style="margin-bottom: 14px;">
                <span class="skeleton skeleton-line" style="width: 34%;"></span>
                <span class="skeleton skeleton-line" style="width: 58%; height: 18px;"></span>
              </div>
              ${renderInvoiceTableSkeleton(4)}
            </article>
            <article class="card">
              <div class="skeleton-stack" style="margin-bottom: 14px;">
                <span class="skeleton skeleton-line" style="width: 30%;"></span>
                <span class="skeleton skeleton-line" style="width: 44%; height: 18px;"></span>
              </div>
              <div class="skeleton-card-grid">
                <div class="skeleton-card">
                  <span class="skeleton skeleton-line" style="width: 42%;"></span>
                  <span class="skeleton skeleton-block" style="height: 88px;"></span>
                </div>
                <div class="skeleton-card">
                  <span class="skeleton skeleton-line" style="width: 56%;"></span>
                  <span class="skeleton skeleton-block" style="height: 180px;"></span>
                </div>
              </div>
            </article>
          </section>
        </div>
        <aside class="side-panel">
          <section class="card">
            <div class="skeleton-stack" style="margin-bottom: 14px;">
              <span class="skeleton skeleton-line" style="width: 36%;"></span>
              <span class="skeleton skeleton-line" style="width: 48%; height: 18px;"></span>
            </div>
            <div class="skeleton-card-grid">
              <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 84px;"></span></div>
              <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 84px;"></span></div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderInvoicesLoadingState(): string {
  return `
    <section class="page active invoices-layout">
      <section class="filter-bar invoice-filter-bar">
        <div class="filter-field invoice-search-field">
          <span class="skeleton skeleton-line" style="width: 18%;"></span>
          <span class="skeleton skeleton-block" style="height: 44px;"></span>
        </div>
        <div class="invoice-filter-grid" aria-hidden="true">
          ${Array.from({ length: 4 }, () => `
            <div class="filter-field">
              <span class="skeleton skeleton-line" style="width: 28%;"></span>
              <span class="skeleton skeleton-block" style="height: 42px;"></span>
            </div>
          `).join('')}
        </div>
        <span class="skeleton skeleton-chip invoice-filter-reset"></span>
      </section>
      <section class="card results-card">
        <div class="card-header results-header">
          <div class="skeleton-stack" style="min-width: 280px; max-width: 540px;">
            <span class="skeleton skeleton-line" style="width: 26%;"></span>
            <span class="skeleton skeleton-line" style="width: 54%; height: 18px;"></span>
            <span class="skeleton skeleton-line" style="width: 82%;"></span>
          </div>
          <span class="skeleton skeleton-chip"></span>
        </div>
        ${renderInvoiceTableSkeleton(5)}
      </section>
    </section>
  `;
}

function renderQueueLoadingState(): string {
  return `
    <section class="page active">
      <section class="queue-page-grid">
        <div class="workspace">
          <section class="filter-bar">
            <div class="skeleton-stack" style="flex: 1 1 320px; min-width: 0;">
              <span class="skeleton skeleton-line" style="width: 16%;"></span>
              <span class="skeleton skeleton-block" style="height: 44px;"></span>
            </div>
            <span class="skeleton skeleton-chip"></span>
          </section>
          <section class="card">
            <div class="card-header">
              <span class="skeleton skeleton-line" style="width: 24%; height: 18px;"></span>
              <span class="skeleton skeleton-chip"></span>
            </div>
            <div class="skeleton-card-grid">
              ${Array.from({ length: 6 }, () => `
                <div class="skeleton-card">
                  <span class="skeleton skeleton-block" style="height: 18px; width: 72%;"></span>
                  <span class="skeleton skeleton-block" style="height: 14px; width: 52%;"></span>
                  <span class="skeleton skeleton-block" style="height: 48px;"></span>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
        <aside class="side-panel">
          <section class="card">
            <div class="card-header">
              <span class="skeleton skeleton-line" style="width: 28%; height: 18px;"></span>
            </div>
            <div class="skeleton-card-grid">
              <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 112px;"></span></div>
            </div>
          </section>
          <section class="card">
            <div class="card-header">
              <span class="skeleton skeleton-line" style="width: 34%; height: 18px;"></span>
            </div>
            <div class="skeleton-card-grid">
              <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 160px;"></span></div>
            </div>
          </section>
          <section class="card">
            <div class="card-header">
              <span class="skeleton skeleton-line" style="width: 40%; height: 18px;"></span>
            </div>
            <div class="skeleton-card-grid">
              <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 180px;"></span></div>
            </div>
          </section>
        </aside>
      </section>
    </section>
  `;
}

function renderGenericLoadingState(): string {
  return `
    <section class="page active">
      <div class="skeleton-card-grid">
        <div class="skeleton-card">
          <span class="skeleton skeleton-line" style="width: 18%;"></span>
          <span class="skeleton skeleton-line" style="width: 44%; height: 20px;"></span>
          <span class="skeleton skeleton-block" style="height: 96px;"></span>
        </div>
        <div class="skeleton-card">
          <span class="skeleton skeleton-line" style="width: 24%;"></span>
          <span class="skeleton skeleton-block" style="height: 180px;"></span>
        </div>
      </div>
    </section>
  `;
}

function renderLoading(route = state.route): void {
  switch (route) {
    case 'dashboard':
      pageHost.innerHTML = renderDashboardLoadingState();
      return;
    case 'invoices':
      pageHost.innerHTML = renderInvoicesLoadingState();
      return;
    case 'compliance-queue':
      pageHost.innerHTML = renderQueueLoadingState();
      return;
    default:
      pageHost.innerHTML = renderGenericLoadingState();
      return;
  }
}

function renderAuthGate(message?: string): void {
  setAuthState(false);
  pageHost.innerHTML = `
    <section class="auth-gate">
      <div class="auth-gate-panel card">
        <p class="section-eyebrow">Microsoft sign-in required</p>
        <h1>Microsoft sign-in required</h1>
        <p class="auth-gate-subtitle">InvoiceLens is locked</p>
        <p class="auth-gate-copy">${escapeHtml(message ?? 'Sign in with Microsoft to unlock the InvoiceLens workspace.')}</p>
        <div class="auth-gate-actions">
          <button class="button primary" type="button" data-action="profile-auth">Sign in with Microsoft</button>
        </div>
        <div class="auth-gate-note">
          <span aria-hidden="true">LOCKED</span>
          <span>Only Microsoft accounts can open the workspace right now.</span>
        </div>
      </div>
    </section>
  `;
  document.body.classList.remove('modal-open');
  appShell.dataset['sidebar'] = 'expanded';
  applyWorkspaceSettings();
  globalSearch.value = '';
}

function render(): void {
  if (isWorkspaceLocked()) {
    renderAuthGate();
    return;
  }

  if (state.loading) {
    renderLoading();
    return;
  }

  if (state.error) {
    renderError(state.error);
    return;
  }

  const dashboardData = buildDashboardData();
  const reviewData = buildReviewViewData();
  const comparisonData = buildComparisonViewData();

  const routeRenderers: Record<Route, () => string> = {
    dashboard: () => renderDashboard(dashboardData),
    invoices: () =>
      renderInvoicesPage(
        store.invoices,
        state.search,
        state.invoiceStatusFilter,
        state.invoiceDateRange,
        state.invoiceDateFrom,
        state.invoiceDateTo,
        state.queueSort,
        state.selectedInvoiceId,
        reviewData,
      ),
    'compliance-queue': () =>
      renderComplianceQueuePage(
        store.queueRows,
        state.search,
        state.selectedInvoiceId,
        state.queueSort,
        dashboardData.queueSummary,
        dashboardData.validationAlerts,
        buildReviewViewData().review,
      ),
    comparison: () => renderComparisonPage(comparisonData),
    'validation-summary': () => renderValidationSummaryPage(buildValidationViewData()),
    notifications: () => renderNotificationsPage(store.queueRows, dashboardData.validationAlerts, state.selectedInvoiceId),
    help: () => renderHelpPage(),
    admin: () => renderAdminPage(buildAdminData()),
  };

  const pageMarkup = routeRenderers[state.route]();
  const previewBundle = buildReviewViewData();
  const invoicePreviewMarkup =
    state.route !== 'invoices' && state.invoicePreviewOpen && state.selectedInvoiceId
      ? renderInvoicePreviewModalRich(previewBundle.review, !store.selected.has(state.selectedInvoiceId))
      : '';

  pageHost.innerHTML = `${pageMarkup}${invoicePreviewMarkup}`;
  appShell.dataset['sidebar'] = state.sidebarCollapsed ? 'collapsed' : 'expanded';
  applyWorkspaceSettings();
  globalSearch.value = state.search;
  updateNavState();
  updateQueueCount();
  document.body.classList.toggle('modal-open', state.invoicePreviewOpen || (state.route === 'comparison' && state.comparisonDetailFieldIndex !== null));
  syncProfile();

  if (state.queueAutoScroll && state.route === 'compliance-queue') {
    window.requestAnimationFrame(() => {
      const selectedItem = document.querySelector<HTMLElement>('.queue-item.selected');
      selectedItem?.scrollIntoView({ block: 'nearest' });
    });
  }
}

function clearSearch(): void {
  state.search = '';
  globalSearch.value = '';
  render();
}

function resetInvoiceFilters(): void {
  state.search = '';
  state.invoiceStatusFilter = 'All Statuses';
  state.invoiceDateRange = 'All Time';
  state.invoiceDateFrom = '';
  state.invoiceDateTo = '';
  globalSearch.value = '';
  render();
}

function setFilter(filter: string, value: string): void {
  switch (filter) {
    case 'dashboard-date-range':
      state.dashboardDateRange = value as AppState['dashboardDateRange'];
      break;
    case 'dashboard-date-from':
      state.dashboardDateFrom = value;
      break;
    case 'dashboard-date-to':
      state.dashboardDateTo = value;
      break;
    case 'invoice-status':
      state.invoiceStatusFilter = value as AppState['invoiceStatusFilter'];
      break;
    case 'invoice-date-range':
      state.invoiceDateRange = value as AppState['invoiceDateRange'];
      break;
    case 'invoice-date-from':
      state.invoiceDateFrom = value;
      break;
    case 'invoice-date-to':
      state.invoiceDateTo = value;
      break;
    case 'queue-sort':
      state.queueSort = value as AppState['queueSort'];
      break;
    default:
      return;
  }

  render();
}

function handleSearchUpdate(value: string): void {
  state.search = value;
  render();
}

function toggleSidebar(): void {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  render();
}

async function loadReviewBundle(invoiceId: string): Promise<ReviewBundle> {
  const cached = store.selected.get(invoiceId);
  if (cached) {
    return cached;
  }

  try {
    const [review, validationSummary, auditTrail] = await Promise.all([
      api.getReview(invoiceId),
      api.getValidationSummary(invoiceId),
      api.getAuditTrail(invoiceId),
    ]);

    const bundle: ReviewBundle = {
      review,
      validationSummary,
      auditTrail,
    };

    store.selected.set(invoiceId, bundle);
    return bundle;
  } catch (error) {
    if (error instanceof ApiAuthorizationError) {
      clearMicrosoftAuth();
      syncProfile(null);
      renderAuthGate('Your Microsoft session expired. Please sign in again.');
    }

    const bundle: ReviewBundle = {
      review: null,
      validationSummary: null,
      auditTrail: [],
    };

    store.selected.set(invoiceId, bundle);
    return bundle;
  }
}

function getSelectedComparisonInvoice(): LocalInvoiceFileDto | null {
  return store.localInvoices.find((invoice) => invoice.localInvoiceFileId === state.selectedComparisonLocalInvoiceId) ?? store.localInvoices[0] ?? null;
}

function persistComparisonSelection(localInvoiceFileId: number): void {
  state.selectedComparisonLocalInvoiceId = localInvoiceFileId;
  persistNumberSetting(comparisonSelectionStorageKey, localInvoiceFileId);
}

function normalizeComparisonCategory(result: InvoiceComparisonResultDto): ComparisonFieldViewModel['category'] {
  const code = result.ruleCode.toUpperCase();
  const status = normalizeLabel(result.status).toLowerCase();
  const message = (result.message ?? '').toLowerCase();

  if (code === 'MISSING_CLIENT_RECORD') {
    return 'Missing from SQL';
  }

  if (code === 'MISSING_VENDOR_INVOICE') {
    return 'Missing from vendor/OpenInvoice side';
  }

  if (code === 'W9_COMPLIANCE_ISSUE' || status === 'not available' || message.includes('not enough') || message.includes('cannot be evaluated')) {
    return 'Not enough data to compare';
  }

  if (status === 'warning') {
    return 'Warning';
  }

  if (status === 'fail') {
    return 'Mismatch';
  }

  return 'Match';
}

function resolveComparisonScope(ruleCode: string): string {
  const normalizedRuleCode = ruleCode.toUpperCase();

  if (normalizedRuleCode === 'LINE_ITEM_MISMATCH') {
    return 'Line items';
  }

  if (
    normalizedRuleCode === 'W9_COMPLIANCE_ISSUE' ||
    normalizedRuleCode === 'MATCH_STATUS' ||
    normalizedRuleCode === 'MISSING_CLIENT_RECORD' ||
    normalizedRuleCode === 'MISSING_VENDOR_INVOICE'
  ) {
    return 'Guardrails';
  }

  return 'Header fields';
}

function formatComparisonValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function buildComparisonFieldViewModel(result: InvoiceComparisonResultDto): ComparisonFieldViewModel {
  return {
    ruleCode: result.ruleCode,
    label: result.label,
    scope: resolveComparisonScope(result.ruleCode),
    status: result.status,
    category: normalizeComparisonCategory(result),
    localValue: formatComparisonValue(result.localValue),
    systemValue: formatComparisonValue(result.systemValue),
    message: result.message ?? '',
    severity: normalizeLabel(result.severity),
  };
}

function buildComparisonViewData(): ComparisonViewData {
  const selectedLocalInvoice = getSelectedComparisonInvoice();
  const comparisonRun = store.comparisonRun;
  const results = comparisonRun?.results ?? [];
  const mappedResults = results.map(buildComparisonFieldViewModel);
  const selectedFieldIndex = state.comparisonDetailFieldIndex;
  const selectedField = selectedFieldIndex == null ? null : mappedResults[selectedFieldIndex] ?? null;

  const guardrailCodes = new Set(['MATCH_STATUS', 'MISSING_CLIENT_RECORD', 'MISSING_VENDOR_INVOICE', 'W9_COMPLIANCE_ISSUE']);
  const lineItemResults = mappedResults.filter((field, index) => results[index]?.ruleCode === 'LINE_ITEM_MISMATCH');
  const guardrailResults = mappedResults.filter((field, index) => guardrailCodes.has(results[index]?.ruleCode ?? ''));
  const headerResults = mappedResults.filter((field, index) => {
    const code = results[index]?.ruleCode ?? '';
    return !guardrailCodes.has(code) && code !== 'LINE_ITEM_MISMATCH';
  });

  return {
    localInvoices: store.localInvoices,
    selectedLocalInvoice,
    comparisonRun,
    fields: mappedResults,
    selectedFieldIndex,
    selectedField,
    groupedResults: {
      header: headerResults,
      lineItems: lineItemResults,
      guardrails: guardrailResults,
    },
    pdfUrl: selectedLocalInvoice ? api.getLocalInvoicePdfUrl(selectedLocalInvoice.localInvoiceFileId) : null,
    loading: state.comparisonLoading,
    error: state.comparisonError,
  };
}

async function loadComparisonRun(localInvoiceFileId: number): Promise<void> {
  if (!localInvoiceFileId) {
    store.comparisonRun = null;
    state.comparisonLoading = false;
    state.comparisonError = 'Select a local invoice to run the comparison.';
    state.comparisonDetailFieldIndex = null;
    return;
  }

  state.comparisonLoading = true;
  state.comparisonError = null;
  store.comparisonRun = null;
  state.comparisonDetailFieldIndex = null;
  render();

  try {
    store.comparisonRun = await api.runInvoiceComparison(localInvoiceFileId);
  } catch (error) {
    store.comparisonRun = null;
    if (error instanceof ApiAuthorizationError) {
      clearMicrosoftAuth();
      syncProfile(null);
      renderAuthGate('Your Microsoft session expired. Please sign in again.');
      return;
    }

    state.comparisonError = error instanceof Error ? error.message : 'Unable to run the comparison right now.';
  } finally {
    state.comparisonLoading = false;
  }
}

async function openComparisonInvoice(localInvoiceFileId: number): Promise<void> {
  persistComparisonSelection(localInvoiceFileId);
  state.route = 'comparison';
  state.invoicePreviewOpen = false;
  state.comparisonDetailFieldIndex = null;
  syncBrowserLocation('comparison', '', false, false);
  render();
  await loadComparisonRun(localInvoiceFileId);
  render();
}

async function reloadData(selectedInvoiceId = state.selectedInvoiceId): Promise<void> {
  state.loading = true;
  state.error = null;
  render();

  try {
    const [invoices, queue, syncStatus, localInvoices] = await Promise.all([
      api.getInvoices(),
      api.getQueue(),
      api.getSyncStatus(),
      api.getLocalInvoices().catch(() => []),
    ]);

    store.invoices = invoices;
    store.queue = queue;
    store.queueRows = buildQueueRows();
    store.syncStatus = syncStatus;
    store.localInvoices = localInvoices;

    if (store.localInvoices.length === 0) {
      await api.loadLocalInvoices().catch(() => null);
      store.localInvoices = await api.getLocalInvoices().catch(() => []);
    }

    if (!selectedInvoiceId || !store.invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)) {
      selectedInvoiceId = store.invoices[0]?.invoiceId ?? '';
    }

    state.selectedInvoiceId = selectedInvoiceId;

    if (!state.selectedComparisonLocalInvoiceId || !store.localInvoices.some((invoice) => invoice.localInvoiceFileId === state.selectedComparisonLocalInvoiceId)) {
      const firstComparison = store.localInvoices[0]?.localInvoiceFileId ?? 0;
      persistComparisonSelection(firstComparison);
    }

    state.loading = false;
    render();

    if (selectedInvoiceId) {
      store.selected.delete(selectedInvoiceId);
      void loadReviewBundle(selectedInvoiceId).then(() => {
        if (!state.loading && !state.error) {
          render();
        }
      });
    }

    if (state.route === 'comparison') {
      const selectedComparison = getSelectedComparisonInvoice();
      if (selectedComparison) {
        await loadComparisonRun(selectedComparison.localInvoiceFileId);
        render();
      }
    }
  } catch (error) {
    state.loading = false;
    if (error instanceof ApiAuthorizationError) {
      clearMicrosoftAuth();
      syncProfile(null);
      renderAuthGate('Your Microsoft session expired. Please sign in again.');
      return;
    }

    state.error = error instanceof Error ? error.message : 'Unable to load the InvoiceLens workspace.';
    render();
  }
}

async function openInvoicePreview(invoiceId: string): Promise<void> {
  state.route = 'invoices';
  state.selectedInvoiceId = invoiceId;
  state.invoicePreviewOpen = false;
  syncBrowserLocation('invoices', '', false, false);
  await loadReviewBundle(invoiceId);
  render();
}

async function refreshAfterMutation(successMessage: string): Promise<void> {
  showToast(successMessage);
  store.selected.delete(state.selectedInvoiceId);
  await reloadData(state.selectedInvoiceId);
}

function showMutationError(actionLabel: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  showToast(`${actionLabel} failed: ${message}`);
}

document.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (isWorkspaceLocked() && !target.closest<HTMLElement>('[data-action="profile-auth"]')) {
    return;
  }

  if (event instanceof MouseEvent && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) {
    return;
  }

  const comparisonInvoiceLink = target.closest<HTMLElement>('[data-local-invoice-id]');
  if (comparisonInvoiceLink) {
    event.preventDefault();
    const localInvoiceId = Number(comparisonInvoiceLink.getAttribute('data-local-invoice-id'));
    if (Number.isFinite(localInvoiceId) && localInvoiceId > 0) {
      void openComparisonInvoice(localInvoiceId);
    }
    return;
  }

  const invoiceLink = target.closest<HTMLElement>('[data-invoice-id]');
  if (invoiceLink) {
    event.preventDefault();
    const invoiceId = invoiceLink.getAttribute('data-invoice-id');
    if (invoiceId) {
      void openInvoicePreview(invoiceId);
    }
    return;
  }

  const routeElement = target.closest<HTMLElement>('[data-route]');
  if (routeElement) {
    event.preventDefault();
    const route = routeElement.getAttribute('data-route') as Route | null;
    if (route) {
      navigateTo(route);
    }
    return;
  }

  const actionElement = target.closest<HTMLElement>('[data-action]');
  if (!actionElement) {
    return;
  }

  const action = actionElement.getAttribute('data-action');

  switch (action) {
    case 'close-comparison-detail':
      state.comparisonDetailFieldIndex = null;
      render();
      break;
    case 'open-comparison-detail':
      {
        const fieldIndex = Number(actionElement.getAttribute('data-comparison-field-index'));
        if (Number.isFinite(fieldIndex) && fieldIndex >= 0) {
          state.comparisonDetailFieldIndex = fieldIndex;
          render();
        }
      }
      break;
    case 'close-invoice-preview':
      state.invoicePreviewOpen = false;
      if (state.route === 'invoices') {
        syncBrowserLocation(state.route, '', true, false);
      }
      render();
      break;
    case 'open-invoice-preview':
      {
        const invoiceId = actionElement.getAttribute('data-invoice-id');
        if (invoiceId) {
          void openInvoicePreview(invoiceId);
        }
      }
      break;
    case 'toggle-sidebar':
      toggleSidebar();
      break;
    case 'clear-search':
      clearSearch();
      break;
    case 'reset-invoice-filters':
      resetInvoiceFilters();
      break;
    case 'reset-dashboard-filters':
      state.dashboardDateFrom = '';
      state.dashboardDateTo = '';
      state.dashboardDateRange = 'Last 30 Days';
      state.search = '';
      globalSearch.value = '';
      render();
      break;
    case 'download-pdf':
      showToast('Download request was routed through the SQL-backed review flow.');
      break;
    case 'open-portal':
      showToast('OpenInvoice portal link is ready.');
      break;
    case 'approve-invoice':
      if (state.selectedInvoiceId) {
        void api
          .approveInvoice(state.selectedInvoiceId)
          .then(() => refreshAfterMutation('Invoice approved and audit entry created.'))
          .catch((error) => showMutationError('Approve', error));
      }
      break;
    case 'send-back':
      if (state.selectedInvoiceId) {
        void api
          .sendBackInvoice(state.selectedInvoiceId)
          .then(() => refreshAfterMutation('Invoice sent back for review.'))
          .catch((error) => showMutationError('Send back', error));
      }
      break;
    case 'save-settings':
      persistWorkspaceSettings();
      syncProfile();
      showToast('Settings saved.');
      break;
    case 'toggle-switch':
      {
        const setting = actionElement.getAttribute('data-setting');
        if (setting === 'compact-typography') {
          state.compactTypography = !state.compactTypography;
        } else if (setting === 'queue-auto-scroll') {
          state.queueAutoScroll = !state.queueAutoScroll;
        } else {
          break;
        }

        actionElement.classList.toggle('active');
        actionElement.setAttribute('aria-pressed', String(actionElement.classList.contains('active')));
        render();
      }
      break;
    case 'profile-auth':
      {
        const profile = getCurrentAuthProfile();
        if (profile) {
          void signOutMicrosoft().catch((error) => showMutationError('Sign out', error));
        } else {
          void startMicrosoftSignIn().catch((error) => showMutationError('Sign in', error));
        }
      }
      break;
    default:
      break;
  }
});

document.addEventListener('input', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.matches('[data-input="page-search"]')) {
    handleSearchUpdate(target.value);
    return;
  }

  const filter = target.getAttribute('data-filter');
  if (filter && target.type === 'date') {
    setFilter(filter, target.value);
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) {
    return;
  }

  const filter = target.getAttribute('data-filter');
  if (filter) {
    setFilter(filter, target.value);
  }
});

window.addEventListener('popstate', () => {
  if (isWorkspaceLocked()) {
    renderAuthGate();
    return;
  }

  const next = readRouteFromLocation();
  state.route = next.route;
  state.invoicePreviewOpen = next.invoicePreviewOpen;
  void reloadData(next.selectedInvoiceId);
});

globalSearch.addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    handleSearchUpdate(target.value);
  }
});

async function start(): Promise<void> {
  if (bootstrapping) {
    return;
  }

  bootstrapping = true;
  loadWorkspaceSettings();
  setBootstrapState(false);
  appDebug('App bootstrap started.', {
    pathname: window.location.pathname,
    search: window.location.search,
    origin: window.location.origin,
  });

  try {
    const authBootstrap = await initializeMicrosoftAuth();
    const profile = authBootstrap.profile;
    appDebug('Microsoft auth initialization finished.', {
      hasProfile: Boolean(profile),
      displayName: profile?.displayName ?? '',
      initials: profile?.initials ?? '',
      email: profile?.email ?? '',
      storedProfilePresent: Boolean(getCurrentAuthProfile()),
    });
    if (!profile) {
      syncProfile(null);
      renderAuthGate(authBootstrap.unavailableMessage ?? undefined);
    } else {
      syncProfile(profile);
      const restoredRoute = restorePostLoginRoute();
      appDebug('Restored post-login route.', {
        restoredRoute: restoredRoute ?? '',
        currentPathname: window.location.pathname,
      });
      if (restoredRoute && window.location.pathname === '/') {
        window.history.replaceState({}, '', restoredRoute);
        appDebug('Applied restored post-login route.', {
          restoredRoute,
        });
      }

      const initialRoute = readRouteFromLocation();
      state.route = initialRoute.route;
      state.selectedInvoiceId = initialRoute.selectedInvoiceId;
      state.invoicePreviewOpen = initialRoute.invoicePreviewOpen;
      renderLoading();
      await reloadData(state.selectedInvoiceId);
      syncBrowserLocation(state.route, state.selectedInvoiceId, true, state.invoicePreviewOpen && state.route === 'invoices');
      appDebug('App bootstrap completed.', {
        selectedInvoiceId: state.selectedInvoiceId,
        route: state.route,
        invoicePreviewOpen: state.invoicePreviewOpen,
      });
    }
  } catch (error) {
    console.warn('Microsoft auth bootstrap failed:', error);
    appDebug('Microsoft auth bootstrap failed.', {
      error: error instanceof Error ? error.message : String(error),
    });
    clearMicrosoftAuth();
    syncProfile(null);
    renderAuthGate(error instanceof Error ? error.message : 'Microsoft sign-in is temporarily unavailable.');
  } finally {
    setBootstrapState(true);
    bootstrapping = false;
  }
}

void start();
