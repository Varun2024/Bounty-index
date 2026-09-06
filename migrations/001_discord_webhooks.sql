-- Discord webhook subscriptions. See docs/plans/PLAN_DISCORD.md.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS discord_webhooks (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  program_id        INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  webhook_url       TEXT NOT NULL,
  label             TEXT,
  last_delivered_at TIMESTAMPTZ,
  broken_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_webhooks_user_program_url_uq
  ON discord_webhooks (user_id, program_id, webhook_url);

CREATE INDEX IF NOT EXISTS discord_webhooks_program_active_idx
  ON discord_webhooks (program_id);

CREATE INDEX IF NOT EXISTS discord_webhooks_user_idx
  ON discord_webhooks (user_id);
