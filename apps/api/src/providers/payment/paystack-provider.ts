// Paystack payment adapter. All Paystack-specific request/response shapes
// and endpoints are isolated here; nothing outside this file may know that
// "Paystack" exists. Only the internal `PaymentProvider` contract is exposed.

import type {
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
}

interface PaystackTransferData {
  reference: string;
  status: string;
  amount: number;
  currency: string;
}

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
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PaystackProviderConfig) {
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl ?? "https://api.paystack.co";
    this.fetchImpl = config.fetchImpl ?? fetch;
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
        currency: request.currency,
        reference: request.idempotencyKey,
        metadata: { potId: request.potId, userId: request.userId, countryCode: request.countryCode },
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

  async refund(request: RefundRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransactionData>("/refund", {
      method: "POST",
      body: JSON.stringify({
        transaction: request.idempotencyKey,
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

  async payout(request: PayoutRequest): Promise<PaymentResult> {
    const { data } = await this.request<PaystackTransferData>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: request.amountMinorUnits,
        currency: request.currency,
        recipient: request.payoutAccountId,
        reference: request.idempotencyKey,
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
        reference: request.idempotencyKey,
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
