import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db, Ticket } from '../../types/index.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsondb-test-'));
const tempDbPath = path.join(tempDir, 'db.json');

vi.mock('../../config.js', () => ({
  DATA_DIR: tempDir,
  DB_PATH: tempDbPath,
}));

const { loadDb, saveDb, withDb } = await import('../jsonDb.js');

function makeTicket(): Ticket {
  const now = new Date().toISOString();
  return {
    id: 't1',
    photoId: 'ABC_123',
    style: 'ABC',
    productNumber: '123',
    basePhotos: { front: '/uploads/front.jpg' },
    colourVariants: [],
    priority: 'Medium',
    partnerId: 'p1',
    status: 'Pending',
    createdBy: 'Operator',
    createdAt: now,
    updatedAt: now,
    notes: '',
  };
}

function writeFixture() {
  const db: Db = { tickets: [makeTicket()], partners: [{ id: 'p1', name: 'Partner One' }], approvedPhotos: [] };
  fs.writeFileSync(tempDbPath, JSON.stringify(db));
}

beforeEach(() => {
  writeFixture();
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('withDb', () => {
  it('serializes overlapping read-modify-write cycles so neither mutation is lost', async () => {
    // Mirrors the real race: the partner-ack timer firing while a manager
    // approves the same ticket. Both go through `withDb`, so the second
    // cycle's `loadDb()` must see the first cycle's write, not a stale
    // pre-mutation snapshot.
    function appendSlow(letter: string, delayMs: number) {
      return withDb(async (db) => {
        const ticket = db.tickets.find((t) => t.id === 't1')!;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        ticket.notes = (ticket.notes ?? '') + letter;
      });
    }

    await Promise.all([appendSlow('A', 20), appendSlow('B', 0)]);

    const final = loadDb();
    expect(final.tickets[0].notes).toBe('AB');
  });

  it('propagates a mutator-thrown error without corrupting the on-disk file', async () => {
    await expect(
      withDb((db) => {
        db.tickets[0].notes = 'should not persist';
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const final = loadDb();
    expect(final.tickets[0].notes).toBe('');
  });

  it('keeps serving later writes after an earlier save rejects', async () => {
    const writeFileSpy = vi.spyOn(fs, 'writeFile');
    writeFileSpy.mockImplementationOnce(((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error) => void;
      cb(new Error('disk full'));
    }) as unknown as typeof fs.writeFile);

    const db = loadDb();
    db.tickets[0].notes = 'first';
    await expect(saveDb(db)).rejects.toThrow('disk full');

    db.tickets[0].notes = 'second';
    await expect(saveDb(db)).resolves.toBeUndefined();

    expect(loadDb().tickets[0].notes).toBe('second');
    writeFileSpy.mockRestore();
  });
});
