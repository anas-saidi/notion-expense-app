import { expect, it } from "vitest";
import { lockModalBackground } from "./modal-background";
it("blocks the app surface and restores it after closing", () => {
  const app = { inert: false } as HTMLElement;
  const close = lockModalBackground(app);
  expect(app.inert).toBe(true);
  close();
  expect(app.inert).toBe(false);
});
it("keeps the background locked until every modal closes, including repeated cleanup", () => {
  const app = { inert: false } as HTMLElement;
  const first = lockModalBackground(app), second = lockModalBackground(app);
  first(); first();
  expect(app.inert).toBe(true);
  second();
  expect(app.inert).toBe(false);
});
it("preserves a background that was already inert", () => {
  const app = { inert: true } as HTMLElement;
  lockModalBackground(app)();
  expect(app.inert).toBe(true);
});
