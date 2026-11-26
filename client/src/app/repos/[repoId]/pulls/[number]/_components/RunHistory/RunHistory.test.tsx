/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../../messages/en/common.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost (M1)", () => {
  it("done runs show tokens · cost (— when unknown); failed runs show none", () => {
    renderRuns([
      run({ run_id: "r1", status: "done", tokens_in: 9000, tokens_out: 119, cost_usd: 0.00128 }),
      run({ run_id: "r2", status: "done", cost_usd: null }),
      run({ run_id: "r3", status: "failed", error: "429 quota", cost_usd: null }),
    ]);
    // getByText's default normalizer folds the narrow no-break space into " ".
    expect(screen.getByText("9 119 tok · $0.0013")).toBeInTheDocument();
    expect(screen.getByText("150 tok · —")).toBeInTheDocument(); // never "$0.00"
    expect(screen.getAllByText(/ tok · /)).toHaveLength(2); // the failed run has no badge
  });
});

function finding(o: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f",
    review_id: "rv1",
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
  } as FindingRecord;
}

describe("RunHistory — severity hover popovers", () => {
  const findingsByRun = {
    "run-1": [
      finding({ id: "c1", severity: "CRITICAL", title: "Hardcoded Stripe key" }),
      finding({ id: "c2", severity: "CRITICAL", title: "Lethal trifecta" }),
      finding({ id: "w1", severity: "WARNING", title: "Retry-After omitted" }),
      finding({ id: "s1", severity: "SUGGESTION", title: "Rename var" }),
    ],
  };
  const renderWithFindings = () =>
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <RunHistory
          runs={[run({ status: "done", findings_count: 4, blockers: 2, score: 38 })]}
          findingsByRun={findingsByRun}
          onOpenTrace={() => {}}
        />
      </NextIntlClientProvider>,
    );

  it("hovering the critical counter lists ONLY critical findings", () => {
    renderWithFindings();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2 critical findings" }));
    const dialog = screen.getByRole("dialog", { name: "2 critical findings" });
    expect(dialog).toHaveTextContent("Hardcoded Stripe key");
    expect(dialog).toHaveTextContent("Lethal trifecta");
    expect(dialog).not.toHaveTextContent("Retry-After omitted");
    expect(dialog).not.toHaveTextContent("Rename var");
  });

  it("hovering the warning counter lists ONLY warnings", () => {
    renderWithFindings();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "1 warning" }));
    const dialog = screen.getByRole("dialog", { name: "1 warning" });
    expect(dialog).toHaveTextContent("Retry-After omitted");
    expect(dialog).not.toHaveTextContent("Hardcoded Stripe key");
  });

  it("hovering the suggestion counter lists ONLY suggestions", () => {
    renderWithFindings();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "1 suggestion" }));
    const dialog = screen.getByRole("dialog", { name: "1 suggestion" });
    expect(dialog).toHaveTextContent("Rename var");
    expect(dialog).not.toHaveTextContent("Hardcoded Stripe key");
    expect(dialog).not.toHaveTextContent("Retry-After omitted");
  });

  it("no popover until hovered; no counter for a severity with zero findings", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <RunHistory
          runs={[run({ status: "done", findings_count: 1, blockers: 0 })]}
          findingsByRun={{ "run-1": [finding({ severity: "WARNING" })] }}
          onOpenTrace={() => {}}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /critical/ })).not.toBeInTheDocument();
  });

  it("clicking a finding in the popover navigates to that exact finding", () => {
    const onGoToReview = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <RunHistory
          runs={[run({ status: "done", findings_count: 4, blockers: 2 })]}
          findingsByRun={findingsByRun}
          onOpenTrace={() => {}}
          onGoToReview={onGoToReview}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "2 critical findings" }));
    fireEvent.click(screen.getByText("Lethal trifecta"));
    expect(onGoToReview).toHaveBeenCalledWith("run-1", "c2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
