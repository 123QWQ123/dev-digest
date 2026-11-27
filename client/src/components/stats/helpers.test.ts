import { describe, it, expect } from "vitest";
import { categoryColor, formatPercent, toPercent } from "./helpers";

describe("stats helpers", () => {
  it("rounds a rate to a whole percent; unknown stays unknown", () => {
    expect(toPercent(0.736)).toBe(74);
    expect(toPercent(0)).toBe(0);
    expect(toPercent(null)).toBeNull();
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("falls back to a muted colour for an unknown category", () => {
    expect(categoryColor("security")).toBe("var(--crit)");
    expect(categoryColor("docs")).toBe("var(--text-muted)");
  });
});
