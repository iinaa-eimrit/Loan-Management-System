import fs from 'node:fs';
import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function main() {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start', err);
  process.exit(1);
});
