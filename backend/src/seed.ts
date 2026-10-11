import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db';
import { User } from './models/User';
import type { Role } from './constants';

const ACCOUNTS: { name: string; email: string; password: string; role: Role }[] = [
  { name: 'Admin User', email: 'admin@lms.dev', password: 'Admin@123', role: 'admin' },
  { name: 'Sales Exec', email: 'sales@lms.dev', password: 'Sales@123', role: 'sales' },
  { name: 'Sanction Exec', email: 'sanction@lms.dev', password: 'Sanction@123', role: 'sanction' },
  { name: 'Disbursement Exec', email: 'disbursement@lms.dev', password: 'Disburse@123', role: 'disbursement' },
  { name: 'Collection Exec', email: 'collection@lms.dev', password: 'Collect@123', role: 'collection' },
  { name: 'Demo Borrower', email: 'borrower@lms.dev', password: 'Borrower@123', role: 'borrower' },
];

async function seed() {
  await connectDB();

  await mongoose.connection.syncIndexes();

  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    await User.updateOne(
      { email: acc.email },
      { $set: { name: acc.name, role: acc.role, passwordHash } },
      { upsert: true },
    );
    console.log(`  ✔ ${acc.role.padEnd(12)} ${acc.email} / ${acc.password}`);
  }

  console.log('Seed complete.');
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
