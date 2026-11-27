import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("@/lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — reveal from the Timeline popover", () => {
  const TWO: FindingRecord[] = [
    FINDINGS[0]!,
    { ...FINDINGS[0]!, id: "f2", severity: "WARNING", title: "Retry-After omitted", rationale: "Second rationale body." },
  ];

  it("expands the targeted finding (only the first is expanded by default)", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={TWO} prId="pr1" />);
    expect(screen.queryByText("Second rationale body.")).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={TWO} prId="pr1" revealFindingId="f2" revealNonce={1} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Second rationale body.")).toBeInTheDocument();
  });
});

describe("FindingsPanel — severity filter pills", () => {
  const MIXED: FindingRecord[] = [
    { ...FINDINGS[0]!, id: "c1", severity: "CRITICAL", title: "Unauthenticated endpoints" },
    { ...FINDINGS[0]!, id: "w1", severity: "WARNING", title: "Date boundary inclusive" },
    { ...FINDINGS[0]!, id: "w2", severity: "WARNING", title: "No service tests" },
  ];

  it("pills are independent toggles: warning + critical shows both; none selected shows all", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    const crit = screen.getByRole("button", { name: "1 Critical" });
    const warn = screen.getByRole("button", { name: "2 Warning" });
    expect(screen.queryByRole("button", { name: /Suggestion/ })).not.toBeInTheDocument();

    fireEvent.click(warn);
    expect(warn).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Unauthenticated endpoints")).not.toBeInTheDocument();
    expect(screen.getByText("Date boundary inclusive")).toBeInTheDocument();
    expect(screen.getByText("No service tests")).toBeInTheDocument();

    // Adding Critical keeps Warning on — both severities are shown.
    fireEvent.click(crit);
    expect(crit).toHaveAttribute("aria-pressed", "true");
    expect(warn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Unauthenticated endpoints")).toBeInTheDocument();
    expect(screen.getByText("No service tests")).toBeInTheDocument();

    // Turning Warning off leaves only Critical.
    fireEvent.click(warn);
    expect(warn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Unauthenticated endpoints")).toBeInTheDocument();
    expect(screen.queryByText("No service tests")).not.toBeInTheDocument();

    // Turning the last one off → nothing selected → everything shown.
    fireEvent.click(crit);
    expect(screen.getByText("No service tests")).toBeInTheDocument();
    expect(screen.getByText("Unauthenticated endpoints")).toBeInTheDocument();
  });

  it("a reveal request for a finding outside the selected severities adds its severity", () => {
    const { rerender } = renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "1 Critical" }));
    rerender(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <FindingsPanel findings={MIXED} prId="pr1" revealFindingId="w2" revealNonce={1} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("No service tests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 Critical" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "2 Warning" })).toHaveAttribute("aria-pressed", "true");
  });
});
