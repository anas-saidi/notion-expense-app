import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { FinancialWriteCoordinator, assertFinancialWriteConnection, recordNotionWriteReceipt, type CoordinationClient, type CoordinationPool } from "./financial-write-coordinator";

function database() {
  const guards = new Map<string, string>();
  const locks = new Set<string>();
  const clients: Client[] = [];
  class Client extends EventEmitter implements CoordinationClient {
    keys = new Set<string>();
    failDelete = false;
    failReceipt = false;
    destroyed = false;
    released = false;
    async query(sql: string, params: any[] = []) {
      if (this.destroyed) throw new Error("Connection lost");
      const key = params[0];
      if (sql.includes("pg_try_advisory_lock")) {
        if (locks.has(key)) return { rows: [{ locked: false }] };
        locks.add(key); this.keys.add(key); return { rows: [{ locked: true }] };
      }
      if (sql.includes("pg_advisory_unlock")) { locks.delete(key); this.keys.delete(key); return { rows: [] }; }
      if (sql.startsWith("INSERT INTO finance_write_guards")) {
        if (guards.has(key)) return { rows: [] };
        guards.set(key, params[1]); return { rows: [{ owner: params[1] }] };
      }
      if (sql.startsWith("DELETE FROM finance_write_guards")) {
        if (this.failDelete) throw new Error("Cleanup failed");
        if (guards.get(key) === params[1]) guards.delete(key);
      }
      if (sql.startsWith("INSERT INTO finance_notion_write_receipts") && this.failReceipt) throw new Error("Receipt failed");
      return { rows: [] };
    }
    release(destroy = false) {
      this.destroyed ||= destroy; this.released = true;
      for (const key of this.keys) locks.delete(key);
    }
    disconnect() { this.destroyed = true; this.emit("error", new Error("Disconnected")); }
  }
  const pool: CoordinationPool = {
    query: async () => ({ rows: [] }),
    connect: async () => { const c = new Client(); clients.push(c); return c; },
  };
  return { guards, locks, clients, coordinator: () => new FinancialWriteCoordinator(pool) };
}

it("serializes independent coordinators and releases the session for a later writer", async () => {
  const db = database();
  let entered!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const first = db.coordinator().run("household", async () => { entered(); await gate; return "saved"; });
  await started;
  const other = vi.fn();
  await expect(db.coordinator().run("household", other)).rejects.toMatchObject({ status: 409 });
  expect(other).not.toHaveBeenCalled();
  finish(); expect(await first).toBe("saved");
  expect(await db.coordinator().run("household", async () => "next")).toBe("next");
  expect(db.guards.size).toBe(0);
  expect(db.clients.every(client => client.released)).toBe(true);
});

it("supports nested guards without another session and rejects a different household", async () => {
  const db = database(), coordinator = db.coordinator();
  await coordinator.run("home", async () => {
    expect(await db.coordinator().run("home", async () => 42)).toBe(42);
    await expect(coordinator.run("other", async () => 1)).rejects.toThrow("another household");
  });
  expect(db.clients).toHaveLength(1);
});

it("blocks abandoned writes without expiring their unknown outcomes", async () => {
  const db = database(), run = vi.fn();
  db.guards.set("home", "owner-from-crashed-worker");
  await expect(db.coordinator().run("home", run)).rejects.toThrow("interrupted");
  expect(run).not.toHaveBeenCalled();
  expect(db.guards.get("home")).toBe("owner-from-crashed-worker");
});

it("refuses further side effects after disconnect and preserves the durable guard", async () => {
  const db = database(), sideEffect = vi.fn();
  await expect(db.coordinator().run("home", async () => {
    db.clients[0].disconnect();
    await assertFinancialWriteConnection();
    sideEffect();
  })).rejects.toThrow("connection was lost");
  expect(sideEffect).not.toHaveBeenCalled();
  expect(db.guards.has("home")).toBe(true);
  await expect(db.coordinator().run("home", sideEffect)).rejects.toThrow("interrupted");
});

it("never reports success when final connection verification or guard cleanup fails", async () => {
  for (const failure of ["disconnect", "cleanup"]) {
    const db = database();
    await expect(db.coordinator().run("home", async () => {
      if (failure === "disconnect") db.clients[0].disconnect();
      else db.clients[0].failDelete = true;
      return { saved: true };
    })).rejects.toMatchObject({ status: 503, retryable: false });
    expect(db.guards.has("home")).toBe(true);
    expect(db.clients[0].destroyed).toBe(true);
  }
});

it("retains an interrupted guard if Notion saved but its SQL acknowledgement failed", async () => {
  const db = database();
  await expect(db.coordinator().run("home", async () => {
    db.clients[0].failReceipt = true;
    await recordNotionWriteReceipt("records", { id: "page", scope: "home", kind: "agreement", key: "2026-11", version: "v1" });
  })).rejects.toMatchObject({ status: 503 });
  expect(db.guards.has("home")).toBe(true);
});

it("releases a healthy session after a handled validation failure", async () => {
  const db = database();
  await expect(db.coordinator().run("home", async () => { throw new Error("Invalid amount"); })).rejects.toThrow("Invalid amount");
  expect(db.guards.size).toBe(0);
  expect(await db.coordinator().run("home", async () => "corrected")).toBe("corrected");
});
