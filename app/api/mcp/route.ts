import { createMcpHandler } from 'mcp-handler';
import { registerCoreTools, withMcpLogging } from './_shared';

// v1 public read-only MCP. Stateless Streamable HTTP; no session store, no KV.
// Rate-limited by middleware.ts. Tool bodies live in ./_shared.ts so v2 can
// reuse them without duplication.

const handler = createMcpHandler(
  (server) => {
    registerCoreTools(server);
  },
  {
    serverInfo: { name: 'bounty-index', version: '0.1.0' },
    maxSubscriptions: 0,
  },
);

const logged = withMcpLogging(handler, 'v1');

export { logged as GET, logged as POST, logged as DELETE };
