import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { HttpError } from '../utils/HttpError';

function isDuplicateKeyError(err: unknown): err is { code: number; keyValue: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, errors: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? 'File too large (max 5 MB)' : err.message });
    return;
  }

  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    res.status(409).json({ message: `Duplicate ${field}`, errors: err.keyValue });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({ message: 'Internal server error' });
};
