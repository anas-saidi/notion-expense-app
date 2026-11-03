-- Metadata only. Existing writers/readers remain compatible during rollout.
-- The generation marker prevents an old publisher from leaving a stale hash
-- that a newer publisher could mistake for the current data.
ALTER TABLE public.finance_mirror ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.finance_mirror ADD COLUMN IF NOT EXISTS content_generation uuid;
COMMENT ON COLUMN public.finance_mirror.content_hash IS 'SHA-256 of the complete canonical Notion snapshot; freshness is renewed only after a verified import';
COMMENT ON COLUMN public.finance_mirror.content_generation IS 'Generation verified by content_hash; mismatched generations always require publication';
