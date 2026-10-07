import { nanoid } from 'nanoid';
import { loadDb, withDb } from '../db/jsonDb.js';
import { HttpError } from '../types/index.js';
import type { Ticket, TicketStatus, Role, ColourVariant, Priority, BasePhotos } from '../types/index.js';

/** Allowed status transitions. "Approved"/"Rejected" are reached automatically
 * once every colour variant has a decision (see `recomputeStatus`), not via a
 * direct status-setting call. Rejected tickets return to Pending via an
 * explicit `requeue` call rather than auto-collapsing. */
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  Pending: ['Sent'],
  Sent: ['In Progress'],
  'In Progress': ['Completed'],
  Completed: ['Approved', 'Rejected'],
  Approved: [],
  Rejected: ['Pending'],
};

const PARTNER_ACK_DELAY_MS = 5000;

function assertTransition(ticket: Ticket, next: TicketStatus) {
  if (!VALID_TRANSITIONS[ticket.status].includes(next)) {
    throw new HttpError(409, `Cannot move ticket from "${ticket.status}" to "${next}"`);
  }
}

function touch(ticket: Ticket) {
  ticket.updatedAt = new Date().toISOString();
}

/** Re-derives the ticket's overall status from its variants' individual
 * decisions. Stays "Completed" while any variant is still undecided, so the
 * ticket remains actionable in the queue until every colour has been reviewed. */
function recomputeStatus(ticket: Ticket) {
  if (ticket.status !== 'Completed' && ticket.status !== 'Approved' && ticket.status !== 'Rejected') return;
  const stillPending = ticket.colourVariants.some((v) => v.decision === 'pending');
  if (stillPending) {
    ticket.status = 'Completed';
  } else {
    ticket.status = ticket.colourVariants.some((v) => v.decision === 'approved') ? 'Approved' : 'Rejected';
  }
}

/** Simulates the partner's response to a sent ticket. A small chance of a
 * rejection gives the UI a real failure path to exercise instead of the
 * integration always succeeding. Exposed as a seam so tests can force a
 * deterministic outcome instead of depending on Math.random. */
export function simulatePartnerAckOutcome(): 'Acknowledged' | 'Rejected' {
  return Math.random() < 0.85 ? 'Acknowledged' : 'Rejected';
}

export function listTickets(filters: { status?: string; partnerId?: string; priority?: string; search?: string }): Ticket[] {
  const db = loadDb();
  return db.tickets.filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.partnerId && t.partnerId !== filters.partnerId) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.search && !t.photoId.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

export function getTicket(id: string): Ticket {
  const db = loadDb();
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);
  return ticket;
}

export interface CreateTicketInput {
  style: string;
  productNumber: string;
  priority: Priority;
  partnerId: string;
  notes?: string;
  colourVariants: Array<Pick<ColourVariant, 'name' | 'type' | 'pantone' | 'referenceImagePath'>>;
  basePhotos: BasePhotos;
  createdBy: Role;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  if (!input.basePhotos.front) throw new HttpError(400, 'A front photo is required');
  if (!input.colourVariants.length) throw new HttpError(400, 'At least one colour variant is required');

  return withDb((db) => {
    if (!db.partners.some((p) => p.id === input.partnerId)) {
      throw new HttpError(400, `Unknown partner ${input.partnerId}`);
    }

    const now = new Date().toISOString();
    const ticket: Ticket = {
      id: nanoid(),
      photoId: `${input.style}_${input.productNumber}`,
      style: input.style,
      productNumber: input.productNumber,
      basePhotos: input.basePhotos,
      colourVariants: input.colourVariants.map((v) => ({ id: nanoid(), decision: 'pending', ...v })),
      priority: input.priority,
      partnerId: input.partnerId,
      status: 'Pending',
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      notes: input.notes,
    };

    db.tickets.push(ticket);
    return ticket;
  });
}

