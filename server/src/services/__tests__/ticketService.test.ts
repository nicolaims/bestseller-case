import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../types/index.js';
import { HttpError } from '../../types/index.js';

let db: Db;

vi.mock('../../db/jsonDb.js', () => ({
  loadDb: () => db,
  saveDb: (next: Db) => {
    db = next;
    return Promise.resolve();
  },
  withDb: async (mutator: (db: Db) => unknown) => {
    const result = await mutator(db);
    return result;
  },
}));

const {
  createTicket,
  sendToPartner,
  completeTicket,
  approveVariant,
  rejectVariant,
  requeueTicket,
  requeueVariant,
  forceAcknowledge,
  getTicket,
} = await import('../ticketService.js');

function validInput(colourVariants: Array<{ name: string; type: 'solid' | 'aop' }> = [{ name: 'Granita', type: 'solid' }]) {
  return {
    style: 'ABC',
    productNumber: '123',
    priority: 'Medium' as const,
    partnerId: 'p1',
    colourVariants,
    basePhotos: { front: '/uploads/front.jpg' },
    createdBy: 'Operator' as const,
  };
}

beforeEach(() => {
  db = {
    tickets: [],
    partners: [{ id: 'p1', name: 'Partner One' }],
    approvedPhotos: [],
  };
});

describe('createTicket', () => {
  it('rejects a ticket with no front photo', async () => {
    await expect(createTicket({ ...validInput(), basePhotos: {} as never })).rejects.toThrow(HttpError);
  });

  it('rejects a ticket with no colour variants', async () => {
    await expect(createTicket({ ...validInput([]) })).rejects.toThrow(HttpError);
  });

  it('rejects an unknown partner', async () => {
    await expect(createTicket({ ...validInput(), partnerId: 'does-not-exist' })).rejects.toThrow(HttpError);
  });

  it('creates a Pending ticket with one colour variant per input and no decision yet', async () => {
    const ticket = await createTicket(validInput());
    expect(ticket.status).toBe('Pending');
    expect(ticket.colourVariants).toHaveLength(1);
    expect(ticket.colourVariants[0].decision).toBe('pending');
  });
});

describe('status transitions', () => {
  it('rejects invalid transitions, e.g. completing a ticket that was never sent', async () => {
    const ticket = await createTicket(validInput());
    await expect(completeTicket(ticket.id)).rejects.toThrow(/Cannot move ticket from "Pending" to "Completed"/);
  });

  it('allows the documented Pending -> Sent transition', async () => {
    const ticket = await createTicket(validInput());
    const sent = await sendToPartner(ticket.id);
    expect(sent.status).toBe('Sent');
    expect(sent.partnerReceipt?.receiptStatus).toBe('Pending');
  });
});

