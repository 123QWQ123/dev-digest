import { describe, it, expect } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import { filterAndSortPulls, parsePullSort } from "./helpers";

const pr = (number: number, title: string, status: PrMeta["status"], updated_at: string | null): PrMeta => ({
  number,
  title,
  status,
  updated_at,
  author: "a",
  branch: "b",
  base: "main",
  head_sha: "x",
  additions: 0,
  deletions: 0,
  files_count: 0,
});

const PULLS = [
  pr(1, "Add rate limiting", "needs_review", "2026-01-01T00:00:00Z"),
  pr(2, "Fix login", "reviewed", "2026-01-03T00:00:00Z"),
  pr(3, "Rate limit docs", "needs_review", "2026-01-02T00:00:00Z"),
  pr(4, "No date", "merged", null),
];

describe("filterAndSortPulls", () => {
  it("filters by status ('all' keeps everything) and sorts newest first by default", () => {
    expect(filterAndSortPulls(PULLS, { status: "needs_review", query: "", sort: "newest" }).map((p) => p.number)).toEqual([3, 1]);
    expect(filterAndSortPulls(PULLS, { status: "all", query: "", sort: "newest" }).map((p) => p.number)).toEqual([2, 3, 1, 4]);
  });

  it("sorts oldest first (missing dates count as oldest)", () => {
    expect(filterAndSortPulls(PULLS, { status: "all", query: "", sort: "oldest" }).map((p) => p.number)).toEqual([4, 1, 3, 2]);
  });

  it("matches the query against title (case-insensitive, trimmed) or number", () => {
    expect(filterAndSortPulls(PULLS, { status: "all", query: "  RATE ", sort: "newest" }).map((p) => p.number)).toEqual([3, 1]);
    expect(filterAndSortPulls(PULLS, { status: "all", query: "2", sort: "newest" }).map((p) => p.number)).toEqual([2]);
  });

  it("does not mutate the input", () => {
    const copy = [...PULLS];
    filterAndSortPulls(PULLS, { status: "all", query: "", sort: "oldest" });
    expect(PULLS).toEqual(copy);
  });
});

describe("parsePullSort", () => {
  it("accepts oldest, defaults everything else to newest", () => {
    expect(parsePullSort("oldest")).toBe("oldest");
    expect(parsePullSort("newest")).toBe("newest");
    expect(parsePullSort(null)).toBe("newest");
    expect(parsePullSort("bogus")).toBe("newest");
  });
});
