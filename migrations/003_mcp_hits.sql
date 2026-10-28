-- MCP endpoint usage log. One row per POST (JSON-RPC call) to /api/mcp[/v2].
-- Unauthenticated endpoint, so distinct ip / (ip, ua) is the usage proxy.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS mcp_hits (
  id      SERIAL PRIMARY KEY,
  ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version TEXT NOT NULL,            -- 'v1' | 'v2'
  ip      TEXT,
  ua      TEXT
);

CREATE INDEX IF NOT EXISTS mcp_hits_ts_idx ON mcp_hits (ts);
