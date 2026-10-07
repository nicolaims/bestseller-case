import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
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

const MAGIC_BYTE_CHECKS: Record<string, (head: Buffer) => boolean> = {
  'image/jpeg': (head) => head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff,
  'image/png': (head) =>
    head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (head) =>
    head.length >= 12 &&
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP',
};

/** `fileFilter` above only trusts the client-supplied `mimetype`, which is
 * trivially spoofed (e.g. renaming a .exe to .jpg). This re-checks each
 * uploaded file's first bytes against the mimetype it was accepted under,
 * once it's on disk, and rejects the whole request (deleting the offending
 * file) if they don't match. Still a shallow signature check rather than a
 * full image decode — accepted as a PoC-level limitation. */
export function verifyUploadedFileSignatures(req: Request, _res: Response, next: NextFunction) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  for (const file of files) {
    const check = MAGIC_BYTE_CHECKS[file.mimetype];
    let head = Buffer.alloc(0);
    try {
      const fd = fs.openSync(file.path, 'r');
      const buf = Buffer.alloc(12);
      const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);
      head = buf.subarray(0, bytesRead);
    } catch {
      // Treated as a failed check below.
    }
    if (!check || !check(head)) {
      fs.unlink(file.path, () => {});
      return next(new HttpError(400, `File "${file.originalname}" does not look like a valid ${file.mimetype}`));
    }
  }
  next();
}
