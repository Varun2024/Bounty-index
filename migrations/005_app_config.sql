-- Admin-editable site config: announcement strip, nudge timing/caps, banner copy.
-- One row per config domain (key = 'ui'); value is a JSONB blob validated in lib/site-config.ts.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
