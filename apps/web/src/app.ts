import { ApiAuthorizationError, InvoiceLensApiClient } from './shared/api.js';
import { clearMicrosoftAuth, getCurrentAuthProfile, initializeMicrosoftAuth, restorePostLoginRoute, signOutMicrosoft, startMicrosoftSignIn } from './shared/auth.js';
import {
  AdminViewData,
  AppState,
  AuditEntryDto,
  DashboardMetric,
  DashboardViewData,
  InvoiceReviewDto,
  InvoicePanelTab,
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
import { renderAnalyticsPage } from './views/analytics.js';
import { renderContractsPage } from './views/contracts.js';
import { renderDashboard } from './views/dashboard.js';
import { renderHelpPage } from './views/help.js';
import { renderInvoiceQueueItems, renderInvoicesPage } from './views/invoices.js';
import { renderNotificationsPage } from './views/notifications.js';
import { renderInvoicePreviewModalRich } from './views/shared.js';
import { renderReportsPage } from './views/reports.js';
import { renderVendorsPage } from './views/vendors.js';

type ReviewBundle = {
  review: InvoiceReviewDto | null;
  validationSummary: ValidationSummaryDto | null;
  auditTrail: AuditEntryDto[];
};

type ReloadOptions = {
  silent?: boolean;
};

type InvoiceColumnLayout = {
  queueWidth: number;
  insightsWidth: number;
};

const api = new InvoiceLensApiClient(window.location.origin);
const compactTypographyStorageKey = 'InvoiceLens:compactTypography';
const queueAutoScrollStorageKey = 'InvoiceLens:queueAutoScroll';
const invoiceColumnLayoutStorageKey = 'InvoiceLens:invoice-columns';
const userRoleLabel = 'Finance Operations';

const state: AppState = {
  route: 'dashboard',
  selectedInvoiceId: '',
  invoicePreviewOpen: false,
  activeInvoicePanel: 'insights',
  globalSearch: '',
  dashboardSearch: '',
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
  loading: true,
  error: null,
};

const store = {
  invoices: [] as InvoiceSummaryDto[],
  queue: [] as QueueItemDto[],
  queueRows: [] as QueueRow[],
  syncStatus: null as SyncStatusDto | null,
  selected: new Map<string, ReviewBundle>(),
};

const routePaths: Record<Route, string> = {
  dashboard: '/',
  invoices: '/invoices',
  analytics: '/analytics',
  contracts: '/contracts',
  vendors: '/vendors',
  reports: '/reports',
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
let invoiceChartInstances: Array<{ destroy: () => void }> = [];
let invoiceZoom = 1;
let invoiceMutationInFlight = false;

const invoiceColumnDefaults: InvoiceColumnLayout = {
  queueWidth: 360,
  insightsWidth: 360,
};

function readInvoiceColumnLayout(): InvoiceColumnLayout | null {
  try {
    const raw = window.localStorage.getItem(invoiceColumnLayoutStorageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<InvoiceColumnLayout>;
    if (typeof parsed.queueWidth !== 'number' || typeof parsed.insightsWidth !== 'number') {
      return null;
    }

    return {
      queueWidth: parsed.queueWidth,
      insightsWidth: parsed.insightsWidth,
    };
  } catch {
    return null;
  }
}

function persistInvoiceColumnLayout(layout: InvoiceColumnLayout): void {
  try {
    window.localStorage.setItem(invoiceColumnLayoutStorageKey, JSON.stringify(layout));
  } catch {
    // Ignore storage failures and keep session-only sizing.
  }
}

function clampInvoiceColumnLayout(workspace: HTMLElement, layout: InvoiceColumnLayout): InvoiceColumnLayout {
  const totalWidth = workspace.clientWidth;
  const queueMin = 260;
  const queueMax = 560;
  const insightsMin = 280;
  const insightsMax = 560;
  const centerMin = 480;
  const handlesWidth = 20;

  if (totalWidth <= queueMin + insightsMin + centerMin + handlesWidth) {
    return {
      queueWidth: queueMin,
      insightsWidth: insightsMin,
    };
  }

  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

  const initialQueueMax = Math.min(queueMax, totalWidth - handlesWidth - centerMin - insightsMin);
  let queueWidth = clamp(layout.queueWidth, queueMin, initialQueueMax);

  const initialInsightsMax = Math.min(insightsMax, totalWidth - handlesWidth - centerMin - queueWidth);
  let insightsWidth = clamp(layout.insightsWidth, insightsMin, initialInsightsMax);

  const adjustedQueueMax = Math.min(queueMax, totalWidth - handlesWidth - centerMin - insightsWidth);
  queueWidth = clamp(queueWidth, queueMin, adjustedQueueMax);

  return {
    queueWidth,
    insightsWidth,
  };
}

function applyInvoiceColumnLayout(): void {
  const workspace = pageHost.querySelector<HTMLElement>('.invoices-page .workspace');
  if (!workspace) {
    return;
  }

  if (window.matchMedia('(max-width: 820px)').matches) {
    workspace.style.removeProperty('--invoice-queue-width');
    workspace.style.removeProperty('--invoice-insights-width');
    return;
  }

  const stored = readInvoiceColumnLayout() ?? invoiceColumnDefaults;
  const layout = clampInvoiceColumnLayout(workspace, stored);

  workspace.style.setProperty('--invoice-queue-width', `${layout.queueWidth}px`);
  workspace.style.setProperty('--invoice-insights-width', `${layout.insightsWidth}px`);
}

function applyInvoiceZoom(): void {
  const paper = pageHost.querySelector<HTMLElement>('.invoice-paper');
  if (paper) {
    paper.style.transform = invoiceZoom === 1 ? '' : `scale(${invoiceZoom})`;
    paper.style.transformOrigin = 'top center';
  }

  const label = pageHost.querySelector<HTMLElement>('.zoom');
  if (label) {
    label.textContent = `${Math.round(invoiceZoom * 100)}%`;
  }
}

function setInvoiceZoom(next: number): void {
  invoiceZoom = Math.min(2, Math.max(0.5, Math.round(next * 10) / 10));
  applyInvoiceZoom();
}

function getQueueOrderedInvoices(): InvoiceSummaryDto[] {
  return applyInvoiceFilters(store.invoices, {
    search: state.globalSearch,
    status: state.invoiceStatusFilter,
    dateRange: state.invoiceDateRange,
    dateFrom: state.invoiceDateFrom,
    dateTo: state.invoiceDateTo,
    sort: state.queueSort,
  });
}

function navigateInvoiceBy(delta: number): void {
  const rows = getQueueOrderedInvoices();
  if (rows.length === 0) {
    return;
  }

  const currentIndex = rows.findIndex((invoice) => invoice.invoiceId === state.selectedInvoiceId);
  const baseIndex = currentIndex < 0 ? 0 : currentIndex;
  const nextIndex = Math.min(rows.length - 1, Math.max(0, baseIndex + delta));
  const nextInvoice = rows[nextIndex];

  if (nextInvoice && nextInvoice.invoiceId !== state.selectedInvoiceId) {
    invoiceZoom = 1;
    void openInvoicePreview(nextInvoice.invoiceId);
  }
}

// Partial (ajax-like) update: refresh only the queue list without rebuilding the page.
// Returns true when handled in place, false when a full render is required.
function updateInvoiceQueueInPlace(): boolean {
  if (state.route !== 'invoices') {
    return false;
  }

  const listEl = pageHost.querySelector<HTMLElement>('.queue-list');
  if (!listEl) {
    return false;
  }

  const rows = getQueueOrderedInvoices();
  const selectedStillPresent = rows.some((invoice) => invoice.invoiceId === state.selectedInvoiceId);

  // If the selected invoice was filtered out, the document/insights must change too.
  if (!selectedStillPresent) {
    return false;
  }

  const reviewData = buildReviewViewData();
  listEl.innerHTML = renderInvoiceQueueItems(rows, state.selectedInvoiceId, reviewData);

  const countEl = pageHost.querySelector<HTMLElement>('.panel.queue .count');
  if (countEl) {
    countEl.textContent = String(rows.length);
  }

  const footerEl = pageHost.querySelector<HTMLElement>('.queue-footer span');
  if (footerEl) {
    footerEl.textContent = `Showing 1 - ${rows.length} of ${rows.length}`;
  }

  return true;
}

// DOM-only tab switch so toggling panels does not rebuild (and shake) the page.
function switchInvoicePanelInPlace(panel: InvoicePanelTab): boolean {
  const insights = pageHost.querySelector<HTMLElement>('.panel.insights');
  if (!insights) {
    return false;
  }

  insights.querySelectorAll<HTMLElement>('.tab').forEach((tab) => {
    const isActive = tab.getAttribute('data-panel') === panel;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });

  const panels = insights.querySelectorAll<HTMLElement>('.invoice-tab-panel');
  // First panel = insights, second = details.
  const activeIndex = panel === 'details' ? 1 : 0;
  panels.forEach((element, index) => {
    const isActive = index === activeIndex;
    element.classList.toggle('is-active', isActive);
    if (isActive) {
      element.removeAttribute('aria-hidden');
    } else {
      element.setAttribute('aria-hidden', 'true');
    }
  });

  return true;
}

type ChartJsCtor = new (
  item: HTMLCanvasElement,
  config: {
    type: string;
    data: { datasets: Array<{ data: number[]; backgroundColor: string[]; borderWidth?: number; hoverOffset?: number }> };
    options?: Record<string, unknown>;
  },
) => { destroy: () => void };

function destroyInvoiceCharts(): void {
  invoiceChartInstances.forEach((chart) => chart.destroy());
  invoiceChartInstances = [];
}

function renderInvoiceCharts(): void {
  destroyInvoiceCharts();

  const Chart = (window as Window & { Chart?: ChartJsCtor }).Chart;
  if (!Chart || state.route !== 'invoices') {
    return;
  }

  const scoreCanvas = pageHost.querySelector<HTMLCanvasElement>('.invoice-score-chart');
  if (scoreCanvas) {
    const score = Number(scoreCanvas.dataset['score'] ?? '0');
    invoiceChartInstances.push(
      new Chart(scoreCanvas, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: [Math.max(0, Math.min(100, score)), Math.max(0, 100 - score)],
              backgroundColor: ['#16a34a', '#e5e7eb'],
              borderWidth: 0,
              hoverOffset: 0,
            },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          events: [],
        },
      }),
    );
  }

  const impactCanvas = pageHost.querySelector<HTMLCanvasElement>('.invoice-impact-chart');
  if (impactCanvas) {
    const rateCap = Number(impactCanvas.dataset['rateCap'] ?? '0');
    const price = Number(impactCanvas.dataset['price'] ?? '0');
    const quantity = Number(impactCanvas.dataset['quantity'] ?? '0');
    const values = [rateCap, price, quantity];
    const fallbackValues = values.every((value) => value <= 0) ? [1, 0, 0] : values;

    invoiceChartInstances.push(
      new Chart(impactCanvas, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: fallbackValues,
              backgroundColor: ['#dc2626', '#f59e0b', '#facc15'],
              borderWidth: 0,
              hoverOffset: 0,
            },
          ],
        },
        options: {
          responsive: false,
          animation: false,
          cutout: '58%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          events: [],
        },
      }),
    );
  }
}

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
}

