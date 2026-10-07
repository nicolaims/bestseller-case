import { Router } from 'express';
import * as controller from '../controllers/tickets.controller.js';
import { asyncHandler, requireRole } from '../middleware/errorHandler.js';
import { upload, verifyUploadedFileSignatures } from '../middleware/upload.js';

export const ticketsRouter = Router();

ticketsRouter.get('/', asyncHandler(controller.listTickets));
ticketsRouter.get('/:id', asyncHandler(controller.getTicket));
ticketsRouter.post('/', requireRole('Operator'), upload.any(), verifyUploadedFileSignatures, asyncHandler(controller.createTicket));
ticketsRouter.patch('/:id', asyncHandler(controller.updateTicket));
ticketsRouter.post('/:id/variants', upload.any(), verifyUploadedFileSignatures, asyncHandler(controller.addColourVariant));
ticketsRouter.post('/:id/send', asyncHandler(controller.sendToPartner));
ticketsRouter.post('/:id/complete', asyncHandler(controller.completeTicket));
ticketsRouter.post('/:id/force-ack', asyncHandler(controller.forceAcknowledge));
ticketsRouter.post('/:id/approve', requireRole('Manager'), asyncHandler(controller.approveVariant));
ticketsRouter.post('/:id/reject', requireRole('Manager'), asyncHandler(controller.rejectVariant));
ticketsRouter.post('/:id/requeue', asyncHandler(controller.requeueTicket));
ticketsRouter.post('/:id/variants/:variantId/requeue', asyncHandler(controller.requeueVariant));
