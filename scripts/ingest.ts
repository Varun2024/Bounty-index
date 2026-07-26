import 'dotenv/config';
import { ingestAll } from '../lib/ingest/bounty-targets';

ingestAll()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
