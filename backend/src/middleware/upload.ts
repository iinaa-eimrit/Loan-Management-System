import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env';
import { HttpError } from '../utils/HttpError';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: env.UPLOAD_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype] ?? path.extname(file.originalname)}`);
  },
});

export const salarySlipUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in ALLOWED) return cb(null, true);
    cb(new HttpError(415, 'Only PDF, JPG or PNG files are allowed'));
  },
}).single('salarySlip');
