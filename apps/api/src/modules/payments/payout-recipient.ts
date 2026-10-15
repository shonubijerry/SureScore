// Resolves the provider payout recipient for a payout account. The raw account
// number is decrypted only the first time (or after bank details change); later
// payouts reuse the stored provider recipient code.

import { createDbClient } from "@surescore/db";
import type { PaymentProvider } from "@surescore/shared";
import { decrypt } from "./secure-data.js";

export async function ensureRecipient(env: Env, provider: PaymentProvider, accountId: string, currency: string) {
	const db = createDbClient(env.DB);
	const account = await db.payoutAccount.findUniqueOrThrow({ where: { id: accountId } });
	if (account.providerRecipientCode && account.recipientProvider === provider.id) return account.providerRecipientCode;
	if (!account.bankCode) throw new Error("Payout account has no bank code.");

	const recipientCode = await provider.createRecipient({
		accountName: account.accountName,
		accountNumber: await decrypt(env.PAYOUT_ENCRYPTION_KEY, account.accountNumber),
		bankCode: account.bankCode,
		currency,
	});
	await db.payoutAccount.update({ where: { id: accountId }, data: { providerRecipientCode: recipientCode, recipientProvider: provider.id } });
	return recipientCode;
}
