import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  MONGO_URI: required('MONGO_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN_SECONDS: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 24),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? 'uploads',
} as const;

export const isProd = env.NODE_ENV === 'production';
