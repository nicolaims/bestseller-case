import type { Request, Response } from 'express';
import * as partnerService from '../services/partnerService.js';

export function listPartners(_req: Request, res: Response) {
  res.json(partnerService.listPartners());
}
