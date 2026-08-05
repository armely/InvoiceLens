import {
  DateRangeFilter,
  InvoiceStatusTone,
  InvoiceSummaryDto,
  QueueRow,
  ValidationTone,
} from './models.js';

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function initials(name: unknown): string {
  return asText(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function normalizeLabel(value: unknown): string {
  return asText(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

export function formatDateTime(value: unknown): string {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return asText(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export function formatDate(value: unknown): string {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return asText(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function formatRelativeTime(value: unknown): string {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return asText(value);
  }

  const deltaMs = parsed.getTime() - Date.now();
  const minutes = Math.round(Math.abs(deltaMs) / 60000);
  const suffix = deltaMs >= 0 ? 'from now' : 'ago';

  if (minutes < 60) {
    return `${minutes}m ${suffix}`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${suffix}`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ${suffix}`;
}

export function invoiceStatusTone(status: unknown): InvoiceStatusTone {
  const normalized = asText(status).toLowerCase();
  if (normalized.includes('approved')) {
    return 'approved';
  }

  if (normalized.includes('sent') || normalized.includes('exception')) {
    return 'exception';
  }

  return 'pending';
}

export function validationTone(status: unknown): ValidationTone {
  const normalized = asText(status).toLowerCase();
  if (normalized === 'pass') {
    return 'pass';
  }

  if (normalized === 'warning') {
    return 'warning';
  }

  return 'fail';
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateInput(value: string): Date | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDayEnd(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function getReferenceDate(invoices: InvoiceSummaryDto[]): Date {
  const parsedDates = invoices
    .map((invoice) => parseDate(invoice.updatedAtUtc) ?? parseDate(invoice.createdAtUtc))
    .filter((value): value is Date => value !== null)
    .sort((left, right) => right.getTime() - left.getTime());

  return parsedDates[0] ?? new Date();
}

function getInvoiceDate(invoice: InvoiceSummaryDto): Date | null {
  return parseDate(invoice.updatedAtUtc) ?? parseDate(invoice.createdAtUtc);
}

function compareUnapprovedFirst(leftStatus: unknown, rightStatus: unknown): number {
  const leftApproved = invoiceStatusTone(leftStatus) === 'approved' ? 1 : 0;
  const rightApproved = invoiceStatusTone(rightStatus) === 'approved' ? 1 : 0;
  return leftApproved - rightApproved;
}

export function matchesDateRange(invoice: InvoiceSummaryDto, dateRange: DateRangeFilter, referenceInvoices: InvoiceSummaryDto[]): boolean {
  if (dateRange === 'All Time') {
    return true;
  }

  const invoiceDate = getInvoiceDate(invoice);
  if (!invoiceDate) {
    return false;
  }

  const referenceDate = toDayEnd(getReferenceDate(referenceInvoices.length ? referenceInvoices : [invoice]));

  if (dateRange === 'Last 30 Days') {
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - 29);
    return invoiceDate.getTime() >= toDayStart(start).getTime() && invoiceDate.getTime() <= referenceDate.getTime();
  }

  if (dateRange === 'This Week') {
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - 6);
    return invoiceDate.getTime() >= toDayStart(start).getTime() && invoiceDate.getTime() <= referenceDate.getTime();
  }

  const quarterReference = getReferenceDate(referenceInvoices.length ? referenceInvoices : [invoice]);
  const quarterStartMonth = Math.floor(quarterReference.getMonth() / 3) * 3;
  const start = new Date(quarterReference.getFullYear(), quarterStartMonth, 1);
  const end = new Date(quarterReference.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
  return invoiceDate.getTime() >= start.getTime() && invoiceDate.getTime() <= end.getTime();
}

function matchesCustomDateWindow(invoice: InvoiceSummaryDto, fromDate: string, toDate: string): boolean {
  const invoiceDate = getInvoiceDate(invoice);
  if (!invoiceDate) {
    return false;
  }

  const rawStart = parseDateInput(fromDate);
  const rawEnd = parseDateInput(toDate);

  let start = rawStart;
  let end = rawEnd;

  if (start && end && start.getTime() > end.getTime()) {
    [start, end] = [end, start];
  }

  if (start && invoiceDate.getTime() < toDayStart(start).getTime()) {
    return false;
  }

  if (end && invoiceDate.getTime() > toDayEnd(end).getTime()) {
    return false;
  }

  return true;
}

export function applyInvoiceFilters(
  invoices: InvoiceSummaryDto[],
  options: {
    search?: string;
    status?: 'All Statuses' | 'Pending Review' | 'Sent Back' | 'Approved';
    dateRange?: DateRangeFilter;
    dateFrom?: string;
    dateTo?: string;
    sort?: 'Oldest First' | 'Newest First' | 'Highest Amount';
  } = {},
): InvoiceSummaryDto[] {
  const search = options.search?.trim().toLowerCase() ?? '';
  const dateRange = options.dateRange;
  const searchFiltered = search
    ? invoices.filter((invoice) =>
        [
          invoice.invoiceNumber,
          invoice.vendor,
          invoice.company,
          invoice.afe,
          invoice.currency,
          invoice.status,
          formatCurrency(invoice.amount, invoice.currency),
          invoice.createdAtUtc,
          invoice.updatedAtUtc,
        ].some((value) => String(value).toLowerCase().includes(search)),
      )
    : invoices;

  const statusFiltered =
    options.status && options.status !== 'All Statuses'
      ? searchFiltered.filter((invoice) => normalizeLabel(invoice.status) === options.status)
      : searchFiltered;

  const rangeFiltered = dateRange ? statusFiltered.filter((invoice) => matchesDateRange(invoice, dateRange, invoices)) : statusFiltered;
  const hasCustomRange = Boolean(options.dateFrom?.trim() || options.dateTo?.trim());
  const dateFiltered = hasCustomRange
    ? rangeFiltered.filter((invoice) => matchesCustomDateWindow(invoice, options.dateFrom ?? '', options.dateTo ?? ''))
    : rangeFiltered;

  if (options.sort === 'Newest First') {
    return [...dateFiltered].sort((left, right) => {
      const priority = compareUnapprovedFirst(left.status, right.status);
      if (priority !== 0) {
        return priority;
      }

      const leftDate = parseDate(left.updatedAtUtc)?.getTime() ?? parseDate(left.createdAtUtc)?.getTime() ?? 0;
      const rightDate = parseDate(right.updatedAtUtc)?.getTime() ?? parseDate(right.createdAtUtc)?.getTime() ?? 0;
      return rightDate - leftDate;
    });
  }

  if (options.sort === 'Oldest First') {
    return [...dateFiltered].sort((left, right) => {
      const priority = compareUnapprovedFirst(left.status, right.status);
      if (priority !== 0) {
        return priority;
      }

      const leftDate = parseDate(left.createdAtUtc)?.getTime() ?? parseDate(left.updatedAtUtc)?.getTime() ?? 0;
      const rightDate = parseDate(right.createdAtUtc)?.getTime() ?? parseDate(right.updatedAtUtc)?.getTime() ?? 0;
      return leftDate - rightDate;
    });
  }

  if (options.sort === 'Highest Amount') {
    return [...dateFiltered].sort((left, right) => {
      const priority = compareUnapprovedFirst(left.status, right.status);
      if (priority !== 0) {
        return priority;
      }

      return right.amount - left.amount;
    });
  }

  return [...dateFiltered].sort((left, right) => {
    const priority = compareUnapprovedFirst(left.status, right.status);
    if (priority !== 0) {
      return priority;
    }

    const leftDate = parseDate(left.updatedAtUtc)?.getTime() ?? parseDate(left.createdAtUtc)?.getTime() ?? 0;
    const rightDate = parseDate(right.updatedAtUtc)?.getTime() ?? parseDate(right.createdAtUtc)?.getTime() ?? 0;
    return rightDate - leftDate;
  });
}

export function applyQueueFilters(rows: QueueRow[], search: string, sort: 'Oldest First' | 'Newest First' | 'Highest Amount'): QueueRow[] {
  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        [row.invoiceNumber, row.vendor, row.reason, row.status, row.amountText, row.queuedAt].some((value) =>
          String(value).toLowerCase().includes(term),
        ),
      )
    : rows;

  if (sort === 'Highest Amount') {
    return [...filtered].sort((left, right) => {
      const priority = compareUnapprovedFirst(left.status, right.status);
      if (priority !== 0) {
        return priority;
      }

      return right.amount - left.amount;
    });
  }

  return [...filtered].sort((left, right) => {
    const priority = compareUnapprovedFirst(left.status, right.status);
    if (priority !== 0) {
      return priority;
    }

    const leftDate = parseDate(left.queuedAt)?.getTime() ?? 0;
    const rightDate = parseDate(right.queuedAt)?.getTime() ?? 0;
    return sort === 'Newest First' ? rightDate - leftDate : leftDate - rightDate;
  });
}
