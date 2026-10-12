import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if not supported
}

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}
