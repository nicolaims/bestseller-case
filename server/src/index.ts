import { createApp } from './app.js';
import { PORT } from './config.js';
import { dbExists } from './db/jsonDb.js';
import { seedIfMissing } from './db/seed.js';

async function main() {
  if (!dbExists()) {
    console.log('No db.json found, seeding initial data...');
    await seedIfMissing();
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main();
