-- Rebuildable Notion projection and durable coordination/idempotency records.
-- Financial agreements and counts stay authoritative in Notion.
BEGIN;

CREATE TABLE IF NOT EXISTS finance_mirror (
  scope text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0,
  published_revision bigint NOT NULL DEFAULT -1,
  snapshot jsonb, synced_at timestamptz,
  lease_id uuid, lease_until timestamptz, not_before timestamptz
);
CREATE TABLE IF NOT EXISTS finance_mirror_writes (
  id uuid PRIMARY KEY, scope text NOT NULL REFERENCES finance_mirror(scope), expires_at timestamptz NOT NULL
);
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS not_before timestamptz;
ALTER TABLE finance_mirror ADD COLUMN IF NOT EXISTS generation uuid;
CREATE INDEX IF NOT EXISTS finance_mirror_writes_scope ON finance_mirror_writes(scope);
CREATE TABLE IF NOT EXISTS finance_mirror_schemas (
  scope text NOT NULL REFERENCES finance_mirror(scope), generation uuid NOT NULL,
  database_id text NOT NULL, schema jsonb NOT NULL,
  PRIMARY KEY (scope, generation, database_id)
);
CREATE TABLE IF NOT EXISTS finance_mirror_records (
  scope text NOT NULL REFERENCES finance_mirror(scope), generation uuid NOT NULL,
  database_id text NOT NULL, ordinal bigint NOT NULL, page jsonb NOT NULL,
  PRIMARY KEY (scope, generation, database_id, ordinal)
);


CREATE TABLE IF NOT EXISTS finance_write_guards (
  scope text PRIMARY KEY,
  owner uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finance_notion_write_receipts (
  database_id text NOT NULL, page_id text NOT NULL, scope text NOT NULL,
  kind text NOT NULL, record_key text NOT NULL, version text NOT NULL,
  PRIMARY KEY(database_id,page_id)
);
CREATE TABLE IF NOT EXISTS finance_mcp_operations (
  scope text NOT NULL, request_id text NOT NULL, fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'pending', result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  PRIMARY KEY (scope,request_id)
);
ALTER TABLE public.finance_mirror ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_mirror FROM anon, authenticated;
ALTER TABLE public.finance_mirror_writes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_mirror_writes FROM anon, authenticated;
ALTER TABLE public.finance_mirror_schemas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_mirror_schemas FROM anon, authenticated;
ALTER TABLE public.finance_mirror_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_mirror_records FROM anon, authenticated;
ALTER TABLE public.finance_write_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_write_guards FROM anon, authenticated;
ALTER TABLE public.finance_notion_write_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_notion_write_receipts FROM anon, authenticated;
ALTER TABLE public.finance_mcp_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_mcp_operations FROM anon, authenticated;
COMMIT;
