import { expect, it } from "vitest";
import { fitSize } from "./receipt-store";

it("shrinks a tall receipt to 1400px on its long side and leaves small photos alone", () => {
  expect(fitSize(3024, 4032)).toEqual({ width: 1050, height: 1400 });
  expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
});
