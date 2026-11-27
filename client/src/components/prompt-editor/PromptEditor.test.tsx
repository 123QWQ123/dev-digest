import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/common.json";

let tokens: number;
vi.mock("@/lib/hooks/tokens", () => ({ useTokenCount: () => ({ data: { tokens } }) }));

import { PromptEditor } from "./PromptEditor";

// Reset the mocked count per test so no test depends on another one running first.
beforeEach(() => {
  tokens = 412;
});
afterEach(cleanup);

const renderEditor = (props: Partial<React.ComponentProps<typeof PromptEditor>> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ common: messages }}>
      <PromptEditor value={"# A\n\nB"} onChange={() => {}} fileName="pr-rubric.md" {...props} />
    </NextIntlClientProvider>,
  );

describe("PromptEditor", () => {
  it("shows the file name, line numbers, unsaved state and the token budget", () => {
    renderEditor({ dirty: true, tokenBudget: 8000 });
    expect(screen.getByText("pr-rubric.md")).toBeTruthy();
    expect(screen.getByText("unsaved")).toBeTruthy();
    expect(screen.getByTestId("prompt-tokens").textContent).toBe("412 / 8,000 tokens");
    expect(screen.getByText("3")).toBeTruthy(); // third line number
  });

  it("hides the unsaved badge for a clean buffer and shows a plain count without a budget", () => {
    tokens = 166;
    renderEditor();
    expect(screen.queryByText("unsaved")).toBeNull();
    expect(screen.getByTestId("prompt-tokens").textContent).toBe("166 tokens");
  });
});
