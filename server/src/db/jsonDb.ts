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

function persist(db: Db): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.mkdir(DATA_DIR, { recursive: true }, (mkdirErr) => {
      if (mkdirErr) return reject(mkdirErr);
      fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (writeErr) => {
        if (writeErr) return reject(writeErr);
        resolve();
      });
    });
  });
}

/** Chains operations so overlapping async mutations (e.g. a request and a
 * partner-send timeout firing together) can't interleave and corrupt the
 * file. The queue always advances to its next link even when `fn` rejects,
 * so a single failed write doesn't wedge every write that comes after it —
 * the failure is still reported back to whoever called this particular
 * `enqueue`. */
let writeQueue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function saveDb(db: Db): Promise<void> {
  return enqueue(() => persist(db));
}

/** Loads the db, runs `mutator` against it, and saves the result — all under
 * the same queue lock used by `saveDb`. This makes the whole read-modify-write
 * cycle atomic with respect to other `withDb`/`saveDb` callers, which plain
 * `loadDb()` + `saveDb()` call sites can't guarantee: two overlapping cycles
 * (e.g. the partner-ack timeout firing while a manager approves the same
 * ticket) could otherwise both read the same pre-mutation snapshot and the
 * second write would silently discard the first's change. */
export function withDb<T>(mutator: (db: Db) => T | Promise<T>): Promise<T> {
  return enqueue(async () => {
    const db = loadDb();
    const result = await mutator(db);
    await persist(db);
    return result;
  });
}
