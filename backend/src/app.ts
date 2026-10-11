import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(express.json({ limit: '100kb' }));

app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes get mounted here in later phases

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);
