// Internal email provider contract. Business logic (e.g. OTP delivery)
// depends only on these types; provider request/response shapes stay in the adapter.

export interface SendEmailRequest {
  to: string;
  subject: string;
  /** Plain-text body; always sent so every client can read it. */
  text: string;
  html?: string;
}

export interface EmailResult {
  provider: string;
  messageId: string | null;
}

export interface EmailProvider {
  readonly id: string;
  send(request: SendEmailRequest): Promise<EmailResult>;
}