function applyWorkspaceSettings(): void {
  appShell.dataset['density'] = state.compactTypography ? 'compact' : 'comfortable';
  document.body.dataset['density'] = state.compactTypography ? 'compact' : 'comfortable';
}

function persistWorkspaceSettings(): void {
  persistBooleanSetting(compactTypographyStorageKey, state.compactTypography);
  persistBooleanSetting(queueAutoScrollStorageKey, state.queueAutoScroll);
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
    profileRole.textContent = profile.jobTitle || userRoleLabel;
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

  const routeEntry = (Object.entries(routePaths) as Array<[Route, string]>).find(([, routePath]) => routePath === pathname);

  try {
    storedRoute = window.sessionStorage.getItem(routeStorageKey) as Route | null;
  } catch {
    storedRoute = null;
  }

  const knownStoredRoute = storedRoute && routePaths[storedRoute] ? storedRoute : null;
  const route = routeEntry?.[0] ?? knownStoredRoute ?? 'dashboard';

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
    state.selectedInvoiceId = selectedInvoiceId || (store.invoices[0]?.invoiceId ?? state.selectedInvoiceId);
  }

  syncBrowserLocation(state.route, state.route === 'invoices' ? state.selectedInvoiceId : '', replace, false);
  render();
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

function buildDashboardValidationAlerts(invoices: InvoiceSummaryDto[]): ValidationAlert[] {
  return invoices
    .filter((invoice) => normalizeLabel(invoice.status) !== 'Approved')
    .slice(0, 6)
    .map((invoice) => {
      const normalizedStatus = normalizeLabel(invoice.status);
      const tone: ValidationAlert['className'] = normalizedStatus === 'Sent Back' ? 'red' : 'amber';

      return {
        title: normalizedStatus === 'Sent Back' ? 'Sent Back For Correction' : 'Pending Review',
        count: 1,
        className: tone,
        message:
          normalizedStatus === 'Sent Back'
            ? `${invoice.invoiceNumber} requires corrections before approval.`
            : `${invoice.invoiceNumber} is waiting for reviewer action.`,
        invoiceId: invoice.invoiceId,
        invoiceNo: invoice.invoiceNumber,
        amount: formatCurrency(invoice.amount, invoice.currency),
      };
    });
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
    search: state.dashboardSearch,
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
  const filteredInvoiceIds = new Set(filteredInvoices.map((invoice) => invoice.invoiceId));
  const filteredQueueRows = store.queueRows.filter((row) => filteredInvoiceIds.has(row.invoiceId));
  const dashboardValidationAlerts = buildDashboardValidationAlerts(filteredInvoices);
  const selectedReviewBundle = getSelectedReviewBundle();

  return {
    metrics: buildDashboardMetrics(filteredInvoices, true),
    queueSummary: buildQueueSummary(filteredQueueRows),
    validationAlerts: buildValidationAlerts(selectedReviewBundle),
    dashboardValidationAlerts,
    vendorBars: buildVendorBars(filteredQueueRows),
    recentInvoices: store.invoices,
    filteredInvoices,
    dashboardSearch: state.dashboardSearch,
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
    profile: getCurrentAuthProfile(),
  };
}

