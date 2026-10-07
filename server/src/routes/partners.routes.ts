import { Router } from 'express';
import * as controller from '../controllers/partners.controller.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const partnersRouter = Router();

partnersRouter.get('/', asyncHandler(controller.listPartners));
