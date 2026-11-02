import { SUPABASE_ROOT_CA } from "./supabase-ca";

/** Verify Supabase's private root and hostname; never disable verification. */
export function databaseConnectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith(".pooler.supabase.com") && !url.hostname.endsWith(".supabase.co")) return { connectionString };
  if (url.searchParams.has("sslcert") || url.searchParams.has("sslkey")) throw new Error("Custom client TLS credentials need explicit database configuration.");
  for (const key of ["sslmode", "sslrootcert"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } };
}
