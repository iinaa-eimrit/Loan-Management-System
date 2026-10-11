import { Schema, model, type Types } from 'mongoose';
import { ROLES, EMPLOYMENT_MODES, type Role, type EmploymentMode } from '../constants';

export interface IBorrowerProfile {
  fullName: string;
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  verifiedAt: Date;
}

export interface IStoredFile {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  profile?: IBorrowerProfile;
  salarySlip?: IStoredFile;
  createdAt: Date;
  updatedAt: Date;
}

export const storedFileSchema = new Schema<IStoredFile>(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const profileSchema = new Schema<IBorrowerProfile>(
  {
    fullName: { type: String, required: true, trim: true },
    pan: { type: String, required: true, uppercase: true, trim: true },
    dob: { type: Date, required: true },
    monthlySalary: { type: Number, required: true, min: 0 },
    employmentMode: { type: String, enum: EMPLOYMENT_MODES, required: true },
    verifiedAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'borrower', index: true },
    profile: { type: profileSchema, default: undefined },
    salarySlip: { type: storedFileSchema, default: undefined },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);
