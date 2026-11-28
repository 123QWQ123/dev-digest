import { describe, it, expect } from "vitest";
import { formatLatency } from "./helpers";

describe("formatLatency", () => {
  it.each([
    [null, "—"],
    [850.4, "850 ms"],
    [12_400, "12.4 s"],
  ])("%s → %s", (v, out) => expect(formatLatency(v)).toBe(out));
});
