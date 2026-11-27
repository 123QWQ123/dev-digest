import { describe, it, expect } from "vitest";
import { queryKeys } from "./keys";

/* The cache contract: a query and the mutation that invalidates it must build
   the SAME key. These literals are what the API hooks have always used. */
describe("queryKeys", () => {
  it("builds the established keys", () => {
    expect(queryKeys.repos()).toEqual(["repos"]);
    expect(queryKeys.pulls("r1")).toEqual(["pulls", "r1"]);
    expect(queryKeys.pull(42)).toEqual(["pull", 42]);
    expect(queryKeys.agent("a1")).toEqual(["agent", "a1"]);
    expect(queryKeys.providerModels("openai")).toEqual(["provider-models", "openai"]);
    expect(queryKeys.providerModels(undefined)).toEqual(["provider-models", undefined]);
    expect(queryKeys.providerModelsAll()).toEqual(["provider-models"]);
    expect(queryKeys.prActiveRuns("p1")).toEqual(["pr-active-runs", "p1"]);
    expect(queryKeys.prRuns("p1")).toEqual(["pr-runs", "p1"]);
    expect(queryKeys.reviews("p1")).toEqual(["reviews", "p1"]);
    expect(queryKeys.runTrace("run1")).toEqual(["run-trace", "run1"]);
  });

  it("the all-providers prefix matches every provider's key", () => {
    const prefix = queryKeys.providerModelsAll();
    expect(queryKeys.providerModels("anthropic").slice(0, prefix.length)).toEqual([...prefix]);
  });
});
