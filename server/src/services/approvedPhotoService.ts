import { loadDb } from '../db/jsonDb.js';
import type { ApprovedPhoto } from '../types/index.js';

export function listApprovedPhotos(filters: { partnerId?: string; ticketId?: string }): ApprovedPhoto[] {
  const db = loadDb();
  return db.approvedPhotos.filter((p) => {
    if (filters.ticketId && p.ticketId !== filters.ticketId) return false;
    if (filters.partnerId) {
      const ticket = db.tickets.find((t) => t.id === p.ticketId);
      if (!ticket || ticket.partnerId !== filters.partnerId) return false;
    }
    return true;
  });
}
