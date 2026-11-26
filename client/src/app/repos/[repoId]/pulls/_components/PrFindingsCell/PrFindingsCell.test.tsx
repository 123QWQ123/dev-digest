/** PrFindingsCell — PR list FINDINGS column: counts from PrMeta, findings
 *  fetched lazily on hover, click → deep link to the finding. */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const usePrReviews = vi.fn();
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: (id: string | null) => usePrReviews(id) }));

import { PrFindingsCell } from "./PrFindingsCell";

const finding = (o: Partial<FindingRecord>): FindingRecord =>
  ({
    id: "f",
    review_id: "rv-general",
    severity: "CRITICAL",
    category: "security",
    title: "t",
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "why",
    confidence: 0.9,
    accepted_at: null,
    dismissed_at: null,
    ...o,
  }) as FindingRecord;

const REVIEWS = [
  // Latest round = newest run of each agent: general (run-9) + security (run-8).
  {
    id: "rv-general",
    run_id: "run-9",
    findings: [
      finding({ id: "c1", severity: "CRITICAL", title: "Unauthenticated endpoints" }),
      finding({ id: "w1", severity: "WARNING", title: "Inclusive date range" }),
    ],
  },
  {
    id: "rv-security",
    run_id: "run-8",
    findings: [finding({ id: "w2", severity: "WARNING", title: "No tests" })],
  },
  // An older rerun of the general agent — must never leak into the popovers.
  { id: "rv-old", run_id: "run-1", findings: [finding({ id: "old", severity: "WARNING", title: "Stale finding" })] },
] as unknown as ReviewRecord[];

const PR = {
  id: "p1",
  number: 12,
  title: "x",
  author: "a",
  branch: "b",
  base: "main",
  head_sha: "h",
  additions: 1,
  deletions: 1,
  files_count: 1,
  status: "reviewed",
  score: 17,
  latest_round: { review_ids: ["rv-general", "rv-security"], critical: 1, warning: 2, suggestion: 0 },
} as PrMeta;

const renderCell = (pr: PrMeta) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
      <PrFindingsCell pr={pr} repoId="r1" />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  push.mockReset();
  usePrReviews.mockReset();
  usePrReviews.mockImplementation((id: string | null) => ({
    data: id ? REVIEWS : undefined,
    isLoading: false,
  }));
});
afterEach(cleanup);

describe("PrFindingsCell", () => {
  it("shows counters from the list payload without fetching findings", () => {
    renderCell(PR);
    expect(screen.getByRole("button", { name: "1 critical finding" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2 warnings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /suggestion/ })).not.toBeInTheDocument();
    expect(usePrReviews).toHaveBeenLastCalledWith(null);
  });

  it("hovering a counter lists that severity across ALL agents' newest runs, not older reruns", () => {
    renderCell(PR);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2 warnings" }));
    expect(usePrReviews).toHaveBeenLastCalledWith("p1");
    const dialog = screen.getByRole("dialog", { name: "2 warnings" });
    expect(dialog).toHaveTextContent("Inclusive date range");
    expect(dialog).toHaveTextContent("No tests");
    expect(dialog).not.toHaveTextContent("Unauthenticated endpoints");
    expect(dialog).not.toHaveTextContent("Stale finding");
  });

  it("clicking a finding deep-links into the run that produced it", () => {
    renderCell(PR);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2 warnings" }));
    fireEvent.click(screen.getByText("No tests"));
    expect(push).toHaveBeenCalledWith("/repos/r1/pulls/12?tab=findings&run=run-8&finding=w2");
  });

  it("clicking a counter opens the Agent runs tab", () => {
    renderCell(PR);
    fireEvent.click(screen.getByRole("button", { name: "1 critical finding" }));
    expect(push).toHaveBeenCalledWith("/repos/r1/pulls/12?tab=findings");
  });

  it("renders — when never reviewed and 0 when the latest round is clean", () => {
    renderCell({ ...PR, latest_round: null });
    expect(screen.getByText("—")).toBeInTheDocument();
    cleanup();
    renderCell({ ...PR, latest_round: { review_ids: ["rv"], critical: 0, warning: 0, suggestion: 0 } });
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