export interface UpdateTicketInput {
  priority?: Priority;
  partnerId?: string;
  notes?: string;
}

export async function updateTicket(id: string, input: UpdateTicketInput): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);

    if (input.partnerId && !db.partners.some((p) => p.id === input.partnerId)) {
      throw new HttpError(400, `Unknown partner ${input.partnerId}`);
    }

    if (input.priority) ticket.priority = input.priority;
    if (input.partnerId) ticket.partnerId = input.partnerId;
    if (input.notes !== undefined) ticket.notes = input.notes;
    touch(ticket);
    return ticket;
  });
}

export interface AddVariantInput {
  name: string;
  type: ColourVariant['type'];
  pantone?: string;
  referenceImagePath?: string;
}

/** Appends a newly requested colour to an existing ticket. If the ticket had
 * already finished review (Approved/Rejected), it reopens to Completed since
 * there's now a fresh colour awaiting a decision. */
export async function addColourVariant(ticketId: string, input: AddVariantInput): Promise<Ticket> {
  if (!input.name.trim()) throw new HttpError(400, 'A colour/pattern name is required');

  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new HttpError(404, `Ticket ${ticketId} not found`);

    ticket.colourVariants.push({ id: nanoid(), decision: 'pending', ...input });
    if (ticket.status === 'Approved' || ticket.status === 'Rejected') {
      ticket.status = 'Completed';
    }
    touch(ticket);
    return ticket;
  });
}

export async function sendToPartner(id: string): Promise<Ticket> {
  const ticket = await withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);
    assertTransition(ticket, 'Sent');

    ticket.status = 'Sent';
    ticket.partnerReceipt = { sentAt: new Date().toISOString(), receiptStatus: 'Pending' };
    touch(ticket);
    return ticket;
  });

  /** Simulated partner ack. Reloads the db at fire-time (via `withDb`) instead
   * of closing over the ticket read above, since the file may have changed in
   * the meantime — and routes that same read-modify-write cycle through the
   * same queue lock as every other mutation, so it can't race a manager
   * approving/rejecting the ticket concurrently.
   * Limitation: this timer isn't persisted anywhere, so a server restart
   * within the delay window loses it and the ticket is stuck on "Sent" until
   * someone uses the manual "Force acknowledge" action (see
   * `forceAcknowledge` below). */
  setTimeout(() => {
    withDb((freshDb) => {
      const freshTicket = freshDb.tickets.find((t) => t.id === id);
      if (!freshTicket || freshTicket.status !== 'Sent') return;

      const outcome = simulatePartnerAckOutcome();
      if (outcome === 'Rejected') {
        freshTicket.partnerReceipt = {
          ...freshTicket.partnerReceipt,
          receiptStatus: 'Rejected',
        };
      } else {
        freshTicket.status = 'In Progress';
        freshTicket.partnerReceipt = {
          ...freshTicket.partnerReceipt,
          acknowledgedAt: new Date().toISOString(),
          receiptStatus: 'Acknowledged',
        };
      }
      touch(freshTicket);
    }).catch((err) => {
      console.error(`Failed to persist partner acknowledgement for ticket ${id}`, err);
    });
  }, PARTNER_ACK_DELAY_MS);

  return ticket;
}

/** Manual escape hatch for a ticket stuck on "Sent" (e.g. the server
 * restarted during the 5s simulated partner-ack window, or the partner
 * "rejected" the receipt). Lets an operator unstick it by hand instead of
 * being permanently blocked. */
export async function forceAcknowledge(id: string): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);
    if (ticket.status !== 'Sent') {
      throw new HttpError(409, `Ticket must be "Sent" to force-acknowledge (currently "${ticket.status}")`);
    }

    ticket.status = 'In Progress';
    ticket.partnerReceipt = {
      ...ticket.partnerReceipt,
      acknowledgedAt: new Date().toISOString(),
      receiptStatus: 'Acknowledged',
    };
    touch(ticket);
    return ticket;
  });
}

