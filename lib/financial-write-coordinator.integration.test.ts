import { afterAll, beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";
import { databaseConnectionOptions } from "./database-tls";
import { FinancialWriteCoordinator } from "./financial-write-coordinator";

// Explicit opt-in. Uses only generated qa:* scopes in the migration target.
// Build .codex/financial-write-coordinator.cjs with esbuild before running.
const live = process.env.RUN_SUPABASE_INTEGRATION === "true";
let pool: Pool;
const scopes: string[] = [], workers: ChildProcess[] = [];
beforeAll(() => {
  if (!live) return;
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  const connection = env.FINANCE_COORDINATION_DATABASE_URL;
  if (!connection) throw new Error("Missing explicit Supabase integration connection.");
  const url = new URL(connection);
  if (!url.hostname.endsWith(".pooler.supabase.com")) throw new Error("Integration target must be the Supabase migration project.");
  process.env.FINANCE_COORDINATION_DATABASE_URL = connection;
  pool = new Pool({ ...databaseConnectionOptions(connection), max: 2, connectionTimeoutMillis: 5000 });
});
afterAll(async () => {
  for (const worker of workers) if (worker.exitCode === null && worker.signalCode === null) worker.kill();
  if (pool) {
    for (const scope of scopes) await pool.query("DELETE FROM finance_write_guards WHERE scope=$1", [scope]);
    await pool.end();
  }
});
function scope() { const value = `qa:${randomUUID()}`; scopes.push(value); return value; }
function message(worker: ChildProcess, expected: string) {
  return new Promise<any>((done, reject) => {
    const timer = setTimeout(() => { worker.off("message", receive); reject(new Error(`Worker did not report ${expected}`)); }, 15000);
    function receive(value: any) {
      if (value.type === "error") { clearTimeout(timer); worker.off("message", receive); reject(new Error(value.message)); }
      else if (value.type === expected) { clearTimeout(timer); worker.off("message", receive); done(value); }
    }
    worker.on("message", receive);
  });
}
function worker(scope: string) {
  const child = spawn(process.execPath, ["-e", `
    const { FinancialWriteCoordinator, coordinationPool } = require(process.env.COORDINATOR_MODULE);
    let release;
    process.on('message', message => {
      if (message === 'release') release();
      if (message === 'start') {
        const pool = coordinationPool();
        new FinancialWriteCoordinator(pool).run(process.env.QA_SCOPE, async () => {
          process.send({type:'entered'});
          await new Promise(resolve => { release=resolve; });
        }).then(()=>process.send({type:'complete'})).catch(e=>process.send({type:'error',message:e.message})).finally(()=>pool.end());
      }
    });
  `], { env: { ...process.env, QA_SCOPE: scope, COORDINATOR_MODULE: resolve(".codex/financial-write-coordinator.cjs") }, stdio: ["ignore", "ignore", "pipe", "ipc"] });
  workers.push(child); return child;
}
it.runIf(live)("holds the same household lock across separate Node processes", async () => {
  const key = scope(), child = worker(key);
  const entered = message(child, "entered"); child.send("start"); await entered;
  let ran = false;
  await expect(new FinancialWriteCoordinator(pool).run(key, async () => { ran = true; })).rejects.toMatchObject({ status: 409 });
  expect(ran).toBe(false);
  const complete = message(child, "complete"); child.send("release"); await complete;
  expect(await new FinancialWriteCoordinator(pool).run(key, async () => "next writer")).toBe("next writer");
  child.disconnect();
}, 30000);

it.runIf(live)("keeps a durable barrier after a worker is killed during a save", async () => {
  const key = scope(), child = worker(key);
  const entered = message(child, "entered"); child.send("start"); await entered;
  const exited = new Promise<void>(done => child.once("exit", () => done())); child.kill("SIGKILL"); await exited;
  expect((await pool.query("SELECT owner FROM finance_write_guards WHERE scope=$1", [key])).rows).toHaveLength(1);
  let ran = false;
  await expect(new FinancialWriteCoordinator(pool).run(key, async () => { ran = true; })).rejects.toThrow();
  expect(ran).toBe(false);
}, 30000);

it.runIf(live)("prevents browser roles from reading finance tables", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE anon");
    await expect(client.query("SELECT scope FROM finance_write_guards")).rejects.toMatchObject({ code: "42501" });
  } finally { await client.query("ROLLBACK"); client.release(); }
});
