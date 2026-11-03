-- Keep the 15-minute mirror freshness bound without making the first visitor
-- rebuild it. Vercel Hobby supports only daily crons; Supabase runs this job.
-- Provision finance_mirror_refresh_url and finance_mirror_refresh_token in Vault
-- with scripts/configure-mirror-refresh.mjs before expecting successful calls.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.enqueue_finance_mirror_refresh()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  refresh_url text;
  refresh_token text;
  request_time text;
BEGIN
  SELECT decrypted_secret INTO refresh_url FROM vault.decrypted_secrets WHERE name = 'finance_mirror_refresh_url';
  SELECT decrypted_secret INTO refresh_token FROM vault.decrypted_secrets WHERE name = 'finance_mirror_refresh_token';
  IF refresh_url IS NULL OR refresh_token IS NULL THEN
    RAISE EXCEPTION 'Configure the financial mirror refresh URL and token in Vault';
  END IF;
  -- Never forward a server credential to an arbitrary URL supplied by a caller.
  IF refresh_url <> 'https://notion-expense-app.vercel.app/api/sync/refresh' THEN
    RAISE EXCEPTION 'Unexpected financial mirror refresh destination';
  END IF;
  request_time := floor(extract(epoch FROM clock_timestamp()))::bigint::text;
  RETURN net.http_get(
    url := refresh_url,
    headers := jsonb_build_object(
      'X-Finance-Refresh-Time', request_time,
      'X-Finance-Refresh-Signature', encode(extensions.hmac('finance-mirror-refresh:GET:/api/sync/refresh:' || request_time, refresh_token, 'sha256'), 'hex')
    ),
    timeout_milliseconds := 240000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_finance_mirror_refresh() FROM PUBLIC, anon, authenticated;
-- Supabase owns pg_net's queue and grants database login roles access to it.
-- Only expiring signatures enter that queue; the reusable secret stays in Vault.

SELECT cron.schedule('finance-mirror-refresh', '*/5 * * * *', 'SELECT public.enqueue_finance_mirror_refresh()');
COMMIT;
