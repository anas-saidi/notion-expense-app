import { describe, expect, it } from "vitest";
import { computeRebalanceOperations } from "./RebalanceSheet";

describe("computeRebalanceOperations", () => {
  it("releases a reduction that has no destination", () => {
    expect(computeRebalanceOperations(
      [{ id: "groceries", original: 500 }],
      { groceries: 300 },
    )).toEqual({ transfers: [], topUps: [], releases: [{ id: "groceries", amount: 200 }] });
  });

  it("supports releasing the full available budget", () => {
    expect(computeRebalanceOperations(
      [{ id: "travel", original: 400 }],
      { travel: 0 },
    ).releases).toEqual([{ id: "travel", amount: 400 }]);
  });

  it("moves what has a destination and releases the remainder", () => {
    expect(computeRebalanceOperations(
      [{ id: "source", original: 600 }, { id: "target", original: 100 }],
      { source: 200, target: 350 },
    )).toEqual({
      transfers: [{ fromId: "source", toId: "target", amount: 250 }],
      topUps: [],
      releases: [{ id: "source", amount: 150 }],
    });
  });
});
