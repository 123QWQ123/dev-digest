import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

// Mock the data hooks so the editor renders without a network/query client.
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
}));

import { AgentEditor } from "./AgentEditor";

afterEach(cleanup);

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}

/** Renders with the intl + toast providers; `rerender` re-applies them via `wrapper`. */
function renderWithIntl(ui: React.ReactElement) {
  return render(ui, { wrapper: Providers });
}

describe("A2 Agent Editor (smoke)", () => {
  it("renders the Config tab fields", () => {
    renderWithIntl(<AgentEditor agent={AGENT} tab="config" onTab={() => {}} />);
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Save agent")).toBeInTheDocument();
  });

  it("switching to another agent shows that agent's values (form remounts, no stale edits)", async () => {
    const user = userEvent.setup();
    const view = renderWithIntl(<AgentEditor agent={AGENT} tab="config" onTab={() => {}} />);
    const nameInput = screen.getByDisplayValue("Security Reviewer");
    await user.clear(nameInput);
    await user.type(nameInput, "edited name");
    expect(nameInput).toHaveValue("edited name");

    const other: Agent = { ...AGENT, id: "ag2", name: "Perf Auditor" };
    view.rerender(<AgentEditor agent={other} tab="config" onTab={() => {}} />);
    // The form remounts, so the edited value is gone and the new agent's name shows.
    expect(screen.queryByDisplayValue("edited name")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Perf Auditor")).toBeInTheDocument();
  });
});
