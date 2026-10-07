import type { Request, Response } from 'express';
import * as ticketService from '../services/ticketService.js';
import { uploadedPath } from '../middleware/upload.js';
import { HttpError } from '../types/index.js';
import type { ColourVariant, Priority, Role } from '../types/index.js';

function filesByFieldname(req: Request): Record<string, Express.Multer.File> {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const map: Record<string, Express.Multer.File> = {};
  for (const file of files) map[file.fieldname] = file;
  return map;
}

export function listTickets(req: Request, res: Response) {
  const { status, partnerId, priority, search } = req.query;
  const tickets = ticketService.listTickets({
    status: typeof status === 'string' ? status : undefined,
    partnerId: typeof partnerId === 'string' ? partnerId : undefined,
    priority: typeof priority === 'string' ? priority : undefined,
    search: typeof search === 'string' ? search : undefined,
  });
  res.json(tickets);
}

export function getTicket(req: Request, res: Response) {
  res.json(ticketService.getTicket(req.params.id));
}

export function createTicket(req: Request, res: Response) {
  const body = req.body as Record<string, string>;
  const files = filesByFieldname(req);

  if (!body.style || !body.productNumber) {
    throw new HttpError(400, 'style and productNumber are required');
  }
  if (!body.priority || !body.partnerId) {
    throw new HttpError(400, 'priority and partnerId are required');
  }

  let rawVariants: Array<{ name: string; type: 'solid' | 'aop'; pantone?: string }>;
  try {
    rawVariants = JSON.parse(body.colourVariants || '[]');
  } catch {
    throw new HttpError(400, 'colourVariants must be valid JSON');
  }
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw new HttpError(400, 'At least one colour variant is required');
  }

  const colourVariants: Array<Pick<ColourVariant, 'name' | 'type' | 'pantone' | 'referenceImagePath'>> =
    rawVariants.map((v, index) => ({
      name: v.name,
      type: v.type,
      pantone: v.type === 'solid' ? v.pantone : undefined,
      referenceImagePath: v.type === 'aop' ? uploadedPath(files[`variantRef_${index}`]) : undefined,
    }));

  const role = (req.header('x-role') as Role) || 'Operator';

  const ticket = ticketService.createTicket({
    style: body.style,
    productNumber: body.productNumber,
    priority: body.priority as Priority,
    partnerId: body.partnerId,
    notes: body.notes || undefined,
    colourVariants,
    basePhotos: {
      front: uploadedPath(files.front) as string,
      back: uploadedPath(files.back),
      detail: uploadedPath(files.detail),
    },
    createdBy: role,
  });

  res.status(201).json(ticket);
}

export function updateTicket(req: Request, res: Response) {
  const body = req.body as { priority?: Priority; partnerId?: string; notes?: string };
  res.json(ticketService.updateTicket(req.params.id, body));
}

export function sendToPartner(req: Request, res: Response) {
  res.json(ticketService.sendToPartner(req.params.id));
}

export function completeTicket(req: Request, res: Response) {
  res.json(ticketService.completeTicket(req.params.id));
}

export function approveVariant(req: Request, res: Response) {
  const { variantId } = req.body as { variantId?: string };
  if (!variantId) throw new HttpError(400, 'variantId is required');
  const role = (req.header('x-role') as Role) || 'Operator';
  const { ticket, approvedPhoto } = ticketService.approveVariant(req.params.id, variantId, role);
  res.json({ ticket, approvedPhoto });
}

export function rejectVariant(req: Request, res: Response) {
  const { variantId, reason } = req.body as { variantId?: string; reason?: string };
  if (!variantId) throw new HttpError(400, 'variantId is required');
  if (!reason) throw new HttpError(400, 'A rejection reason is required');
  const role = (req.header('x-role') as Role) || 'Operator';
  res.json(ticketService.rejectVariant(req.params.id, variantId, reason, role));
}

export function requeueTicket(req: Request, res: Response) {
  res.json(ticketService.requeueTicket(req.params.id));
}

export function addColourVariant(req: Request, res: Response) {
  const body = req.body as { name?: string; type?: 'solid' | 'aop'; pantone?: string };
  const files = filesByFieldname(req);

  if (!body.name || !body.type) throw new HttpError(400, 'name and type are required');

  const ticket = ticketService.addColourVariant(req.params.id, {
    name: body.name,
    type: body.type,
    pantone: body.type === 'solid' ? body.pantone : undefined,
    referenceImagePath: body.type === 'aop' ? uploadedPath(files.variantRef) : undefined,
  });
  res.status(201).json(ticket);
}
