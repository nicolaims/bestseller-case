import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

export const PORT = Number(process.env.PORT) || 4000;

export const DATA_DIR = path.join(SERVER_ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'db.json');

export const UPLOADS_DIR = path.join(SERVER_ROOT, 'uploads');
export const SEED_UPLOADS_DIR = path.join(UPLOADS_DIR, 'seed');

// Source assets for the 4 provided tickets, shipped alongside the brief.
export const SOURCE_TICKETS_DIR = path.join(REPO_ROOT, 'recolour-case');
