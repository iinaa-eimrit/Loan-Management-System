import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';

import { authRouter } from './routes/auth.routes';
import { borrowerRouter } from './routes/borrower.routes';
import { salesRouter } from './routes/ops/sales.routes';
import { sanctionRouter } from './routes/ops/sanction.routes';
import { disbursementRouter } from './routes/ops/disbursement.routes';
import { collectionRouter } from './routes/ops/collection.routes';
import { opsSharedRouter } from './routes/ops/shared.routes';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(express.json({ limit: '100kb' }));

app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/borrower', borrowerRouter);
app.use('/api/ops/sales', salesRouter);
app.use('/api/ops/sanction', sanctionRouter);
app.use('/api/ops/disbursement', disbursementRouter);
app.use('/api/ops/collection', collectionRouter);
app.use('/api/ops/loans', opsSharedRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);
