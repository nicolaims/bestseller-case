import type { Request, Response } from 'express';
import * as approvedPhotoService from '../services/approvedPhotoService.js';

export function listApprovedPhotos(req: Request, res: Response) {
  const { partnerId, ticketId } = req.query;
  res.json(
    approvedPhotoService.listApprovedPhotos({
      partnerId: typeof partnerId === 'string' ? partnerId : undefined,
      ticketId: typeof ticketId === 'string' ? ticketId : undefined,
    }),
  );
}
