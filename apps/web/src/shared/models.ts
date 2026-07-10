export type Route =
  | 'dashboard'
  | 'invoices'
  | 'analytics'
  | 'contracts'
  | 'vendors'
  | 'reports'
  | 'notifications'
  | 'help'
  | 'admin';

export type InvoiceStatusTone = 'pending' | 'exception' | 'approved';
export type QueueTone = 'orange' | 'blue' | 'purple' | 'red' | 'teal';
export type AlertTone = 'red' | 'amber' | 'blue' | 'teal';
export type VendorTone = 'red' | 'orange' | 'teal' | 'green' | '';
export type MetricTone = 'blue' | 'amber' | 'red' | 'green';
export type ValidationTone = 'pass' | 'warning' | 'fail';

export type DateRangeFilter = 'All Time' | 'Last 30 Days' | 'This Week' | 'This Quarter';
export type InvoiceStatusFilter = 'All Statuses' | 'Pending Review' | 'Sent Back' | 'Approved';
export type QueueSortFilter = 'Oldest First' | 'Newest First' | 'Highest Amount';
export type InvoicePanelTab = 'insights' | 'details';

export interface AppState {
  route: Route;
  selectedInvoiceId: string;
  invoicePreviewOpen: boolean;
  activeInvoicePanel: InvoicePanelTab;
  globalSearch: string;
  dashboardSearch: string;
  sidebarCollapsed: boolean;
  dashboardDateRange: DateRangeFilter;
  dashboardDateFrom: string;
  dashboardDateTo: string;
  reportsDateRange: DateRangeFilter;
  reportsDateFrom: string;
  reportsDateTo: string;
  vendorInvoiceSearch: string;
  vendorInvoiceStatusFilter: InvoiceStatusFilter;
  vendorInvoiceSort: QueueSortFilter;
  vendorInvoiceExpandedCompanies: string[] | null;
  invoiceStatusFilter: InvoiceStatusFilter;
  invoiceDateRange: DateRangeFilter;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  queueSort: QueueSortFilter;
  compactTypography: boolean;
  queueAutoScroll: boolean;
  emailAlertsEnabled: boolean;
  emailAlertSyncFailures: boolean;
  emailAlertQueueBacklog: boolean;
  emailAlertApprovalChanges: boolean;
  loading: boolean;
  error: string | null;
}

export interface InvoiceSummaryDto {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  company: string;
  afe: string;
  amount: number;
  currency: string;
  status: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface InvoiceContactDto {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  email: string;
  phone: string;
}

export interface InvoicePreviewLineItemDto {
  lineNumber: number;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceTotalsDto {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export interface InvoiceDetailDto extends InvoiceSummaryDto {
  invoiceDateUtc: string | null;
  dueDateUtc: string | null;
  billTo: InvoiceContactDto;
  vendorContact: InvoiceContactDto;
  paymentTerms: string | null;
  notes: string | null;
  totals: InvoiceTotalsDto;
  lineItems: InvoicePreviewLineItemDto[];
}

export interface InvoiceReviewDto {
  invoice: InvoiceDetailDto;
  validationHighlights: string[];
  attachments: string[];
}

export interface QueueItemDto {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  reason: string;
  queuedAt: string;
}

export interface LocalInvoiceFileDto {
  localInvoiceFileId: number;
  fileName: string;
  filePath: string;
  metadataPath: string | null;
  invoiceNumber: string | null;
  supplierNumber: string | null;
  supplierName: string | null;
  totalAmount: number | null;
  loadedAtUtc: string;
  lastComparedAtUtc: string | null;
  lastMatchStatus: string | null;
  lastOverallStatus: string | null;
  lastMatchScore: number | null;
}

export interface InvoiceLineItemDto {
  lineNumber: number;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  coding: string | null;
}

export interface NormalizedInvoice {
  invoiceId: string | null;
  invoiceNumber: string;
  supplierNumber: string | null;
  supplierName: string | null;
  invoiceDate: string | null;
  purchaseOrderNumber: string | null;
  afeNumber: string | null;
  costCenter: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  totalAmount: number | null;
  status: string | null;
  exportStatus: string | null;
  paymentStatus: string | null;
  lineItems: InvoiceLineItemDto[];
}

export interface ValidationCheckDto {
  ruleName: string;
  status: string;
  severity: string;
  message: string;
}

export interface ValidationSummaryDto {
  invoiceId: string;
  overallStatus: string;
  checks: ValidationCheckDto[];
  executedAt: string;
}

export interface AuditEntryDto {
  auditEntryId: string;
  invoiceId: string;
  actionType: string;
  performedBy: string;
  details: string;
  occurredAtUtc: string;
}

export interface SyncStatusDto {
  status: string;
  lastSuccessfulRunUtc: string;
  pendingItems: number;
  failedItems: number;
}

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  tone: MetricTone;
  icon: string;
}

export interface QueueSummaryItem {
  label: string;
  count: number;
  className: QueueTone;
}

export interface ValidationAlert {
  title: string;
  count: number;
  className: AlertTone;
  message: string;
  invoiceId: string;
  invoiceNo: string;
  amount: string;
}

export interface ValidationCheckViewModel {
  label: string;
  value: string;
  passed: boolean;
}

export interface VendorBar {
  name: string;
  count: number;
  width: number;
  color: VendorTone;
}

export interface QueueRow {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  reason: string;
  queuedAt: string;
  amount: number;
  amountText: string;
  status: string;
  statusTone: InvoiceStatusTone;
}

export interface DashboardViewData {
  metrics: DashboardMetric[];
  queueSummary: QueueSummaryItem[];
  validationAlerts: ValidationAlert[];
  dashboardValidationAlerts: ValidationAlert[];
  vendorBars: VendorBar[];
  recentInvoices: InvoiceSummaryDto[];
  filteredInvoices: InvoiceSummaryDto[];
  dashboardSearch: string;
  dashboardDateRange: DateRangeFilter;
  dashboardDateFrom: string;
  dashboardDateTo: string;
}

export interface ReviewViewData {
  queueRows: QueueRow[];
  review: InvoiceReviewDto | null;
  validationSummary: ValidationSummaryDto | null;
  auditTrail: AuditEntryDto[];
}

export interface ValidationSummaryViewData {
  review: InvoiceReviewDto | null;
  validationSummary: ValidationSummaryDto | null;
  checklist: ValidationCheckViewModel[];
  validationAlerts: ValidationAlert[];
  auditTrail: AuditEntryDto[];
}

export interface AdminViewData {
  syncStatus: SyncStatusDto | null;
  compactTypography: boolean;
  queueAutoScroll: boolean;
  emailAlertsEnabled: boolean;
  emailAlertSyncFailures: boolean;
  emailAlertQueueBacklog: boolean;
  emailAlertApprovalChanges: boolean;
  notificationTargetEmail: string;
  profile: AuthProfile | null;
}

export interface AuthProfile {
  displayName: string;
  initials: string;
  email: string;
  photoDataUrl?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
}

export interface RuntimeAuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
}
