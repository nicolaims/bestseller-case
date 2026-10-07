import { Router } from 'express';
import * as controller from '../controllers/approvedPhotos.controller.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const approvedPhotosRouter = Router();

approvedPhotosRouter.get('/', asyncHandler(controller.listApprovedPhotos));
