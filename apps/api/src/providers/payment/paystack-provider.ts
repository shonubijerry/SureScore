// Paystack payment adapter. All Paystack-specific request/response shapes
// and endpoints are isolated here; nothing outside this file may know that
// "Paystack" exists. Only the internal `PaymentProvider` contract is exposed.

import type {
  CreateRecipientRequest,
  FundPotRequest,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
  PayoutRequest,
  RefundRequest,
  RetryPayoutRequest,
  VerifyPaymentRequest,
} from "@surescore/shared";

export interface PaystackProviderConfig {
  secretKey: string;
  /** Paystack requires a customer email on every transaction; users sign up by phone, so a business address is used. */
  customerEmail?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackTransactionData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  authorization_url?: string;
}

interface PaystackTransferData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
}

const DEFAULT_CUSTOMER_EMAIL = "info@corestack.com.ng";

/** Transfer references may only hold lowercase alphanumerics, "-" and "_"; our idempotency keys use ":". */
export const toTransferReference = (idempotencyKey: string) => idempotencyKey.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

function toInternalStatus(paystackStatus: string): PaymentStatus {
  switch (paystackStatus) {
    case "success":
    case "successful":
      return "successful";
    case "failed":
    case "reversed":
      return "failed";
    default:
      return "pending";
  }
}

export class PaystackProvider implements PaymentProvider {
  readonly id = "paystack";

  private readonly secretKey: string;
  private readonly customerEmail: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PaystackProviderConfig) {
    this.secretKey = config.secretKey;
    this.customerEmail = config.customerEmail || DEFAULT_CUSTOMER_EMAIL;
    this.baseUrl = config.baseUrl ?? "https://api.paystack.co";
    // Bind to globalThis: workerd's fetch requires its original `this`, which
    // an unbound function reference loses ("Illegal invocation").
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
  }

  private async request<T>(path: string, init: RequestInit): Promise<PaystackApiResponse<T>> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const body = (await response.json()) as PaystackApiResponse<T>;
    if (!response.ok || !body.status) {
      throw new Error(`Paystack request to "${path}" failed: ${body.message ?? response.statusText}`);
    }
    return body;
  }

  async fund(request: FundPotRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransactionData>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: request.amountMinorUnits,
        email: request.email ?? this.customerEmail,
        currency: request.currency,
        reference: request.idempotencyKey,
        ...(request.callbackUrl && { callback_url: request.callbackUrl }),
        metadata: { potId: request.potId, userId: request.userId, countryCode: request.countryCode },
      }),
    });
    return {
      provider: this.id,
      reference: data.reference,
      status: toInternalStatus(data.status),
      amountMinorUnits: data.amount ?? request.amountMinorUnits,
      currency: data.currency ?? request.currency,
      ...(data.authorization_url && { checkoutUrl: data.authorization_url }),
    };
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransactionData>("/refund", {
      method: "POST",
      body: JSON.stringify({
        transaction: request.originalReference,
        amount: request.amountMinorUnits,
        currency: request.currency,
        merchant_note: request.reason,
      }),
    });
    return {
      provider: this.id,
      reference: data.reference,
      status: toInternalStatus(data.status),
      amountMinorUnits: data.amount,
      currency: data.currency,
    };
  }

  async createRecipient(request: CreateRecipientRequest): Promise<string> {
    const { data } = await this.request<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: request.accountName,
        account_number: request.accountNumber,
        bank_code: request.bankCode,
        currency: request.currency,
      }),
    });
    return data.recipient_code;
  }

  async payout(request: PayoutRequest): Promise<PaymentResult> {
    if (!request.recipientCode) throw new Error("Paystack payout requires a recipient code.");
    const { data } = await this.request<PaystackTransferData>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: request.amountMinorUnits,
        currency: request.currency,
        recipient: request.recipientCode,
        reference: toTransferReference(request.idempotencyKey),
      }),
    });
    return {
      provider: this.id,
      reference: data.reference,
      status: toInternalStatus(data.status),
      amountMinorUnits: data.amount,
      currency: data.currency,
    };
  }

  async retryPayout(request: RetryPayoutRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransferData>("/transfer/retry", {
      method: "POST",
      body: JSON.stringify({
        transfer_code: request.originalReference,
        reference: toTransferReference(request.idempotencyKey),
      }),
    });
    return {
      provider: this.id,
      reference: data.reference,
      status: toInternalStatus(data.status),
      amountMinorUnits: data.amount,
      currency: data.currency,
    };
  }

  async verify(request: VerifyPaymentRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransactionData>(
      `/transaction/verify/${encodeURIComponent(request.reference)}`,
      { method: "GET" },
    );
    return {
      provider: this.id,
      reference: data.reference,
      status: toInternalStatus(data.status),
      amountMinorUnits: data.amount,
      currency: data.currency,
    };
  }
}
