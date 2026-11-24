import { describe, it, expect } from "vitest";
import { formatCost, formatTokenCount } from "./helpers";

describe("formatCost", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [0, "$0.00"],
    [0.00128, "$0.0013"],
    [0.0141, "$0.014"],
    [0.06, "$0.060"],
    [1.239, "$1.24"],
  ])("%s → %s", (v, out) => {
    expect(formatCost(v)).toBe(out);
  });
});

describe("formatTokenCount", () => {
  it("groups thousands", () => {
    expect(formatTokenCount(9119)).toBe("9 119");
    expect(formatTokenCount(12011)).toBe("12 011");
    expect(formatTokenCount(950)).toBe("950");
  });
});
