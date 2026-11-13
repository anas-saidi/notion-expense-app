import { expect, it } from "vitest";
import { screenIsLoading } from "./screen-loading";
const idle = { core: false, home: false, month: false, budget: false, bills: false, history: false };
it("does not show Activity recovery for unrelated Home reads", () => {
  expect(screenIsLoading({ ...idle, tab: "history", home: true, month: true, bills: true, budget: true })).toBe(false);
  expect(screenIsLoading({ ...idle, tab: "history", history: true })).toBe(true);
});
it("keeps essential failures visible and scopes Budget recovery to its data", () => {
  expect(screenIsLoading({ ...idle, tab: "history", core: true })).toBe(true);
  expect(screenIsLoading({ ...idle, tab: "budget", home: true, bills: true })).toBe(false);
  expect(screenIsLoading({ ...idle, tab: "budget", month: true })).toBe(true);
  expect(screenIsLoading({ ...idle, tab: "home", home: true })).toBe(true);
});
it("stays quiet while a refresh after a save reloads data already on screen", () => {
  expect(screenIsLoading({ ...idle, tab: "home", month: true, bills: true, refreshing: true })).toBe(false);
  expect(screenIsLoading({ ...idle, tab: "budget", month: true, budget: true, refreshing: true })).toBe(false);
  expect(screenIsLoading({ ...idle, tab: "home", core: true, refreshing: true })).toBe(true);
});
