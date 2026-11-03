// Run after the scheduled-refresh migration. Secrets come only from the server
// environment and are stored encrypted in Vault, never in cron.job or source.
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { createHmac } from 'node:crypto';

const apply = process.argv.includes('--apply');
const endpoint = 'https://notion-expense-app.vercel.app/api/sync/refresh';
const value = process.env.FINANCE_COORDINATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!value) throw new Error('A Supabase database connection is required.');
const url = new URL(value);
if (!url.hostname.endsWith('.pooler.supabase.com') && !url.hostname.endsWith('.supabase.co')) throw new Error('Configure this job only on the existing Supabase project.');
if (!url.username.includes('qhczsyohvjirtafxvtdf') && !url.hostname.startsWith('db.qhczsyohvjirtafxvtdf.')) throw new Error('Unexpected Supabase project. Nothing changed.');
if (url.searchParams.has('sslcert') || url.searchParams.has('sslkey')) throw new Error('Custom TLS credentials are not supported.');
url.searchParams.delete('sslmode'); url.searchParams.delete('sslrootcert');
const ca = await readFile(new URL('../certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');
const pool = new Pool({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true }, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
const client = await pool.connect();
try {
  const { rows } = await client.query("SELECT to_regprocedure('public.enqueue_finance_mirror_refresh()') IS NOT NULL AS installed");
  if (!rows[0].installed) throw new Error('Apply the scheduled-refresh migration first.');
  const existing = await client.query("SELECT name FROM vault.secrets WHERE name IN ('finance_mirror_refresh_url','finance_mirror_refresh_token')");
  console.log(JSON.stringify({ apply, endpoint, existingSecretNames: existing.rows.map(row => row.name) }));
  if (apply) {
    const token = process.env.FINANCE_MIRROR_REFRESH_SECRET;
    if (!token) throw new Error('FINANCE_MIRROR_REFRESH_SECRET must match the canonical server configuration.');
    // Check the existing server credential before saving it into Vault.
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', token).update(`finance-mirror-refresh:GET:/api/sync/refresh:${timestamp}`).digest('hex');
    const response = await fetch(endpoint, { headers: { 'X-Finance-Refresh-Time': timestamp, 'X-Finance-Refresh-Signature': signature }, signal: AbortSignal.timeout(240000) });
    if (!response.ok) throw new Error(`Canonical refresh verification failed (${response.status}). Vault was not changed.`);
    await client.query('BEGIN');
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('finance-mirror-refresh-config',0))");
      for (const [name, secret] of [['finance_mirror_refresh_url', endpoint], ['finance_mirror_refresh_token', token]]) {
        const found = await client.query('SELECT id FROM vault.secrets WHERE name=$1', [name]);
        if (found.rows.length) await client.query('SELECT vault.update_secret($1::uuid,$2::text)', [found.rows[0].id, secret]);
        else await client.query('SELECT vault.create_secret($1::text,$2::text)', [secret, name]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    console.log(JSON.stringify({ configured: true, serverVerified: true }));
  }
} finally { client.release(); await pool.end(); }
