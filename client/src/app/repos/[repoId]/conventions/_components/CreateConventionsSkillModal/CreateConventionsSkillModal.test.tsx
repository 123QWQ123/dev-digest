import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate, Skill } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../messages/en/skills.json";
import common from "../../../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

const createMutate = vi.fn();
vi.mock("@/lib/hooks/tokens", () => ({ useTokenCount: () => ({ data: { tokens: 187 } }) }));
vi.mock("@/lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutate: createMutate, isPending: false }),
}));

import { CreateConventionsSkillModal } from "./CreateConventionsSkillModal";

const ACCEPTED: ConventionCandidate[] = [
  {
    id: "c1",
    rule: "Always use async/await instead of .then() chains",
    evidence_path: "src/api/users.ts",
    evidence_snippet: "const user = await db.users.find(id);",
    confidence: 0.91,
    accepted: true,
    evidence_lines: { start: 23, end: 31 },
  },
];

afterEach(() => {
  cleanup();
  createMutate.mockReset();
});

function renderModal(onCreated = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills, common }}>
      <ToastProvider>
        <CreateConventionsSkillModal
          repoId="r1"
          repoFullName="acme/payments-api"
          accepted={ACCEPTED}
          onClose={() => {}}
          onCreated={onCreated}
        />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onCreated };
}

describe("CreateConventionsSkillModal", () => {
  it("prefills the drafted skill from the accepted conventions", () => {
    renderModal();
    expect(screen.getByText(/Merged from 1 accepted convention in payments-api/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("payments-api-conventions")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 house convention extracted from payments-api")).toBeInTheDocument();
    const body = screen.getByLabelText("Skill body (Markdown)") as HTMLTextAreaElement;
    expect(body.value).toContain("Detected in `src/api/users.ts:23-31`");
  });

  it("submits the edited name/description/body and reports success", async () => {
    const user = userEvent.setup();
    const skill = { id: "s1", name: "house-rules" } as Skill;
    createMutate.mockImplementation((_input, opts) => opts?.onSuccess?.(skill));
    const { onCreated } = renderModal();
    const name = screen.getByDisplayValue("payments-api-conventions");
    await user.clear(name);
    await user.type(name, "house-rules");
    await user.click(screen.getByRole("button", { name: /Create skill/ }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "house-rules", description: "1 house convention extracted from payments-api", enabled: true }),
      expect.anything(),
    );
    expect(createMutate.mock.calls[0]![0]).not.toHaveProperty("type");
    expect(onCreated).toHaveBeenCalledWith(skill);
  });
});
