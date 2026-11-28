import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import common from "../../../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

const version = (n: number, body: string): SkillVersion => ({
  skill_id: "s1",
  version: n,
  name: "rubric",
  description: "d",
  type: "rubric",
  body,
  note: null,
  created_at: "2026-11-28T10:00:00Z",
});
// Current = v2, the middle one: restore moved the pointer down without adding a row.
const VERSIONS = [version(3, "three"), version(2, "two"), version(1, "one")];
const SKILL = { id: "s1", name: "rubric", body: "two", version: 2 } as Skill;

const restoreMutate = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false }),
  useRestoreSkillVersion: () => ({ mutate: restoreMutate, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";

afterEach(() => {
  cleanup();
  restoreMutate.mockClear();
});

function renderTab(skill: Skill = SKILL) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages, common }}>
      <ToastProvider>
        <VersionsTab skill={skill} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("VersionsTab", () => {
  it("the current row has Diff (vs the version below it) but no Restore", async () => {
    const user = userEvent.setup();
    renderTab();
    const row = within(screen.getByTestId("skill-version-2"));
    expect(row.getByText("Current")).toBeInTheDocument();
    // A version without a note falls back to its number.
    expect(row.getByText("Version 2")).toBeInTheDocument();
    expect(row.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();

    await user.click(row.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("v1 → v2")).toBeInTheDocument();
    expect(screen.getByText(/- one/)).toBeInTheDocument();
    expect(screen.getByText(/\+ two/)).toBeInTheDocument();
  });

  it("a non-current row diffs against its OWN predecessor, not the current version", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(within(screen.getByTestId("skill-version-3")).getByRole("button", { name: "Diff" }));
    expect(screen.getByText("v2 → v3")).toBeInTheDocument();
    expect(screen.getByText(/- two/)).toBeInTheDocument();
    expect(screen.getByText(/\+ three/)).toBeInTheDocument();
  });

  it("the oldest version diffs against an empty body — every line is added", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(within(screen.getByTestId("skill-version-1")).getByRole("button", { name: "Diff" }));
    expect(screen.getByText("v1 — initial version")).toBeInTheDocument();
    expect(screen.getByText(/\+ one/)).toBeInTheDocument();
    expect(screen.queryByText(/^- /)).not.toBeInTheDocument();
  });

  it("Restore switches to that version", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(within(screen.getByTestId("skill-version-3")).getByRole("button", { name: "Restore" }));
    expect(restoreMutate).toHaveBeenCalledWith({ id: "s1", version: 3 }, expect.anything());
  });
});
