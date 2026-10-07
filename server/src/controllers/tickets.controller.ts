import type { Request, Response } from 'express';
import * as ticketService from '../services/ticketService.js';
import { uploadedPath } from '../middleware/upload.js';
import { HttpError } from '../types/index.js';
import type { ColourVariant, Priority, Role } from '../types/index.js';

const VALID_PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
const VALID_VARIANT_TYPES: Array<ColourVariant['type']> = ['solid', 'aop'];
const VALID_ROLES: Role[] = ['Operator', 'Manager'];

function roleFromHeader(req: Request): Role {
  const header = req.header('x-role');
  if (header === undefined) return 'Operator';
  if (!VALID_ROLES.includes(header as Role)) {
    throw new HttpError(400, `Invalid x-role header "${header}"`);
  }
  return header as Role;
}

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

export async function createTicket(req: Request, res: Response) {
  const body = req.body as Record<string, string>;
  const files = filesByFieldname(req);

  if (!body.style || !body.productNumber) {
    throw new HttpError(400, 'style and productNumber are required');
  }
  if (!body.priority || !body.partnerId) {
    throw new HttpError(400, 'priority and partnerId are required');
  }
  if (!VALID_PRIORITIES.includes(body.priority as Priority)) {
    throw new HttpError(400, `Invalid priority "${body.priority}"`);
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

  const colourVariants: Array<Pick<ColourVariant, 'name' | 'type' | 'pantone' | 'referenceImagePath'>> = rawVariants.map(
    (v, index) => {
      if (!VALID_VARIANT_TYPES.includes(v.type)) {
        throw new HttpError(400, `Invalid colour variant type "${v.type}"`);
      }
      return {
        name: v.name,
        type: v.type,
        pantone: v.type === 'solid' ? v.pantone : undefined,
        referenceImagePath: v.type === 'aop' ? uploadedPath(files[`variantRef_${index}`]) : undefined,
      };
    },
  );

  const role = roleFromHeader(req);

  const ticket = await ticketService.createTicket({
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

export async function updateTicket(req: Request, res: Response) {
  const body = req.body as { priority?: Priority; partnerId?: string; notes?: string };
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    throw new HttpError(400, `Invalid priority "${body.priority}"`);
  }
  res.json(await ticketService.updateTicket(req.params.id, body));
}

export async function sendToPartner(req: Request, res: Response) {
  res.json(await ticketService.sendToPartner(req.params.id));
}

export async function completeTicket(req: Request, res: Response) {
  res.json(await ticketService.completeTicket(req.params.id));
}

export async function forceAcknowledge(req: Request, res: Response) {
  res.json(await ticketService.forceAcknowledge(req.params.id));
}

export async function approveTicket(req: Request, res: Response) {
  const role = roleFromHeader(req);
  const { ticket, approvedPhoto } = await ticketService.approveTicket(req.params.id, role);
  res.json({ ticket, approvedPhoto });
}

export async function rejectTicket(req: Request, res: Response) {
  const { reason } = req.body as { reason?: string };
  if (!reason) throw new HttpError(400, 'A rejection reason is required');
  res.json(await ticketService.rejectTicket(req.params.id, reason));
}

export async function addColourVariant(req: Request, res: Response) {
  const body = req.body as { name?: string; type?: 'solid' | 'aop'; pantone?: string };
  const files = filesByFieldname(req);

  if (!body.name || !body.type) throw new HttpError(400, 'name and type are required');
  if (!VALID_VARIANT_TYPES.includes(body.type)) {
    throw new HttpError(400, `Invalid colour variant type "${body.type}"`);
  }

  const ticket = await ticketService.addColourVariant(req.params.id, {
    name: body.name,
    type: body.type,
    pantone: body.type === 'solid' ? body.pantone : undefined,
    referenceImagePath: body.type === 'aop' ? uploadedPath(files.variantRef) : undefined,
  });
  res.status(201).json(ticket);
}
