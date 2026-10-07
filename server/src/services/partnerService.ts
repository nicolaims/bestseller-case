import { loadDb } from '../db/jsonDb.js';
import type { Partner } from '../types/index.js';

export function listPartners(): Partner[] {
  return loadDb().partners;
}