function updateNavState(): void {
  document.querySelectorAll<HTMLElement>('[data-route]').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-route') === state.route);
  });

  sidebarToggleButton?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
}

function applySidebarState(): void {
  appShell.dataset['sidebar'] = state.sidebarCollapsed ? 'collapsed' : 'expanded';
  sidebarToggleButton?.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
}

function updateQueueCount(): void {
  document.querySelectorAll<HTMLElement>('[data-count="queue"]').forEach((item) => {
    item.textContent = String(store.queueRows.length);
  });
}

function updateNotificationCount(): void {
  const count = store.queueRows.length;

  document.querySelectorAll<HTMLElement>('[data-count="notifications"]').forEach((item) => {
    item.textContent = String(count);
    item.hidden = count === 0;
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
    <section class="page active invoices-layout invoices-page">
      <section class="review-workspace invoice-three-panel-grid invoice-workspace-shell">
        <section class="review-column invoice-queue-column invoice-pane">
          <div class="viewer-toolbar invoice-queue-toolbar invoice-pane-header">
            <div class="invoice-pane-heading">
              <span class="skeleton skeleton-line" style="width: 26%;"></span>
              <span class="skeleton skeleton-line" style="width: 42%; height: 20px;"></span>
              <span class="skeleton skeleton-line" style="width: 78%;"></span>
            </div>
            <span class="skeleton skeleton-chip"></span>
          </div>
          <div class="invoice-queue-controls">
            <span class="skeleton skeleton-line" style="width: 16%;"></span>
            <span class="skeleton skeleton-block" style="width: 160px; height: 38px;"></span>
            <span class="skeleton skeleton-line" style="width: 22%;"></span>
          </div>
          <div class="invoice-filter-summary">
            <span class="skeleton skeleton-chip"></span>
            <span class="skeleton skeleton-chip"></span>
            <span class="skeleton skeleton-chip"></span>
          </div>
          <div class="queue-page-list invoice-queue-list">
            ${Array.from({ length: 6 }, () => `
              <div class="queue-item invoice-queue-item" aria-hidden="true">
                <span class="invoice-queue-check skeleton skeleton-block" style="width: 18px; height: 18px;"></span>
                <div class="queue-item-body">
                  <div class="queue-item-top">
                    <div class="skeleton-stack" style="flex: 1 1 auto;">
                      <span class="skeleton skeleton-line" style="width: 42%;"></span>
                      <span class="skeleton skeleton-line" style="width: 68%; height: 14px;"></span>
                    </div>
                    <span class="skeleton skeleton-line" style="width: 18%; height: 18px;"></span>
                  </div>
                  <span class="skeleton skeleton-line" style="width: 56%;"></span>
                  <div class="invoice-queue-item-footer">
                    <span class="skeleton skeleton-chip"></span>
                    <span class="skeleton skeleton-block" style="width: 10px; height: 10px; border-radius: 50%;"></span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="invoice-queue-footer">
            <span class="skeleton skeleton-line" style="width: 36%;"></span>
            <span class="skeleton skeleton-chip"></span>
          </div>
        </section>
        <section class="viewer-panel invoice-preview-column invoice-pane invoice-preview-pane">
          <div class="viewer-toolbar invoice-document-toolbar">
            <div class="viewer-tools">
              <span class="skeleton skeleton-chip"></span>
              <span class="skeleton skeleton-chip"></span>
              <span class="skeleton skeleton-chip"></span>
              <span class="skeleton skeleton-chip"></span>
            </div>
            <div class="viewer-tools">
              <span class="skeleton skeleton-chip"></span>
              <span class="skeleton skeleton-chip"></span>
              <span class="skeleton skeleton-chip"></span>
            </div>
          </div>
          <div class="invoice-document-frame">
            <div class="skeleton-card-grid">
              <div class="skeleton-card">
                <span class="skeleton skeleton-line" style="width: 30%;"></span>
                <span class="skeleton skeleton-block" style="height: 180px;"></span>
                <span class="skeleton skeleton-block" style="height: 240px;"></span>
                <span class="skeleton skeleton-block" style="height: 120px;"></span>
              </div>
            </div>
          </div>
        </section>
        <aside class="validation-panel invoice-insights-column invoice-pane invoice-insights-pane">
          <section class="invoice-tabs">
            <span class="skeleton skeleton-line" style="width: 30%; height: 18px;"></span>
            <span class="skeleton skeleton-line" style="width: 34%; height: 18px;"></span>
          </section>
          ${Array.from({ length: 5 }, () => `
            <section class="card invoice-insight-card">
              <div class="card-header">
                <div class="skeleton-stack" style="min-width: 200px;">
                  <span class="skeleton skeleton-line" style="width: 36%;"></span>
                  <span class="skeleton skeleton-line" style="width: 64%; height: 18px;"></span>
                </div>
                <span class="skeleton skeleton-chip"></span>
              </div>
              <div class="skeleton-card-grid">
                <div class="skeleton-card"><span class="skeleton skeleton-block" style="height: 92px;"></span></div>
              </div>
            </section>
          `).join('')}
        </aside>
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
    default:
      pageHost.innerHTML = renderGenericLoadingState();
      return;
  }
}

function renderAuthGate(message?: string): void {
  destroyInvoiceCharts();
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
  destroyInvoiceCharts();

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

  const routeRenderers: Record<Route, () => string> = {
    dashboard: () => renderDashboard(dashboardData),
    invoices: () =>
      renderInvoicesPage(
        store.invoices,
        state.globalSearch,
        state.invoiceStatusFilter,
        state.invoiceDateRange,
        state.invoiceDateFrom,
        state.invoiceDateTo,
        state.queueSort,
        state.selectedInvoiceId,
        reviewData,
        state.activeInvoicePanel,
      ),
    analytics: () => renderAnalyticsPage(store.invoices, store.queueRows, dashboardData.validationAlerts, store.syncStatus),
    contracts: () => renderContractsPage(store.invoices, store.queueRows, dashboardData.validationAlerts, store.syncStatus),
    vendors: () => renderVendorsPage(store.invoices, store.queueRows, dashboardData.validationAlerts, store.syncStatus),
    reports: () => renderReportsPage(store.invoices, store.queueRows, dashboardData.validationAlerts, store.syncStatus),
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
  if (state.route === 'invoices') {
    applyInvoiceColumnLayout();
  }
  appShell.dataset['sidebar'] = state.sidebarCollapsed ? 'collapsed' : 'expanded';
  applyWorkspaceSettings();
  globalSearch.value = state.globalSearch;
  updateNavState();
  updateQueueCount();
  updateNotificationCount();
  renderInvoiceCharts();
  applyInvoiceZoom();
  document.body.classList.toggle('modal-open', state.invoicePreviewOpen);
  syncProfile();
}

function clearSearch(): void {
  state.globalSearch = '';
  globalSearch.value = '';
  render();
}

function resetInvoiceFilters(): void {
  state.globalSearch = '';
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

  // On the invoices page, update only the queue list (ajax-like) to avoid rebuilding the page.
  if (state.route === 'invoices' && updateInvoiceQueueInPlace()) {
    return;
  }

  render();
}

function handleSearchUpdate(value: string, sourceInput?: HTMLInputElement): void {
  const isDashboardSearch = sourceInput?.matches('[data-input="page-search"]') ?? false;

  if (isDashboardSearch) {
    state.dashboardSearch = value;
  } else {
    state.globalSearch = value;
  }

  if (state.route === 'invoices' && updateInvoiceQueueInPlace()) {
    return;
  }

  const preserveDashboardSearchFocus = state.route === 'dashboard' && isDashboardSearch;
  const selectionStart = preserveDashboardSearchFocus ? sourceInput?.selectionStart ?? value.length : null;
  const selectionEnd = preserveDashboardSearchFocus ? sourceInput?.selectionEnd ?? value.length : null;

  render();

  if (preserveDashboardSearchFocus) {
    const nextSearchInput = pageHost.querySelector<HTMLInputElement>('[data-input="page-search"]');
    if (nextSearchInput) {
      nextSearchInput.focus({ preventScroll: true });
      const nextStart = Math.min(selectionStart ?? value.length, nextSearchInput.value.length);
      const nextEnd = Math.min(selectionEnd ?? value.length, nextSearchInput.value.length);
      nextSearchInput.setSelectionRange(nextStart, nextEnd);
    }
  }
}

function toggleSidebar(): void {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  applySidebarState();
  persistWorkspaceSettings();
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

async function reloadData(selectedInvoiceId = state.selectedInvoiceId, options: ReloadOptions = {}): Promise<void> {
  const silent = options.silent ?? false;

  if (!silent) {
    state.loading = true;
  }

  state.error = null;

  if (!silent) {
    render();
  }

  try {
    const [invoices, queue, syncStatus] = await Promise.all([
      api.getInvoices(),
      api.getQueue(),
      api.getSyncStatus(),
    ]);

    store.invoices = invoices;
    store.queue = queue;
    store.queueRows = buildQueueRows();
    store.syncStatus = syncStatus;

    if (!selectedInvoiceId || !store.invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)) {
      selectedInvoiceId = store.invoices[0]?.invoiceId ?? '';
    }

    state.selectedInvoiceId = selectedInvoiceId;

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
  state.activeInvoicePanel = 'insights';
  state.invoicePreviewOpen = false;
  syncBrowserLocation('invoices', '', false, false);
  await loadReviewBundle(invoiceId);
  render();
}

async function refreshAfterMutation(successMessage: string): Promise<void> {
  showToast(successMessage);
  store.selected.delete(state.selectedInvoiceId);
  await reloadData(state.selectedInvoiceId, { silent: true });
}

function setInvoiceActionButtonsBusy(isBusy: boolean): void {
  const selectors = ['validate-invoice', 'approve-invoice', 'send-back']
    .map((action) => `.invoices-page [data-action="${action}"]`)
    .join(', ');

  pageHost.querySelectorAll<HTMLButtonElement>(selectors).forEach((button) => {
    button.disabled = isBusy;
    button.setAttribute('aria-busy', String(isBusy));
  });
}

async function runInvoiceMutation(
  actionLabel: string,
  operation: () => Promise<unknown>,
  successMessage: string,
): Promise<void> {
  if (!state.selectedInvoiceId || invoiceMutationInFlight) {
    return;
  }

  invoiceMutationInFlight = true;
  setInvoiceActionButtonsBusy(true);

  try {
    await operation();
    await refreshAfterMutation(successMessage);
  } catch (error) {
    showMutationError(actionLabel, error);
  } finally {
    invoiceMutationInFlight = false;
    setInvoiceActionButtonsBusy(false);
  }
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
    case 'switch-invoice-panel':
      {
        const panel = actionElement.getAttribute('data-panel') as InvoicePanelTab | null;
        if (panel) {
          state.activeInvoicePanel = panel;
          // Toggle panels in place so the page stays still (no rebuild/shake).
          if (!switchInvoicePanelInPlace(panel)) {
            render();
          }
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
      state.dashboardSearch = '';
      render();
      break;
    case 'download-pdf':
      if (state.selectedInvoiceId) {
        const url = api.getInvoiceSnapshotUrl(state.selectedInvoiceId);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = '';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        showToast('Downloading invoice document.');
      } else {
        showToast('Select an invoice to download.');
      }
      break;
    case 'print-invoice':
      window.print();
      break;
    case 'more-actions':
      if (state.selectedInvoiceId) {
        window.open(api.getInvoiceSnapshotUrl(state.selectedInvoiceId), '_blank', 'noopener');
      } else {
        showToast('Select an invoice first.');
      }
      break;
    case 'prev-invoice':
      navigateInvoiceBy(-1);
      break;
    case 'next-invoice':
      navigateInvoiceBy(1);
      break;
    case 'zoom-in':
      setInvoiceZoom(invoiceZoom + 0.1);
      break;
    case 'zoom-out':
      setInvoiceZoom(invoiceZoom - 0.1);
      break;
    case 'zoom-reset':
      setInvoiceZoom(1);
      break;
    case 'load-more':
      showToast('All available invoices are already loaded.');
      break;
    case 'open-portal':
      showToast('OpenInvoice portal link is ready.');
      break;
    case 'validate-invoice':
      if (state.selectedInvoiceId) {
        void runInvoiceMutation('Validate', () => api.validateInvoice(state.selectedInvoiceId), 'Invoice validation completed.');
      }
      break;
    case 'approve-invoice':
      if (state.selectedInvoiceId) {
        void runInvoiceMutation('Approve', () => api.approveInvoice(state.selectedInvoiceId), 'Invoice approved and audit entry created.');
      }
      break;
    case 'send-back':
      if (state.selectedInvoiceId) {
        void runInvoiceMutation('Send back', () => api.sendBackInvoice(state.selectedInvoiceId), 'Invoice sent back for review.');
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
    handleSearchUpdate(target.value, target);
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

document.addEventListener('pointerdown', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const handle = target.closest<HTMLElement>('[data-resizer]');
  if (!handle || state.route !== 'invoices' || window.matchMedia('(max-width: 820px)').matches) {
    return;
  }

  const workspace = pageHost.querySelector<HTMLElement>('.invoices-page .workspace');
  const queuePanel = workspace?.querySelector<HTMLElement>('.panel.queue');
  const insightsPanel = workspace?.querySelector<HTMLElement>('.panel.insights');
  if (!workspace || !queuePanel || !insightsPanel) {
    return;
  }

  const mode = handle.getAttribute('data-resizer');
  if (mode !== 'queue' && mode !== 'insights') {
    return;
  }

  event.preventDefault();

  const startX = event.clientX;
  const startQueueWidth = queuePanel.getBoundingClientRect().width;
  const startInsightsWidth = insightsPanel.getBoundingClientRect().width;
  let layout: InvoiceColumnLayout = clampInvoiceColumnLayout(workspace, {
    queueWidth: startQueueWidth,
    insightsWidth: startInsightsWidth,
  });

  document.body.classList.add('invoice-resizing');

  const dragAbort = new AbortController();
  const onPointerMove = (moveEvent: PointerEvent): void => {
    const deltaX = moveEvent.clientX - startX;

    if (mode === 'queue') {
      layout = clampInvoiceColumnLayout(workspace, {
        queueWidth: startQueueWidth + deltaX,
        insightsWidth: startInsightsWidth,
      });
    } else {
      layout = clampInvoiceColumnLayout(workspace, {
        queueWidth: startQueueWidth,
        insightsWidth: startInsightsWidth - deltaX,
      });
    }

    workspace.style.setProperty('--invoice-queue-width', `${layout.queueWidth}px`);
    workspace.style.setProperty('--invoice-insights-width', `${layout.insightsWidth}px`);
  };

  const stopDragging = (): void => {
    dragAbort.abort();
    document.body.classList.remove('invoice-resizing');
    persistInvoiceColumnLayout(layout);
  };

  document.addEventListener('pointermove', onPointerMove, { signal: dragAbort.signal });
  document.addEventListener('pointerup', stopDragging, { once: true, signal: dragAbort.signal });
  document.addEventListener('pointercancel', stopDragging, { once: true, signal: dragAbort.signal });
});

window.addEventListener('resize', () => {
  if (state.route === 'invoices') {
    applyInvoiceColumnLayout();
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
    handleSearchUpdate(target.value, target);
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
