import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

const SKILL = {
  id: "s1",
  name: "PR Quality Rubric",
  description: "General PR quality rubric covering clarity.",
  type: "rubric",
  source: "manual",
  body: "# rubric",
  enabled: true,
  version: 11,
  agent_count: 1,
  stats: { pull_rate: 0.07, accept_rate: null },
} as Skill;

afterEach(cleanup);

function renderCard() {
  const handlers = { onClick: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn() };
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillCard skill={SKILL} {...handlers} />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe("SkillCard", () => {
  it("shows name, type, source · version and usage; an unknown rate is a dash, not 0%", async () => {
    const user = userEvent.setup();
    const { onClick, onDelete } = renderCard();
    expect(screen.getByText("PR Quality Rubric")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual · v11")).toBeInTheDocument();
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.getByText("7% pull freq")).toBeInTheDocument();
    expect(screen.getByText("— accept")).toBeInTheDocument();

    // Delete acts on the card's skill without also opening it.
    await user.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByText("PR Quality Rubric"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("opens from the keyboard via the name button; the toggle stays a separate control", async () => {
    const user = userEvent.setup();
    const { onClick, onToggle } = renderCard();
    await user.tab();
    expect(screen.getByRole("button", { name: "PR Quality Rubric" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(screen.getByRole("switch", { name: "Enable skill" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
