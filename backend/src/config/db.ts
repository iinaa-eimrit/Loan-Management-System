import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  // strictQuery: filters with unknown fields are dropped rather than silently
  // matching everything. Protects against typos like { stauts: 'APPLIED' }.
  mongoose.set('strictQuery', true);

  // mongoose.connect returns once the initial connection succeeds.
  // If it fails (wrong URI, Mongo down), it throws and server.ts exits.
  await mongoose.connect(env.MONGO_URI);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}
