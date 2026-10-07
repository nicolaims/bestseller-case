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
  approveTicket,
  rejectTicket,
  addColourVariant,
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

  it('creates a Pending ticket with one colour variant per input', async () => {
    const ticket = await createTicket(validInput());
    expect(ticket.status).toBe('Pending');
    expect(ticket.colourVariants).toHaveLength(1);
  });
});

describe('status transitions', () => {
  it('rejects invalid transitions, e.g. completing a ticket that was never sent', async () => {
    const ticket = await createTicket(validInput());
    await expect(completeTicket(ticket.id)).rejects.toThrow(/Cannot move ticket from "Pending" to "Completed"/);
  });

  it('refuses to send a ticket to the partner before a Manager has approved it', async () => {
    const ticket = await createTicket(validInput());
    await expect(sendToPartner(ticket.id)).rejects.toThrow(/Cannot move ticket from "Pending" to "Sent"/);
  });

  it('allows the documented Pending -> Approved -> Sent transition', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
    const sent = await sendToPartner(ticket.id);
    expect(sent.status).toBe('Sent');
    expect(sent.partnerReceipt?.receiptStatus).toBe('Pending');
  });
});

describe('approveTicket', () => {
  it('approves a Pending ticket, records one ApprovedPhoto, and clears any prior rejection', async () => {
    const ticket = await createTicket(validInput());
    await rejectTicket(ticket.id, 'Wrong tone');

    const { ticket: approved, approvedPhoto } = await approveTicket(ticket.id, 'Manager');

    expect(approved.status).toBe('Approved');
    expect(approved.lastRejectionReason).toBeUndefined();
    expect(approvedPhoto.ticketId).toBe(ticket.id);
    expect(approvedPhoto.approvedBy).toBe('Manager');
    expect(db.approvedPhotos).toHaveLength(1);
  });

  it('refuses to approve a ticket that is not Pending', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
    await expect(approveTicket(ticket.id, 'Manager')).rejects.toThrow(HttpError);
  });
});

describe('rejectTicket', () => {
  it('stamps a rejection reason and leaves the ticket Pending', async () => {
    const ticket = await createTicket(validInput());
    const rejected = await rejectTicket(ticket.id, 'Wrong tone');
    expect(rejected.status).toBe('Pending');
    expect(rejected.lastRejectionReason).toBe('Wrong tone');
  });

  it('refuses to reject a ticket that is not Pending', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
    await expect(rejectTicket(ticket.id, 'Too late')).rejects.toThrow(HttpError);
  });
});

describe('addColourVariant', () => {
  it('reopens an Approved ticket to Pending and clears any rejection reason', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');

    const updated = await addColourVariant(ticket.id, { name: 'New Colour', type: 'solid', pantone: 'New Colour' });

    expect(updated.status).toBe('Pending');
    expect(updated.colourVariants).toHaveLength(2);
  });

  it('refuses to add a colour once the ticket has been sent to the partner', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
    await sendToPartner(ticket.id);

    await expect(
      addColourVariant(ticket.id, { name: 'New Colour', type: 'solid', pantone: 'New Colour' }),
    ).rejects.toThrow(HttpError);
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
    await approveTicket(ticket.id, 'Manager');
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
    await approveTicket(ticket.id, 'Manager');
    await sendToPartner(ticket.id);

    await vi.advanceTimersByTimeAsync(5000);

    const after = getTicket(ticket.id);
    expect(after.status).toBe('Sent'); // stuck, recoverable via forceAcknowledge
    expect(after.partnerReceipt?.receiptStatus).toBe('Rejected');
  });

  it('leaves the ticket alone if it moved on before the ack timer fires', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
    await sendToPartner(ticket.id);
    await forceAcknowledge(ticket.id);

    await vi.advanceTimersByTimeAsync(5000);

    expect(getTicket(ticket.id).status).toBe('In Progress');
  });
});

describe('forceAcknowledge', () => {
  it('moves a stuck "Sent" ticket to "In Progress"', async () => {
    const ticket = await createTicket(validInput());
    await approveTicket(ticket.id, 'Manager');
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
  it('does not let two concurrent approveTicket calls on the same ticket both succeed', async () => {
    const ticket = await createTicket(validInput());

    // Both go through `withDb`, so they must be serialized: whichever runs
    // second sees the ticket already Approved and should be refused, rather
    // than both reading the same pre-mutation snapshot and double-approving.
    const results = await Promise.allSettled([
      approveTicket(ticket.id, 'Manager'),
      approveTicket(ticket.id, 'Manager'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(db.approvedPhotos).toHaveLength(1);
    expect(getTicket(ticket.id).status).toBe('Approved');
  });
});
