/**
 * Verifies that a payout account name corresponds to the user's registered name.
 * Handles case-insensitivity, whitespace variations, and name ordering (e.g. Surname Firstname).
 */
export function isNameMatching(accountName: string, userName: string): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

  const wordsA = clean(accountName);
  const wordsB = clean(userName);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  // Exact match
  if (wordsA.join(" ") === wordsB.join(" ")) return true;

  // Same words in different order (e.g., "Doe John" vs "John Doe")
  if ([...wordsA].sort().join(" ") === [...wordsB].sort().join(" ")) return true;

  // Subset match: if user has 2+ names and account has 2+ names, check if all words of one appear in the other
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const intersection = wordsA.filter((w) => setB.has(w));
  if (intersection.length >= 2) {
    if (intersection.length === setA.size || intersection.length === setB.size) {
      return true;
    }
  }

  // If one side has only 1 name and that 1 name is in the other side with length >= 3
  if ((wordsA.length === 1 || wordsB.length === 1) && intersection.length >= 1) {
    if (intersection.some((w) => w.length >= 3)) {
      return true;
    }
  }

  return false;
}
