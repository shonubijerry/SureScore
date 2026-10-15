// Internal payment provider contract (T3.1). Core domain/business logic must
// only ever depend on these types. Provider-specific DTOs (Paystack request/
// response shapes, etc.) must stay inside the adapter that implements this
// interface and must never leak past it.

export interface FundPotRequest {
  potId: string;
  userId: string;
  email?: string;
  countryCode: string;
  currency: string;
  amountMinorUnits: number;
  /** Caller-supplied key so retried calls do not double-charge/double-credit. */
  idempotencyKey: string;
  /** Optional URL where the payment provider redirects after payment. */
  callbackUrl?: string;
}

/** "no-winner": the match settled but nobody predicted, so there was no one to pay. */
export type RefundReason = "postponed" | "abandoned" | "cancelled" | "no-winner";

export interface RefundRequest {
  potId: string;
  userId: string;
  countryCode: string;
  currency: string;
  amountMinorUnits: number;
  reason: RefundReason;
  /** Provider reference of the original funding payment being refunded. */
  originalReference: string;
  /** Potter's refund account. When set the refund is sent there as a transfer; otherwise the funding payment is reversed. */
  payoutAccountId?: string;
  idempotencyKey: string;
}

export interface PayoutRequest {
  potId: string;
  userId: string;
  countryCode: string;
  currency: string;
  amountMinorUnits: number;
  payoutAccountId: string;
  /** Provider recipient reference; resolved via `createRecipient` before the transfer is sent. */
  recipientCode?: string;
  idempotencyKey: string;
}

export interface CreateRecipientRequest {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  currency: string;
}

export interface RetryPayoutRequest {
  /** Reference of the payout attempt being retried. */
  originalReference: string;
  payoutAccountId: string;
  idempotencyKey: string;
}

export interface VerifyPaymentRequest {
  reference: string;
}

export type PaymentStatus = "pending" | "successful" | "failed";

export interface PaymentResult {
  /** Provider id this result came from, e.g. "paystack". */
  provider: string;
  /** Provider-issued reference for the operation; used for verify/retry. */
  reference: string;
  status: PaymentStatus;
  amountMinorUnits: number;
  currency: string;
  /** Where the payer completes a pending payment (fund only). */
  checkoutUrl?: string;
}

export interface PaymentProvider {
  readonly id: string;
  fund(request: FundPotRequest): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<PaymentResult>;
  /** Registers bank details with the provider; returns the reusable recipient reference. */
  createRecipient(request: CreateRecipientRequest): Promise<string>;
  payout(request: PayoutRequest): Promise<PaymentResult>;
  retryPayout(request: RetryPayoutRequest): Promise<PaymentResult>;
  verify(request: VerifyPaymentRequest): Promise<PaymentResult>;
}
