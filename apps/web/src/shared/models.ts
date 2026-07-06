export type Route =
  | 'dashboard'
  | 'invoices'
  | 'comparison'
  | 'compliance-queue'
  | 'validation-summary'
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

export interface AppState {
  route: Route;
  selectedInvoiceId: string;
  selectedComparisonLocalInvoiceId: number;
  comparisonDetailFieldIndex: number | null;
  invoicePreviewOpen: boolean;
  search: string;
  sidebarCollapsed: boolean;
  dashboardDateRange: DateRangeFilter;
  dashboardDateFrom: string;
  dashboardDateTo: string;
  invoiceStatusFilter: InvoiceStatusFilter;
  invoiceDateRange: DateRangeFilter;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  queueSort: QueueSortFilter;
  compactTypography: boolean;
  queueAutoScroll: boolean;
  comparisonLoading: boolean;
  comparisonError: string | null;
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

export interface InvoiceDetailDto extends InvoiceSummaryDto {}

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

export interface InvoiceComparisonResultDto {
  ruleCode: string;
  label: string;
  status: string;
  severity: string;
  localValue: string | null;
  systemValue: string | null;
  message: string | null;
}

export interface InvoiceComparisonRunDto {
  comparisonRunId: number;
  localInvoiceFile: LocalInvoiceFileDto;
  systemInvoiceId: string | null;
  matchStatus: string;
  overallStatus: string;
  matchScore: number | null;
  createdAtUtc: string;
  systemInvoice: NormalizedInvoice | null;
  results: InvoiceComparisonResultDto[];
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
  vendorBars: VendorBar[];
  recentInvoices: InvoiceSummaryDto[];
  filteredInvoices: InvoiceSummaryDto[];
  search: string;
  dashboardDateRange: DateRangeFilter;
  dashboardDateFrom: string;
  dashboardDateTo: string;
}

export interface ComparisonFieldViewModel {
  ruleCode: string;
  label: string;
  scope: string;
  status: string;
  category: 'Match' | 'Warning' | 'Mismatch' | 'Missing from SQL' | 'Missing from vendor/OpenInvoice side' | 'Not enough data to compare';
  localValue: string;
  systemValue: string;
  message: string;
  severity: string;
}

export interface ComparisonViewData {
  localInvoices: LocalInvoiceFileDto[];
  selectedLocalInvoice: LocalInvoiceFileDto | null;
  comparisonRun: InvoiceComparisonRunDto | null;
  fields: ComparisonFieldViewModel[];
  selectedFieldIndex: number | null;
  selectedField: ComparisonFieldViewModel | null;
  groupedResults: {
    header: ComparisonFieldViewModel[];
    lineItems: ComparisonFieldViewModel[];
    guardrails: ComparisonFieldViewModel[];
  };
  pdfUrl: string | null;
  loading: boolean;
  error: string | null;
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
  invoiceCount: number;
  queueCount: number;
  approvedCount: number;
  selectedInvoiceId: string;
  selectedInvoiceStatus: string;
  lastUpdated: string;
  compactTypography: boolean;
  queueAutoScroll: boolean;
}

export interface AuthProfile {
  displayName: string;
  initials: string;
  email: string;
  photoDataUrl?: string | null;
}

export interface RuntimeAuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scopes: string[];
}
