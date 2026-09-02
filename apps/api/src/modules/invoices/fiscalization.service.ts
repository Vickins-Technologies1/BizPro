import { Injectable } from "@nestjs/common";

export interface FiscalizationRequest {
  invoiceId: string;
  businessId: string;
  invoiceNumber: string;
  payload: Record<string, unknown>;
}

export interface FiscalizationOutcome {
  status: "not_configured" | "pending" | "submitted" | "cancelled" | "voided" | "credited" | "debited" | "failed";
  reference?: string | null;
  documentNumber?: string | null;
  response?: Record<string, unknown> | null;
  error?: string | null;
  payloadReference?: string | null;
}

export interface FiscalizationProvider {
  validateInvoice(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  submitInvoice(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  getInvoiceStatus(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  getFiscalDocument(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  cancelInvoice(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  voidInvoice(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  creditNote(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
  debitNote(request: FiscalizationRequest): Promise<FiscalizationOutcome>;
}

class NoopFiscalizationProvider implements FiscalizationProvider {
  async validateInvoice(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async submitInvoice(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async getInvoiceStatus(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async getFiscalDocument(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async cancelInvoice(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async voidInvoice(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async creditNote(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }

  async debitNote(): Promise<FiscalizationOutcome> {
    return { status: "not_configured" };
  }
}

@Injectable()
export class FiscalizationService {
  constructor(private readonly provider: FiscalizationProvider = new NoopFiscalizationProvider()) {}

  validateInvoice(request: FiscalizationRequest) {
    return this.provider.validateInvoice(request);
  }

  submitInvoice(request: FiscalizationRequest) {
    return this.provider.submitInvoice(request);
  }

  getInvoiceStatus(request: FiscalizationRequest) {
    return this.provider.getInvoiceStatus(request);
  }

  getFiscalDocument(request: FiscalizationRequest) {
    return this.provider.getFiscalDocument(request);
  }

  cancelInvoice(request: FiscalizationRequest) {
    return this.provider.cancelInvoice(request);
  }

  voidInvoice(request: FiscalizationRequest) {
    return this.provider.voidInvoice(request);
  }

  creditNote(request: FiscalizationRequest) {
    return this.provider.creditNote(request);
  }

  debitNote(request: FiscalizationRequest) {
    return this.provider.debitNote(request);
  }
}
