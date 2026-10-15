// Internal SMS provider contract. Business logic (e.g. OTP delivery) depends
// only on these types; provider request/response shapes stay in the adapter.

export interface SendSmsRequest {
  /** Recipient in E.164 form, e.g. "+2348012345678". */
  to: string;
  body: string;
}

export interface SmsResult {
  provider: string;
  /** Provider message id, for delivery-status lookups. */
  messageId: string | null;
  status: "queued" | "sent" | "failed";
}

export interface SmsProvider {
  readonly id: string;
  send(request: SendSmsRequest): Promise<SmsResult>;
}
