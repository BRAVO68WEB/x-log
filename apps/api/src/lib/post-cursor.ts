/**
 * Keyset pagination cursor for posts list.
 * Format (base64url): `<ISO-8601 sort timestamp>|<post id>`
 * Sort key is published_at (public feed) or updated_at (mine/drafts).
 */

export type PostListCursor = {
  sortAt: Date;
  id: string;
};

export function encodePostCursor(sortAt: Date, id: string): string {
  const payload = `${sortAt.toISOString()}|${id}`;
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodePostCursor(cursor: string | undefined | null): PostListCursor | null {
  if (!cursor) return null;
  try {
    // Support legacy plain snowflake id cursors (id-only, no sort key)
    if (!cursor.includes("|") && !/[^A-Za-z0-9_-]/.test(cursor) && cursor.length < 40) {
      // Ambiguous: may be base64url of short string or raw id.
      // Try base64url first.
      try {
        const decoded = Buffer.from(cursor, "base64url").toString("utf8");
        if (decoded.includes("|")) {
          const [iso, id] = decoded.split("|");
          if (iso && id) {
            const sortAt = new Date(iso);
            if (!Number.isNaN(sortAt.getTime())) return { sortAt, id };
          }
        }
      } catch {
        /* fall through */
      }
      // Legacy: treat as id-only — sortAt unknown, use far-future so only id filter applies poorly.
      // Better: reject and start from first page. Callers fall back to no cursor on null.
      // For compatibility, use epoch + id filter with order by id alone is wrong.
      // Return null so invalid/legacy cursors restart pagination cleanly.
      return null;
    }

    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep <= 0) return null;
    const iso = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!id) return null;
    const sortAt = new Date(iso);
    if (Number.isNaN(sortAt.getTime())) return null;
    return { sortAt, id };
  } catch {
    return null;
  }
}

