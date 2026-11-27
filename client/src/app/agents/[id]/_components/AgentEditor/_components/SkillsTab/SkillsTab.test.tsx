import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkill, Skill } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";
import { buildRows, moveRow, toggleRow, effectiveCount, toLinks } from "./helpers";

const mutate = vi.fn();
const skill = (id: string, name: string, enabled = true): Skill => ({
  id,
  name,
  description: `${name} description`,
  type: "rubric",
  source: "manual",
  body: "b",
  enabled,
  version: 1,
});
const SKILLS = [skill("s1", "alpha"), skill("s2", "beta"), skill("s3", "gamma", false), skill("s4", "delta")];
const LINKS: AgentSkill[] = [
  { skill_id: "s2", name: "beta", description: "", type: "rubric", order: 0, enabled: true, skill_enabled: true },
  { skill_id: "s1", name: "alpha", description: "", type: "rubric", order: 1, enabled: false, skill_enabled: true },
  { skill_id: "s3", name: "gamma", description: "", type: "rubric", order: 2, enabled: true, skill_enabled: false },
];

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false }),
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate, isPending: false }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(cleanup);
beforeEach(() => mutate.mockReset());

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <SkillsTab agentId="ag1" />
    </NextIntlClientProvider>,
  );
}

const sentItems = () => mutate.mock.calls[0]![0].items as { skill_id: string; enabled: boolean }[];

describe("SkillsTab helpers", () => {
  it("lists linked skills in order, then the rest by name", () => {
    const rows = buildRows(LINKS, SKILLS);
    expect(rows.map((r) => r.name)).toEqual(["beta", "alpha", "gamma", "delta"]);
    // only beta reaches the prompt: alpha's link is off, gamma is disabled globally
    expect(effectiveCount(rows)).toBe(1);
  });

  it("ticking an unlinked skill appends it to the linked block; unticking keeps its slot", () => {
    const rows = buildRows(LINKS, SKILLS);
    expect(toLinks(toggleRow(rows, "s4")).map((l) => [l.name, l.enabled])).toEqual([
      ["beta", true],
      ["alpha", false],
      ["gamma", true],
      ["delta", true],
    ]);
    expect(toLinks(toggleRow(rows, "s2"))[0]).toMatchObject({ name: "beta", enabled: false, order: 0 });
  });

  it("moves within the linked block and clamps", () => {
    const rows = buildRows(LINKS, SKILLS);
    expect(toLinks(moveRow(rows, "s3", 0)).map((l) => l.name)).toEqual(["gamma", "beta", "alpha"]);
    expect(toLinks(moveRow(rows, "s2", 99)).map((l) => l.name)).toEqual(["alpha", "gamma", "beta"]);
  });
});

describe("SkillsTab", () => {
  it("shows the effective count and saves a reorder via ↑", async () => {
    const user = userEvent.setup();
    renderTab();
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByText("disabled globally")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move alpha up" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(sentItems()).toEqual([
      { skill_id: "s1", enabled: false },
      { skill_id: "s2", enabled: true },
      { skill_id: "s3", enabled: true },
    ]);
  });

  it("ticking an unlinked skill attaches it at the end", async () => {
    const user = userEvent.setup();
    renderTab();
    const deltaRow = screen.getByTestId("skill-row-delta");
    await user.click(deltaRow.querySelector('[role="checkbox"]')!);
    expect(sentItems().map((i) => i.skill_id)).toEqual(["s2", "s1", "s3", "s4"]);
  });

  it("hides reorder controls while filtering", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByLabelText("Filter skills…"), "alp");
    expect(screen.queryByTestId("skill-row-beta")).toBeNull();
    expect(screen.queryByRole("button", { name: "Move alpha up" })).toBeNull();
  });
});