export async function completeTicket(id: string): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);
    assertTransition(ticket, 'Completed');

    ticket.status = 'Completed';
    ticket.partnerReceipt = { ...ticket.partnerReceipt, receiptStatus: 'Received' };
    touch(ticket);
    return ticket;
  });
}

function getPendingVariant(ticket: Ticket, variantId: string): ColourVariant {
  const variant = ticket.colourVariants.find((v) => v.id === variantId);
  if (!variant) throw new HttpError(404, `Colour variant ${variantId} not found on ticket ${ticket.id}`);
  if (ticket.status !== 'Completed') {
    throw new HttpError(409, `Ticket must be Completed before its colours can be reviewed (currently "${ticket.status}")`);
  }
  if (variant.decision !== 'pending') {
    throw new HttpError(409, `Colour "${variant.name}" has already been ${variant.decision}`);
  }
  return variant;
}

export async function approveVariant(
  ticketId: string,
  variantId: string,
  approvedBy: Role,
): Promise<{ ticket: Ticket; approvedPhoto: Ticket['colourVariants'][number] }> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new HttpError(404, `Ticket ${ticketId} not found`);
    const variant = getPendingVariant(ticket, variantId);

    const now = new Date().toISOString();
    variant.decision = 'approved';
    variant.decidedBy = approvedBy;
    variant.decidedAt = now;

    db.approvedPhotos.push({
      id: nanoid(),
      ticketId: ticket.id,
      variantId: variant.id,
      imagePath: variant.referenceImagePath ?? ticket.basePhotos.front,
      approvedBy,
      approvedAt: now,
    });

    recomputeStatus(ticket);
    touch(ticket);
    return { ticket, approvedPhoto: variant };
  });
}

export async function rejectVariant(ticketId: string, variantId: string, reason: string, rejectedBy: Role): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new HttpError(404, `Ticket ${ticketId} not found`);
    const variant = getPendingVariant(ticket, variantId);

    variant.decision = 'rejected';
    variant.decisionReason = reason;
    variant.decidedBy = rejectedBy;
    variant.decidedAt = new Date().toISOString();

    recomputeStatus(ticket);
    touch(ticket);
    return ticket;
  });
}

/** Reopens a fully-rejected ticket: clears every variant's decision and
 * restarts the pipeline from Pending, ready to be sent again. */
export async function requeueTicket(id: string): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === id);
    if (!ticket) throw new HttpError(404, `Ticket ${id} not found`);
    assertTransition(ticket, 'Pending');

    for (const variant of ticket.colourVariants) {
      variant.decision = 'pending';
      variant.decisionReason = undefined;
      variant.decidedBy = undefined;
      variant.decidedAt = undefined;
    }
    ticket.status = 'Pending';
    ticket.partnerReceipt = undefined;
    touch(ticket);
    return ticket;
  });
}

/** Reopens a single rejected variant for re-review, without touching any
 * other variant's decision, then recomputes the ticket's overall status —
 * this is the per-variant equivalent of `requeueTicket`, needed because the
 * ticket flips to "Approved" as soon as no variant is left pending even if
 * one of them was actually rejected, leaving that variant with no path back
 * into the queue otherwise. */
export async function requeueVariant(ticketId: string, variantId: string): Promise<Ticket> {
  return withDb((db) => {
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new HttpError(404, `Ticket ${ticketId} not found`);
    const variant = ticket.colourVariants.find((v) => v.id === variantId);
    if (!variant) throw new HttpError(404, `Colour variant ${variantId} not found on ticket ${ticketId}`);
    if (variant.decision !== 'rejected') {
      throw new HttpError(409, `Colour "${variant.name}" is not rejected`);
    }

    variant.decision = 'pending';
    variant.decisionReason = undefined;
    variant.decidedBy = undefined;
    variant.decidedAt = undefined;

    recomputeStatus(ticket);
    touch(ticket);
    return ticket;
  });
}
