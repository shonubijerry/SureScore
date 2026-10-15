// Session issuance/verification. Sessions are JWTs (so verification needs no
// storage round trip to check the signature/expiry) backed by a KV record
// keyed on a hash of the token, so a session can be revoked (e.g. logout)
// without waiting out its TTL. KV's native expirationTtl also means revoked
// or expired sessions clean themselves up with no separate job.

import { sign, verify } from "hono/jwt";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sessionKey(tokenHash: string): string {
  return `session:${tokenHash}`;
}

/**
 * A user's session generation. Signing out everywhere (e.g. a password reset)
 * bumps it, voiding every session issued under an older generation. A counter
 * rather than a timestamp, so it never depends on clock resolution.
 */
const generationKey = (userId: string) => `sessions:generation:${userId}`;

interface SessionRecord {
  userId: string;
  /** Absent on sessions created before bulk revocation existed (= generation 0). */
  generation?: number;
}

const readGeneration = async (sessions: KVNamespace, userId: string) => Number((await sessions.get(generationKey(userId))) ?? 0);

export async function createSession(
  sessions: KVNamespace,
  authSecret: string,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSeconds + SESSION_TTL_SECONDS) * 1000);

  const token = await sign(
    // `jti` makes every token unique: without it, two sessions for one user in
    // the same second would be identical and share (and overwrite) one KV record.
    { sub: userId, jti: crypto.randomUUID(), iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS },
    authSecret,
  );

  const record: SessionRecord = { userId, generation: await readGeneration(sessions, userId) };
  await sessions.put(sessionKey(await hashToken(token)), JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { token, expiresAt };
}

export async function verifySession(
  sessions: KVNamespace,
  authSecret: string,
  token: string,
): Promise<{ userId: string }> {
  let payload: Record<string, unknown>;
  try {
    payload = await verify(token, authSecret, "HS256");
  } catch {
    throw new AuthError("Invalid or expired session token.");
  }

  if (typeof payload.sub !== "string") {
    throw new AuthError("Invalid session token payload.");
  }

  const [record, generation] = await Promise.all([
    sessions.get<SessionRecord>(sessionKey(await hashToken(token)), "json"),
    readGeneration(sessions, payload.sub),
  ]);
  if (!record || (record.generation ?? 0) < generation) {
    throw new AuthError("Session has been revoked or expired.");
  }

  return { userId: record.userId };
}

/** Signs a user out of every existing session; sessions created afterwards are valid. */
export async function revokeAllSessions(sessions: KVNamespace, userId: string): Promise<void> {
  await sessions.put(generationKey(userId), String((await readGeneration(sessions, userId)) + 1));
}

export async function revokeSession(sessions: KVNamespace, token: string): Promise<void> {
  await sessions.delete(sessionKey(await hashToken(token)));
}

