-- Discord filter/saved-search subscriptions (v2). See docs/plans/PLAN_DISCORD_V2.md.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS discord_filter_subs (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  webhook_url       TEXT NOT NULL,
  label             TEXT,
  filter_json       JSONB NOT NULL,
  new_only          BOOLEAN NOT NULL DEFAULT FALSE,
  last_delivered_at TIMESTAMPTZ,
  broken_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discord_filter_subs_user_idx
  ON discord_filter_subs (user_id);
