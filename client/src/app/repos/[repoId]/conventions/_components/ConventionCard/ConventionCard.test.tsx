import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  rule: "All public route handlers return typed Result<T, ApiError>",
  evidence_path: "src/api/public/index.ts",
  evidence_snippet: "function handler(): Result<Item[], ApiError> {",
  confidence: 0.78,
  accepted: false,
  evidence_lines: { start: 14, end: 20 },
};

afterEach(cleanup);

function renderCard(c: ConventionCandidate = CANDIDATE) {
  const onSetAccepted = vi.fn();
  const onSaveRule = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard candidate={c} onSetAccepted={onSetAccepted} onSaveRule={onSaveRule} />
    </NextIntlClientProvider>,
  );
  return { onSetAccepted, onSaveRule };
}

describe("ConventionCard", () => {
  it("shows the rule, evidence ref + snippet and confidence", () => {
    renderCard();
    expect(screen.getByText(CANDIDATE.rule)).toBeInTheDocument();
    expect(screen.getByText("src/api/public/index.ts:14-20")).toBeInTheDocument();
    expect(screen.getByText(CANDIDATE.evidence_snippet)).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("accepts; reject is only available once accepted", async () => {
    const user = userEvent.setup();
    const { onSetAccepted } = renderCard();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onSetAccepted).toHaveBeenCalledWith(true);
  });

  it("rejects an accepted candidate", async () => {
    const user = userEvent.setup();
    const { onSetAccepted } = renderCard({ ...CANDIDATE, accepted: true });
    expect(screen.getByRole("button", { name: /Accepted/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onSetAccepted).toHaveBeenCalledWith(false);
  });

  it("edits the rule text", async () => {
    const user = userEvent.setup();
    const { onSaveRule } = renderCard();
    await user.click(screen.getByRole("button", { name: "Edit rule" }));
    const box = screen.getByDisplayValue(CANDIDATE.rule);
    await user.clear(box);
    await user.type(box, "  Route handlers return Result  ");
    await user.click(screen.getByRole("button", { name: /Save/ }));
    expect(onSaveRule).toHaveBeenCalledWith("Route handlers return Result");
    expect(screen.getByText(CANDIDATE.rule)).toBeInTheDocument();
  });

  it("does not save an empty rule", async () => {
    const user = userEvent.setup();
    const { onSaveRule } = renderCard();
    await user.click(screen.getByRole("button", { name: "Edit rule" }));
    await user.clear(screen.getByDisplayValue(CANDIDATE.rule));
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(onSaveRule).not.toHaveBeenCalled();
  });
});
