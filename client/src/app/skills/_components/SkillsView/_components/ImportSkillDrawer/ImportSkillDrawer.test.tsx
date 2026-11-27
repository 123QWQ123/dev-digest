import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import common from "../../../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

const PREVIEW: SkillImportPreview = {
  name: "flaky-test-patterns",
  description: "Use when tests touch time.",
  type: "custom",
  body: "# Flaky\n\n- fake timers",
  source_file: "flaky-test-patterns/SKILL.md",
  ignored_files: ["flaky-test-patterns/scripts/check.sh"],
  warnings: ["Ignored 1 executable file(s) — skills are text only; nothing from the archive is run."],
};

const previewMutate = vi.fn((_vars: unknown, opts?: { onSuccess?: (d: SkillImportPreview) => void }) =>
  opts?.onSuccess?.(PREVIEW),
);
const createMutate = vi.fn();

// PromptEditor counts tokens via the API — stub it (no QueryClient in these tests).
vi.mock("@/lib/hooks/tokens", () => ({ useTokenCount: () => ({ data: { tokens: 42 } }) }));
vi.mock("@/lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({ mutate: previewMutate, isPending: false }),
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  previewMutate.mockClear();
  createMutate.mockClear();
});

function renderDrawer() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages, common }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={() => {}} onSaved={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ImportSkillDrawer", () => {
  it("previews the file, lists ignored files, and saves only after the trust confirmation", async () => {
    const user = userEvent.setup();
    renderDrawer();
    const file = new File(["zip-bytes"], "flaky.zip", { type: "application/zip" });
    await user.upload(screen.getByLabelText("Choose a .md or .zip file"), file);

    await waitFor(() => expect(previewMutate).toHaveBeenCalledTimes(1));
    expect(previewMutate.mock.calls[0]![0]).toMatchObject({ filename: "flaky.zip" });
    expect(screen.getByText("flaky-test-patterns/scripts/check.sh")).toBeInTheDocument();
    expect(screen.getByDisplayValue("flaky-test-patterns")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save skill" });
    expect(save).toBeDisabled();
    expect(createMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox"));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]![0]).toMatchObject({
      name: "flaky-test-patterns",
      source: "imported",
      body: "# Flaky\n\n- fake timers",
    });
  });

  it("rejects files over 1 MB before calling the server", async () => {
    const user = userEvent.setup();
    renderDrawer();
    const big = new File([new Uint8Array(1_048_577)], "big.zip");
    await user.upload(screen.getByLabelText("Choose a .md or .zip file"), big);
    expect(screen.getByText("The file is larger than 1 MB.")).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();
  });
});
