import fs from 'node:fs';
import { DATA_DIR, DB_PATH } from '../config.js';
import type { Db } from '../types/index.js';

const EMPTY_DB: Db = { tickets: [], partners: [], approvedPhotos: [] };

export function dbExists(): boolean {
  return fs.existsSync(DB_PATH);
}

export function loadDb(): Db {
  if (!fs.existsSync(DB_PATH)) return structuredClone(EMPTY_DB);
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw) as Db;
}

/** Chains writes so overlapping async mutations (e.g. a request and a
 * partner-send timeout firing together) can't interleave and corrupt the file. */
let writeQueue: Promise<void> = Promise.resolve();

export function saveDb(db: Db): Promise<void> {
  writeQueue = writeQueue.then(
    () =>
      new Promise<void>((resolve, reject) => {
        fs.mkdir(DATA_DIR, { recursive: true }, (mkdirErr) => {
          if (mkdirErr) return reject(mkdirErr);
          fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (writeErr) => {
            if (writeErr) return reject(writeErr);
            resolve();
          });
        });
      }),
  );
  return writeQueue;
}
