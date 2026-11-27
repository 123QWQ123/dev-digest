import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillStats } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";

let stats: SkillStats;
vi.mock("@/lib/hooks/skills", () => ({
  useSkillStats: () => ({ data: stats, isLoading: false, isError: false, refetch: vi.fn() }),
}));
// Recharts needs layout APIs jsdom lacks — the legend is what we assert on.
vi.mock("@devdigest/ui", async (orig) => ({
  ...(await orig<typeof import("@devdigest/ui")>()),
  Donut: ({ segments, formatValue }: { segments: { label: string; value: number }[]; formatValue: (v: number) => string }) => (
    <ul>
      {segments.map((s) => (
        <li key={s.label}>{`${s.label} ${formatValue(s.value)}`}</li>
      ))}
    </ul>
  ),
}));

import { StatsTab } from "./StatsTab";

afterEach(cleanup);

const renderTab = () =>
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <StatsTab skillId="s1" />
    </NextIntlClientProvider>,
  );

describe("Skill StatsTab", () => {
  it("shows usage tiles, agents with Open links and findings by category as counts", () => {
    stats = {
      skill_id: "s1",
      window_days: 30,
      used_by: [
        { id: "a1", name: "Test Quality Reviewer", enabled: true },
        { id: "a2", name: "Security Reviewer", enabled: false },
      ],
      agent_runs: 7,
      runs_with_skill: 5,
      pull_rate: 5 / 7,
      accept_rate: 0.74,
      findings: 12,
      findings_by_category: [
        { category: "test", count: 9 },
        { category: "bug", count: 3 },
      ],
    };
    renderTab();
    expect(screen.getByText("71")).toBeTruthy(); // pull frequency %
    expect(screen.getAllByText("74").length).toBeGreaterThan(0); // accept rate (+ ring)
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Findings (30d)")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open" })[0]!.getAttribute("href")).toBe("/agents/a1?tab=skills");
    expect(screen.getByText("unticked")).toBeTruthy();
    expect(screen.getByText("test 9")).toBeTruthy();
  });

  it("shows dashes and empty states when there are no runs yet", () => {
    stats = {
      skill_id: "s1",
      window_days: 30,
      used_by: [],
      agent_runs: 0,
      runs_with_skill: 0,
      pull_rate: null,
      accept_rate: null,
      findings: 0,
      findings_by_category: [],
    };
    renderTab();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("No agent links this skill yet.")).toBeTruthy();
    expect(screen.getByText("No findings from runs that used this skill yet.")).toBeTruthy();
  });
});
