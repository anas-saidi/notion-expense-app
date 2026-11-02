import { expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import { databaseConnectionOptions } from "./database-tls";
import { SUPABASE_ROOT_CA } from "./supabase-ca";

it("verifies Supabase's root and hostname even if a connection string requests weaker TLS", () => {
  const options = databaseConnectionOptions("postgresql://role:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify");
  expect(options.ssl).toEqual({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
  expect(new URL(options.connectionString).searchParams.has("sslmode")).toBe(false);
  expect(new X509Certificate(options.ssl!.ca).subject).toContain("Supabase Root 2021 CA");
});
it("preserves existing connection settings for other PostgreSQL providers", () => {
  const connectionString = "postgresql://role:password@legacy.neon.tech/db?sslmode=verify-full";
  expect(databaseConnectionOptions(connectionString)).toEqual({ connectionString });
});
it("does not silently replace custom client certificate authentication", () => {
  expect(() => databaseConnectionOptions("postgresql://role:password@db.example.supabase.co/db?sslkey=key.pem")).toThrow("Custom client TLS");
});
