import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Ratchet for the UI consistency eval: no rule may gain violations over
// design-eval.baseline.json. After fixing some, run `npm run design:eval -- --update-baseline`.
describe("design eval", () => {
  it("adds no new design-system violations", () => {
    const run = () => execFileSync("node", ["scripts/design-eval.mjs", "--check", "--json"], { encoding: "utf8" });
    expect(run).not.toThrow();
    const report = JSON.parse(run());
    expect(report.overall).toBeGreaterThanOrEqual(0);
  });
});
