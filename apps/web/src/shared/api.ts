import {
  AuditEntryDto,
  InvoiceDetailDto,
  InvoiceReviewDto,
  InvoiceSummaryDto,
  QueueItemDto,
  SyncStatusDto,
  ValidationSummaryDto,
} from './models.js';

type RequestInitWithJson = RequestInit & {
  body?: BodyInit | null;
};

export class ApiAuthorizationError extends Error {
  constructor(message = 'Microsoft authentication is required.') {
    super(message);
    this.name = 'ApiAuthorizationError';
  }
}

export class InvoiceLensApiClient {
  constructor(private readonly baseUrl = '') {}

  private async buildRequestError(path: string, response: Response): Promise<Error> {
    let details = '';

    try {
      const bodyText = (await response.text()).trim();
      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText) as { message?: string; error?: string };
          details = (parsed.message ?? parsed.error ?? bodyText).trim();
        } catch {
          details = bodyText;
        }
      }
    } catch {
      // If reading the body fails, fall back to status-only error text.
    }

    const base = `Request failed (${response.status} ${response.statusText}) for ${path}`;
    return new Error(details ? `${base}. ${details}` : base);
  }

  private buildUrl(path: string): string {
    if (!this.baseUrl) {
      return path;
    }

    return new URL(path, this.baseUrl).toString();
  }

  private async requestJson<T>(path: string, init: RequestInitWithJson = {}): Promise<T> {
    const response = await fetch(this.buildUrl(path), {
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      credentials: 'include',
      ...init,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiAuthorizationError(`Microsoft authentication is required for ${path}.`);
      }

      throw await this.buildRequestError(path, response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async requestOptionalJson<T>(path: string, init: RequestInitWithJson = {}): Promise<T | null> {
    const response = await fetch(this.buildUrl(path), {
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
      credentials: 'include',
      ...init,
    });

    if (response.status === 404 || response.status === 204) {
      return null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiAuthorizationError(`Microsoft authentication is required for ${path}.`);
      }

      throw await this.buildRequestError(path, response);
    }

    return (await response.json()) as T;
  }

  async getInvoices(query = ''): Promise<InvoiceSummaryDto[]> {
    const trimmedQuery = query.trim();
    const path = trimmedQuery ? `/api/invoices?query=${encodeURIComponent(trimmedQuery)}` : '/api/invoices';
    return this.requestJson<InvoiceSummaryDto[]>(path);
  }

  async getInvoice(invoiceId: string): Promise<InvoiceDetailDto> {
    return this.requestJson<InvoiceDetailDto>(`/api/invoices/${invoiceId}`);
  }

  async getReview(invoiceId: string): Promise<InvoiceReviewDto | null> {
    return this.requestOptionalJson<InvoiceReviewDto>(`/api/invoices/${invoiceId}/review`);
  }

  async getValidationSummary(invoiceId: string): Promise<ValidationSummaryDto | null> {
    return this.requestOptionalJson<ValidationSummaryDto>(`/api/invoices/${invoiceId}/validation-summary`);
  }

  async getAuditTrail(invoiceId: string): Promise<AuditEntryDto[]> {
    return this.requestJson<AuditEntryDto[]>(`/api/invoices/${invoiceId}/audit`);
  }

  async getQueue(): Promise<QueueItemDto[]> {
    return this.requestJson<QueueItemDto[]>('/api/queue');
  }

  getLocalInvoicePdfUrl(localInvoiceFileId: number): string {
    return this.buildUrl(`/api/local-invoices/${localInvoiceFileId}/pdf`);
  }

  getInvoiceSnapshotUrl(invoiceId: string): string {
    return this.buildUrl(`/api/invoices/${encodeURIComponent(invoiceId)}/snapshot`);
  }

  async getSyncStatus(): Promise<SyncStatusDto> {
    return this.requestJson<SyncStatusDto>('/api/sync/status');
  }

  async runSync(): Promise<{ imported: number }> {
    return this.requestJson<{ imported: number }>('/api/sync/run', { method: 'POST' });
  }

  async validateInvoice(invoiceId: string): Promise<ValidationSummaryDto> {
    return this.requestJson<ValidationSummaryDto>(`/api/invoices/${invoiceId}/validate`, { method: 'POST' });
  }

  async approveInvoice(invoiceId: string): Promise<void> {
    await this.requestJson<void>(`/api/invoices/${invoiceId}/approve`, { method: 'POST' });
  }

  async sendBackInvoice(invoiceId: string): Promise<void> {
    await this.requestJson<void>(`/api/invoices/${invoiceId}/send-back`, { method: 'POST' });
  }

  async sendAdminTestEmail(recipientEmail?: string): Promise<{ message: string; recipientEmail: string; sent: boolean }> {
    return this.requestJson<{ message: string; recipientEmail: string; sent: boolean }>('/api/admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: recipientEmail?.trim() || null }),
    });
  }
}
