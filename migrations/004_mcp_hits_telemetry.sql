-- MCP telemetry + rate-limiting support.
-- Adds the called tool/method and handler latency to each usage row (so we can see
-- WHICH tools agents use, not just that someone connected), plus an (ip, ts) index
-- for the per-IP rate-limit count in app/api/mcp/_shared.ts. Idempotent.

ALTER TABLE mcp_hits ADD COLUMN IF NOT EXISTS tool        TEXT;
ALTER TABLE mcp_hits ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS mcp_hits_ip_ts_idx ON mcp_hits (ip, ts);
