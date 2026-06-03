// Small HTTP conditional-request helpers shared by the /api/v1 media routes.

/** Wrap a raw validator token in double quotes per RFC 7232 (idempotent). */
export function quoteETag(raw: string): string {
  return raw.startsWith('"') ? raw : `"${raw}"`;
}

function core(token: string): string {
  return token
    .trim()
    .replace(/^W\//, "")
    .replace(/^"(.*)"$/, "$1");
}

/**
 * True when an `If-None-Match` header satisfies the current ETag. Handles the
 * comma-separated list form and `*`, and compares ignoring weak/quote framing
 * so a client echoing back either the quoted or bare value still gets a 304.
 */
export function ifNoneMatchSatisfied(
  header: string | null,
  etag: string,
): boolean {
  if (!header) return false;
  const want = core(etag);
  return header.split(",").some((t) => {
    const c = core(t);
    return c === "*" || c === want;
  });
}
