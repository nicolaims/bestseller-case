import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { UPLOADS_DIR } from '../config.js';
import { HttpError } from '../types/index.js';

const TICKETS_UPLOAD_DIR = path.join(UPLOADS_DIR, 'tickets');
fs.mkdirSync(TICKETS_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TICKETS_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()}${ext}`);
  },
});

function fileFilter(_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new HttpError(400, 'Only JPEG, PNG, or WebP images are allowed'));
  }
}

// Source product photography runs 10-15MB per shot at catalogue resolution,
// so the limit needs real headroom above typical web-upload sizes.
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function uploadedPath(file: Express.Multer.File | undefined): string | undefined {
  if (!file) return undefined;
  return `/uploads/tickets/${file.filename}`;
}
