import { describe, expect, test } from "bun:test";
import { parseWaybackSnapshotUrl, utcDayBounds } from "./wayback";

describe("parseWaybackSnapshotUrl", () => {
  test("accepts full snapshot URLs", () => {
    const u =
      "https://web.archive.org/web/20240115123045/https://example.com/path";
    expect(parseWaybackSnapshotUrl(u)).toBe(u);
  });

  test("accepts relative content-location", () => {
    const out = parseWaybackSnapshotUrl("/web/20240115123045/https://example.com/");
    expect(out).toBe("https://web.archive.org/web/20240115123045/https://example.com/");
  });

  test("rejects calendar/search URLs without timestamp", () => {
    expect(parseWaybackSnapshotUrl("https://web.archive.org/web/*/https://example.com")).toBeNull();
    expect(parseWaybackSnapshotUrl("https://example.com")).toBeNull();
  });
});

describe("utcDayBounds", () => {
  test("returns UTC midnight range", () => {
    const d = new Date("2026-08-11T15:30:00.000Z");
    const { start, end } = utcDayBounds(d);
    expect(start.toISOString()).toBe("2026-08-11T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });
});
