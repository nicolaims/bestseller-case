import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Db } from '../../types/index.js';
import { HttpError } from '../../types/index.js';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'errorhandler-test-'));
const tempDbPath = path.join(tempDir, 'db.json');

vi.mock('../../config.js', () => ({
  DATA_DIR: tempDir,
  DB_PATH: tempDbPath,
}));

const { asyncHandler, requireRole, errorHandler } = await import('../errorHandler.js');
const ticketService = await import('../../services/ticketService.js');

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn(() => res as Response);
  res.json = vi.fn(() => res as Response);
  return res as Response;
}

beforeEach(() => {
  const db: Db = { tickets: [], partners: [{ id: 'p1', name: 'Partner One' }], approvedPhotos: [] };
  fs.writeFileSync(tempDbPath, JSON.stringify(db));
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('requireRole', () => {
  it('calls next() when the x-role header matches', () => {
    const req = { header: () => 'Manager' } as unknown as Request;
    const next = vi.fn();
    requireRole('Manager')(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with a 403 HttpError when the header does not match', () => {
    const req = { header: () => 'Operator' } as unknown as Request;
    const next = vi.fn();
    requireRole('Manager')(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(403);
  });

  it('rejects when the header is missing entirely', () => {
    const req = { header: () => undefined } as unknown as Request;
    const next = vi.fn();
    requireRole('Operator')(req, {} as Response, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(403);
  });
});

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps an HttpError to its own status code', () => {
    const res = makeRes();
    errorHandler(new HttpError(404, 'not found'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'not found' });
  });

  it('maps an unknown error to a 500 without leaking its message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();
    errorHandler(new Error('something internal'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});

describe('asyncHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards a rejected promise to next() instead of crashing or leaving it unhandled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Forces the db write inside createTicket to fail, simulating a disk
    // error during a request — this must surface as a proper error response,
    // not an unhandled rejection or a thrown exception.
    const writeFileSpy = vi.spyOn(fs, 'writeFile');
    writeFileSpy.mockImplementationOnce(((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error) => void;
      cb(new Error('disk full'));
    }) as unknown as typeof fs.writeFile);

    const handler = asyncHandler(async (_req, res) => {
      const ticket = await ticketService.createTicket({
        style: 'ABC',
        productNumber: '123',
        priority: 'Medium',
        partnerId: 'p1',
        colourVariants: [{ name: 'Granita', type: 'solid' }],
        basePhotos: { front: '/uploads/front.jpg' },
        createdBy: 'Operator',
      });
      res.status(201).json(ticket);
    });

    const res = makeRes();
    const forwardedError = await new Promise((resolve) => {
      const next = vi.fn((err: unknown) => resolve(err));
      handler({} as Request, res, next);
    });

    expect(forwardedError).toBeInstanceOf(Error);
    expect((forwardedError as Error).message).toBe('disk full');
    expect(res.status).not.toHaveBeenCalledWith(201);

    // Fed through the real error handler, this becomes a clean 500.
    errorHandler(forwardedError, {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
