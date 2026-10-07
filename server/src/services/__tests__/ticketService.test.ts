import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../types/index.js';
import { HttpError } from '../../types/index.js';

let db: Db;

vi.mock('../../db/jsonDb.js', () => ({
  loadDb: () => db,
  saveDb: (next: Db) => {
    db = next;
    return Promise.resolve();
  },
}));

const { createTicket, sendToPartner, completeTicket, approveVariant, rejectVariant, requeueTicket, getTicket } =
  await import('../ticketService.js');

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
  it('rejects a ticket with no front photo', () => {
    expect(() => createTicket({ ...validInput(), basePhotos: {} as never })).toThrow(HttpError);
  });

  it('rejects a ticket with no colour variants', () => {
    expect(() => createTicket({ ...validInput([]) })).toThrow(HttpError);
  });

  it('rejects an unknown partner', () => {
    expect(() => createTicket({ ...validInput(), partnerId: 'does-not-exist' })).toThrow(HttpError);
  });

  it('creates a Pending ticket with one colour variant per input and no decision yet', () => {
    const ticket = createTicket(validInput());
    expect(ticket.status).toBe('Pending');
    expect(ticket.colourVariants).toHaveLength(1);
    expect(ticket.colourVariants[0].decision).toBe('pending');
  });
});

describe('status transitions', () => {
  it('rejects invalid transitions, e.g. completing a ticket that was never sent', () => {
    const ticket = createTicket(validInput());
    expect(() => completeTicket(ticket.id)).toThrow(/Cannot move ticket from "Pending" to "Completed"/);
  });

  it('allows the documented Pending -> Sent transition', () => {
    const ticket = createTicket(validInput());
    const sent = sendToPartner(ticket.id);
    expect(sent.status).toBe('Sent');
    expect(sent.partnerReceipt?.receiptStatus).toBe('Pending');
  });
});

describe('per-variant approval', () => {
  it('keeps the ticket Completed while any variant is still pending', () => {
    const ticket = createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';

    const [first, second] = ticket.colourVariants;
    const { ticket: afterFirst } = approveVariant(ticket.id, first.id, 'Manager');

    expect(afterFirst.status).toBe('Completed');
    expect(second.decision).toBe('pending');

    const afterSecond = rejectVariant(ticket.id, second.id, 'Colour is off', 'Manager');
    expect(afterSecond.status).toBe('Approved');
  });

  it('derives Rejected when every variant ends up rejected', () => {
    const ticket = createTicket(validInput());
    db.tickets[0].status = 'Completed';

    const result = rejectVariant(ticket.id, ticket.colourVariants[0].id, 'Wrong tone', 'Manager');
    expect(result.status).toBe('Rejected');
  });

  it('creates exactly one ApprovedPhoto per approved variant', () => {
    const ticket = createTicket(
      validInput([
        { name: 'Granita', type: 'solid' },
        { name: 'Fuchsia Fedora', type: 'solid' },
      ]),
    );
    db.tickets[0].status = 'Completed';

    approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager');
    approveVariant(ticket.id, ticket.colourVariants[1].id, 'Manager');

    expect(db.approvedPhotos).toHaveLength(2);
    expect(db.approvedPhotos.map((p) => p.variantId)).toEqual(ticket.colourVariants.map((v) => v.id));
  });

  it('refuses to approve a variant before the ticket is Completed', () => {
    const ticket = createTicket(validInput());
    expect(() => approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager')).toThrow(HttpError);
  });

  it('refuses to decide the same variant twice', () => {
    const ticket = createTicket(validInput());
    db.tickets[0].status = 'Completed';

    approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager');
    expect(() => approveVariant(ticket.id, ticket.colourVariants[0].id, 'Manager')).toThrow(HttpError);
  });
});

describe('requeueTicket', () => {
  it('clears every variant decision and sends a fully-rejected ticket back to Pending', () => {
    const ticket = createTicket(validInput());
    db.tickets[0].status = 'Completed';
    rejectVariant(ticket.id, ticket.colourVariants[0].id, 'Wrong tone', 'Manager');

    const requeued = requeueTicket(ticket.id);

    expect(requeued.status).toBe('Pending');
    expect(requeued.colourVariants[0].decision).toBe('pending');
    expect(requeued.colourVariants[0].decisionReason).toBeUndefined();
    expect(getTicket(ticket.id).partnerReceipt).toBeUndefined();
  });
});
