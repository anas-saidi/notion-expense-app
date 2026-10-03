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
