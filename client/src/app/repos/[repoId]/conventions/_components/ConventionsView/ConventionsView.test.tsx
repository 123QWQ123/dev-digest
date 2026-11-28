import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate, ConventionList } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import common from "../../../../../../../messages/en/common.json";
import skills from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const state = vi.hoisted(() => ({ data: undefined as ConventionList | undefined }));
const extractMutate = vi.fn();
const updateMutate = vi.fn();
// The create-skill modal's PromptEditor counts tokens via the API — stub it.
vi.mock("@/lib/hooks/tokens", () => ({ useTokenCount: () => ({ data: { tokens: 42 } }) }));
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ data: state.data, isLoading: false, isError: false, refetch: vi.fn() }),
  useExtractConventions: () => ({ mutate: extractMutate, isPending: false }),
  useUpdateConvention: () => ({ mutate: updateMutate }),
  useCreateConventionSkill: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ConventionsView } from "./ConventionsView";

/** Fixed clock for `relativeTime` ("last scan …"). */
const NOW = new Date("2026-11-28T12:00:00Z");

const cand = (id: string, accepted: boolean): ConventionCandidate => ({
  id,
  rule: `Rule ${id}`,
  evidence_path: "src/a.ts",
  evidence_snippet: "const a = 1;",
  confidence: 0.9,
  accepted,
  evidence_lines: { start: 1, end: 1 },
});

afterEach(() => {
  cleanup();
  extractMutate.mockReset();
  updateMutate.mockReset();
});

function renderView(cloned = true) {
  render(
    <NextIntlClientProvider locale="en" now={NOW} timeZone="UTC" messages={{ conventions, common, skills }}>
      <ToastProvider>
        <ConventionsView repoId="r1" repoFullName="acme/payments-api" cloned={cloned} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ConventionsView", () => {
  it("empty state runs the extraction", async () => {
    state.data = { items: [], last_scan_at: null };
    const user = userEvent.setup();
    renderView();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Run extraction/ }));
    expect(extractMutate).toHaveBeenCalledTimes(1);
  });

  it("shows the accepted count, accepts all pending, and gates Create skill", async () => {
    state.data = { items: [cand("a", true), cand("b", false), cand("c", false)], last_scan_at: "2026-11-28T11:51:00Z" };
    const user = userEvent.setup();
    renderView();
    expect(screen.getByText("1 of 3 accepted")).toBeInTheDocument();
    expect(screen.getByText(/last scan 9 minutes ago/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create skill/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Accept all/ }));
    expect(updateMutate.mock.calls.map((c) => c[0])).toEqual([
      { id: "b", patch: { accepted: true } },
      { id: "c", patch: { accepted: true } },
    ]);
  });

  it("explains an uncloned repo instead of offering extraction", () => {
    state.data = { items: [], last_scan_at: null };
    renderView(false);
    expect(screen.getByText("This repo isn't cloned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run extraction/ })).toBeNull();
  });

  it("disables Create skill while nothing is accepted", () => {
    state.data = { items: [cand("a", false)], last_scan_at: null };
    renderView();
    expect(screen.getByRole("button", { name: /Create skill/ })).toBeDisabled();
  });

  it("Create skill opens the modal drafted from the accepted conventions only", async () => {
    state.data = { items: [cand("a", true), cand("b", false)], last_scan_at: null };
    const user = userEvent.setup();
    renderView();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Create skill/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Create skill from conventions");
    expect(dialog).toHaveTextContent("Merged from 1 accepted convention in payments-api");
    const body = screen.getByRole("textbox", { name: "Skill body (Markdown)" });
    expect(body).toHaveDisplayValue(/Rule a/);
    expect(body).not.toHaveDisplayValue(/Rule b/);
  });
});
