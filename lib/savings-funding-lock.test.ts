import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), connect: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { connect = mocks.connect; } }));
import { withSavingsFundingLock } from "./savings-funding-lock";
beforeEach(() => {
  vi.resetAllMocks(); delete (globalThis as any).savingsFundingPool;
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
});
afterEach(() => { vi.unstubAllEnvs(); delete (globalThis as any).savingsFundingPool; });
it("releases the database lock after a failed operation", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://test");
  mocks.query.mockResolvedValue({ rows: [{ locked: true }] });
  await expect(withSavingsFundingLock("operation", async () => { throw new Error("Notion unavailable"); })).rejects.toThrow("Notion unavailable");
  expect(mocks.query.mock.calls[1][0]).toContain("pg_advisory_unlock");
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("does not run a duplicate operation owned by another server", async () => {
  vi.stubEnv("DATABASE_URL", "postgres://test");
  mocks.query.mockResolvedValue({ rows: [{ locked: false }] });
  const action = vi.fn();
  await expect(withSavingsFundingLock("operation", action)).rejects.toMatchObject({ status: 409, pending: true });
  expect(action).not.toHaveBeenCalled(); expect(mocks.release).toHaveBeenCalledOnce();
});
it("fails closed in production without the server database", async () => {
  vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("NODE_ENV", "production");
  const action = vi.fn();
  await expect(withSavingsFundingLock("operation", action)).rejects.toMatchObject({ status: 503 });
  expect(action).not.toHaveBeenCalled();
});
