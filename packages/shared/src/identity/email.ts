// Email addresses are stored and compared trimmed and lowercased, so the
// unique index treats "Ada@Example.com" and "ada@example.com" as one account.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A pragmatic shape check (one "@", a dot in the domain, no spaces); delivery is what truly verifies it. */
export const isEmailAddress = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
