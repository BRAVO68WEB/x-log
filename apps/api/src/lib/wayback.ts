/**
 * Internet Archive Wayback Machine helpers (Save Page Now + CDX).
 */

const UA = "x-log/1.0 (link-archiver; +https://github.com/BRAVO68WEB/x-log)";

export type WaybackResult = {
  archived_url: string | null;
  /** HTTP status from the last IA call, if any */
  status?: number;
  error?: string;
  /** True when we reused an existing capture (no new SPN) */
  reused?: boolean;
};

/** Extract a concrete snapshot URL: https://web.archive.org/web/YYYYMMDDhhmmss/... */
export function parseWaybackSnapshotUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const absolute = value.startsWith("http")
      ? value
      : `https://web.archive.org${value.startsWith("/") ? "" : "/"}${value}`;
    const u = new URL(absolute);
    if (!u.hostname.includes("web.archive.org") && !u.hostname.includes("archive.org")) {
      return null;
    }
    // /web/20240101120000/https://example.com
    const m = u.pathname.match(/\/web\/(\d{14})\/(.+)/);
    if (!m) return null;
    return `https://web.archive.org/web/${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

/** Calendar day bounds in UTC for "one snapshot per day" */
export function utcDayBounds(d = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/**
 * Ask Save Page Now to capture the URL.
 * Prefer Content-Location / Location / final redirect URL that contains /web/TIMESTMAP/.
 */
export async function archiveToWayback(url: string): Promise<WaybackResult> {
  const target = url.trim();
  if (!/^https?:\/\//i.test(target)) {
    return { archived_url: null, error: "URL must start with http:// or https://" };
  }

  const saveUrl = `https://web.archive.org/save/${target}`;

  try {
    // First: manual redirects so we can read Location / Content-Location
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(saveUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (res.status === 429) {
      // Rate limited — fall back to CDX "best available" for today if any
      const cdx = await findWaybackSnapshotForDay(target, new Date());
      if (cdx) {
        return { archived_url: cdx, status: 429, reused: true, error: "Wayback rate limited; reused existing capture" };
      }
      return { archived_url: null, status: 429, error: "Wayback Machine rate limited (try again later)" };
    }

    const headerSnap =
      parseWaybackSnapshotUrl(res.headers.get("content-location")) ||
      parseWaybackSnapshotUrl(res.headers.get("location"));

    if (headerSnap) {
      return { archived_url: headerSnap, status: res.status };
    }

    // Follow redirects if Location is relative save path
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const followed = await fetch(new URL(loc, "https://web.archive.org").href, {
          redirect: "follow",
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(25_000),
        });
        const fromFinal = parseWaybackSnapshotUrl(followed.url);
        if (fromFinal) {
          return { archived_url: fromFinal, status: followed.status };
        }
        const fromHeader =
          parseWaybackSnapshotUrl(followed.headers.get("content-location")) ||
          parseWaybackSnapshotUrl(followed.headers.get("location"));
        if (fromHeader) {
          return { archived_url: fromHeader, status: followed.status };
        }
      }
    }

    // Follow full chain from original save URL
    const followed = await fetch(saveUrl, {
      redirect: "follow",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(25_000),
    });
    const snap = parseWaybackSnapshotUrl(followed.url);
    if (snap) {
      return { archived_url: snap, status: followed.status };
    }

    // Last resort: CDX for a capture already on this calendar day (or closest recent)
    const cdxToday = await findWaybackSnapshotForDay(target, new Date());
    if (cdxToday) {
      return {
        archived_url: cdxToday,
        status: followed.status,
        reused: true,
        error: "Save Page Now did not return a snapshot URL; linked existing capture for today",
      };
    }

    return {
      archived_url: null,
      status: followed.status,
      error: `Wayback save did not produce a snapshot URL (HTTP ${followed.status})`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Wayback request failed";
    // Network failure — still try CDX for today's capture
    const cdxToday = await findWaybackSnapshotForDay(target, new Date()).catch(() => null);
    if (cdxToday) {
      return { archived_url: cdxToday, reused: true, error: msg };
    }
    return { archived_url: null, error: msg };
  }
}

/**
 * CDX API: find a 200 capture whose timestamp falls on the UTC calendar day of `day`.
 * Falls back to the most recent capture if none that day.
 */
export async function findWaybackSnapshotForDay(
  url: string,
  day: Date
): Promise<string | null> {
  try {
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const d = String(day.getUTCDate()).padStart(2, "0");
    const from = `${y}${m}${d}000000`;
    const to = `${y}${m}${d}235959`;

    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
      `&from=${from}&to=${to}&output=json&fl=timestamp,original&filter=statuscode:200&limit=1&fastLatest=true`;

    const res = await fetch(cdxUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as string[][];
    // First row is header ["timestamp","original"]
    if (!Array.isArray(rows) || rows.length < 2) {
      // No capture that day — try latest available overall
      return findLatestWaybackSnapshot(url);
    }
    const [, timestamp, original] = [null, rows[1][0], rows[1][1]] as const;
    if (!timestamp || !original) return null;
    return `https://web.archive.org/web/${timestamp}/${original}`;
  } catch {
    return null;
  }
}

export async function findLatestWaybackSnapshot(url: string): Promise<string | null> {
  try {
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}` +
      `&output=json&fl=timestamp,original&filter=statuscode:200&limit=1&fastLatest=true`;
    const res = await fetch(cdxUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as string[][];
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const timestamp = rows[1][0];
    const original = rows[1][1];
    if (!timestamp || !original) return null;
    return `https://web.archive.org/web/${timestamp}/${original}`;
  } catch {
    return null;
  }
}