describe('per-variant approval', () => {
  it('keeps the ticket Completed while any variant is still pending', async () => {
    const ticket = await createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';

    const [first, second] = ticket.colourVariants;
    const { ticket: afterFirst } = await approveVariant(ticket.id, first.id, 'Manager');

    expect(afterFirst.status).toBe('Completed');
    expect(second.decision).toBe('pending');

    const afterSecond = await rejectVariant(ticket.id, second.id, 'Colour is off', 'Manager');
    expect(afterSecond.status).toBe('Approved');
  });

  it('derives Rejected when every variant ends up rejected', async () => {
    const ticket = await createTicket(validInput());
    db.tickets[0].status = 'Completed';

    const result = await rejectVariant(ticket.id, ticket.colourVariants[0].id, 'Wrong tone', 'Manager');
    expect(result.status).toBe('Rejected');
  });

  it('creates exactly one ApprovedPhoto per approved variant', async () => {
    const ticket = await createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';

    await approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager');
    await approveVariant(ticket.id, ticket.colourVariants[1].id, 'Manager');

    expect(db.approvedPhotos).toHaveLength(2);
    expect(db.approvedPhotos.map((p) => p.variantId)).toEqual(ticket.colourVariants.map((v) => v.id));
  });

  it('refuses to approve a variant before the ticket is Completed', async () => {
    const ticket = await createTicket(validInput());
    await expect(approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager')).rejects.toThrow(HttpError);
  });

  it('refuses to decide the same variant twice', async () => {
    const ticket = await createTicket(validInput());
    db.tickets[0].status = 'Completed';

    await approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager');
    await expect(approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager')).rejects.toThrow(HttpError);
  });
});

describe('requeueTicket', () => {
  it('clears every variant decision and sends a fully-rejected ticket back to Pending', async () => {
    const ticket = await createTicket(validInput());
    db.tickets[0].status = 'Completed';
    await rejectVariant(ticket.id, ticket.colourVariants[0].id, 'Wrong tone', 'Manager');

    const requeued = await requeueTicket(ticket.id);

    expect(requeued.status).toBe('Pending');
    expect(requeued.colourVariants[0].decision).toBe('pending');
    expect(requeued.colourVariants[0].decisionReason).toBeUndefined();
    expect(getTicket(ticket.id).partnerReceipt).toBeUndefined();
  });
});

describe('requeueVariant', () => {
  it('reopens only the rejected variant and recomputes the ticket back to Completed', async () => {
    const ticket = await createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';

    const [first, second] = ticket.colourVariants;
    await approveVariant(ticket.id, first.id, 'Manager');
    const afterReject = await rejectVariant(ticket.id, second.id, 'Wrong tone', 'Manager');
    // Overall ticket resolves to Approved even though one variant was rejected.
    expect(afterReject.status).toBe('Approved');

    const requeued = await requeueVariant(ticket.id, second.id);

    expect(requeued.status).toBe('Completed');
    const reopened = requeued.colourVariants.find((v) => v.id === second.id)!;
    expect(reopened.decision).toBe('pending');
    expect(reopened.decisionReason).toBeUndefined();
    // The already-approved variant is untouched.
    expect(requeued.colourVariants.find((v) => v.id === first.id)!.decision).toBe('approved');
  });

  it('refuses to requeue a variant that was not rejected', async () => {
    const ticket = await createTicket(validInput());
    db.tickets[0].status = 'Completed';
    await approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager');

    await expect(requeueVariant(ticket.id, ticket.colourVariants[0].id)).rejects.toThrow(HttpError);
  });
});

describe('sendToPartner acknowledgement timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('flips a Sent ticket to In Progress once the simulated ack timer fires', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ticket = await createTicket(validInput());
    await sendToPartner(ticket.id);
    expect(getTicket(ticket.id).status).toBe('Sent');

    await vi.advanceTimersByTimeAsync(5000);

    const after = getTicket(ticket.id);
    expect(after.status).toBe('In Progress');
    expect(after.partnerReceipt?.receiptStatus).toBe('Acknowledged');
  });

  it('simulates a partner rejection receipt instead of only ever succeeding', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ticket = await createTicket(validInput());
    await sendToPartner(ticket.id);

    await vi.advanceTimersByTimeAsync(5000);

    const after = getTicket(ticket.id);
    expect(after.status).toBe('Sent'); // stuck, recoverable via forceAcknowledge
    expect(after.partnerReceipt?.receiptStatus).toBe('Rejected');
  });

  it('leaves the ticket alone if it moved on before the ack timer fires', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ticket = await createTicket(validInput());
    await sendToPartner(ticket.id);
    await forceAcknowledge(ticket.id);

    await vi.advanceTimersByTimeAsync(5000);

    expect(getTicket(ticket.id).status).toBe('In Progress');
  });
});

describe('forceAcknowledge', () => {
  it('moves a stuck "Sent" ticket to "In Progress"', async () => {
    const ticket = await createTicket(validInput());
    await sendToPartner(ticket.id);

    const forced = await forceAcknowledge(ticket.id);
    expect(forced.status).toBe('In Progress');
    expect(forced.partnerReceipt?.receiptStatus).toBe('Acknowledged');
  });

  it('refuses to force-acknowledge a ticket that is not Sent', async () => {
    const ticket = await createTicket(validInput());
    await expect(forceAcknowledge(ticket.id)).rejects.toThrow(HttpError);
  });
});

describe('concurrent mutations', () => {
  it("does not lose either update when two read-modify-write cycles race on the same ticket", async () => {
    const ticket = await createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';
    const [first, second] = ticket.colourVariants;

    // Simulate two concurrent read-modify-write cycles touching the same
    // ticket (e.g. the partner-ack timer firing while a manager approves).
    // Both go through `withDb`, so they must be serialized rather than both
    // reading the same pre-mutation snapshot and one clobbering the other.
    const [a, b] = await Promise.all([
      approveVariant(ticket.id, first.id, 'Manager'),
      rejectVariant(ticket.id, second.id, 'Wrong tone', 'Manager'),
    ]);

    expect(a.ticket.colourVariants.find((v) => v.id === first.id)!.decision).toBe('approved');
    expect(b.colourVariants.find((v) => v.id === second.id)!.decision).toBe('rejected');

    const final = getTicket(ticket.id);
    expect(final.colourVariants.find((v) => v.id === first.id)!.decision).toBe('approved');
    expect(final.colourVariants.find((v) => v.id === second.id)!.decision).toBe('rejected');
  });
});
