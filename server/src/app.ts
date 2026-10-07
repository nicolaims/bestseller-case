import express from 'express';
import cors from 'cors';
import { UPLOADS_DIR } from './config.js';
import { ticketsRouter } from './routes/tickets.routes.js';
import { partnersRouter } from './routes/partners.routes.js';
import { approvedPhotosRouter } from './routes/approvedPhotos.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.use('/api/tickets', ticketsRouter);
  app.use('/api/partners', partnersRouter);
  app.use('/api/approved-photos', approvedPhotosRouter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use(errorHandler);

  return app;
}
