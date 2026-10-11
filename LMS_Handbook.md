# Loan Management System — The End-to-End Builder's Handbook

> **Stack:** Next.js (App Router) + TypeScript + Tailwind · Node.js + Express 5 + TypeScript · MongoDB + Mongoose · JWT + bcrypt
>
> **How to use this handbook:** Work through the phases in order. Each phase has three parts:
> 1. **Concept** — what you're building and where it fits.
> 2. **Code** — complete files with heavy inline comments. Type them yourself instead of copy-pasting. You learn more that way.
> 3. **Why** — the design reasoning. An evaluator or interviewer will ask about this part.
>
> Every phase ends with a ✅ **Checkpoint**. Don't move on until it passes.

---

## Table of Contents

- [Phase 0 — The Mental Model (read before coding)](#phase-0)
- [Phase 1 — Project Setup](#phase-1)
- [Phase 2 — Backend Foundations (env, DB, app, errors)](#phase-2)
- [Phase 3 — Data Modelling (Mongoose schemas)](#phase-3)
- [Phase 4 — Authentication (signup, login, JWT, bcrypt)](#phase-4)
- [Phase 5 — RBAC Middleware](#phase-5)
- [Phase 6 — Domain Logic: BRE, Loan Math, State Machine](#phase-6)
- [Phase 7 — Borrower APIs (profile, upload, apply)](#phase-7)
- [Phase 8 — Operations APIs (sales, sanction, disbursement, collection)](#phase-8)
- [Phase 9 — Seed Script](#phase-9)
- [Phase 10 — Frontend Foundations (proxy, API client, auth context, route guard)](#phase-10)
- [Phase 11 — Auth Pages](#phase-11)
- [Phase 12 — Borrower Portal (multi-step wizard)](#phase-12)
- [Phase 13 — Operations Dashboard](#phase-13)
- [Phase 14 — End-to-End Testing & Video Script](#phase-14)
- [Phase 15 — README, Repo Hygiene, Submission](#phase-15)
- [Appendix A — Answers to the assignment's "Think about" questions](#appendix-a)
- [Appendix B — Common bugs and how to fix them](#appendix-b)
- [Appendix C — Interview / viva questions to prepare for](#appendix-c)

---

<a id="phase-0"></a>
## Phase 0 — The Mental Model

### 0.1 What the system actually is

Strip away the UI and the system is a **state machine over a Loan document**, plus a set of **people who may push it forward**:

```
                     (Sanction exec)               (Disbursement exec)        (Collection exec records
 Borrower clicks      approve                       mark disbursed             payments; system closes
 "Apply"            ┌──────────────► SANCTIONED ───────────────► DISBURSED ──── when fully repaid) ───► CLOSED
 ─────────► APPLIED ┤
                    └──────────────► REJECTED (with reason)
                     (Sanction exec) reject
```

Before a loan exists, the borrower is a **lead**. The Sales module tracks them: registered users who have not applied yet.

| Stage | Who acts | Module | Loan status read | Loan status written |
|---|---|---|---|---|
| Lead | Borrower (self) | Sales (read-only) | — (no loan yet) | — |
| Apply | Borrower | Borrower Portal | — | `APPLIED` |
| Review | Sanction exec | Sanction | `APPLIED` | `SANCTIONED` / `REJECTED` |
| Payout | Disbursement exec | Disbursement | `SANCTIONED` | `DISBURSED` |
| Repay | Collection exec | Collection | `DISBURSED` | `CLOSED` (automatic) |

The Admin role can do everything every executive can do.

### 0.2 Architecture

```
 Browser ──► Next.js (port 3000)
               │  • Pages (React, Tailwind)
               │  • middleware.ts  → UX route guard (redirects by role)
               │  • rewrites: /api/*  ──────────────┐
               │                                    ▼
               │                     Express API (port 4000)
               │                       • requireAuth  (JWT in httpOnly cookie)
               │                       • requireRole  (RBAC → 401/403)
               │                       • BRE, loan math, state machine
               │                       • multer → /uploads (salary slips)
               │                                    │
               │                                    ▼
               │                              MongoDB (users, loans, payments)
```

**The key decision is that Next.js proxies `/api/*` to Express.** From the browser's view, the frontend and the API share one origin (`localhost:3000`). That gives you:
- **No CORS setup.** The browser treats every request as same-origin.
- **httpOnly cookies just work.** The browser stores the cookie for `localhost:3000`, and the Next.js middleware can read it to guard pages.
- **Production parity.** You deploy the same way: one public domain, with the API behind it.

### 0.3 Final folder structure

```
lms/
├── README.md
├── .gitignore
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── uploads/                  # salary slips (git-ignored)
│   └── src/
│       ├── server.ts             # entry: connect DB → listen
│       ├── app.ts                # express app: middleware + routes
│       ├── seed.ts               # one account per role
│       ├── config/
│       │   ├── env.ts            # typed, validated env vars
│       │   └── db.ts             # mongoose connection
│       ├── constants.ts          # roles, statuses, employment modes
│       ├── types/express.d.ts    # adds req.user to Express types
│       ├── utils/
│       │   ├── HttpError.ts
│       │   └── tokens.ts         # sign/verify JWT, cookie options
│       ├── middleware/
│       │   ├── auth.ts           # requireAuth  → 401
│       │   ├── rbac.ts           # requireRole  → 403
│       │   ├── upload.ts         # multer config (type/size)
│       │   └── errorHandler.ts   # one place that formats errors
│       ├── models/
│       │   ├── User.ts
│       │   ├── Loan.ts
│       │   └── Payment.ts
│       ├── services/
│       │   ├── bre.ts            # Business Rule Engine (pure functions)
│       │   ├── loanMath.ts       # simple interest (pure functions)
│       │   └── loanStateMachine.ts
│       └── routes/
│           ├── auth.routes.ts
│           ├── borrower.routes.ts
│           └── ops/
│               ├── sales.routes.ts
│               ├── sanction.routes.ts
│               ├── disbursement.routes.ts
│               ├── collection.routes.ts
│               └── shared.routes.ts   # salary-slip viewing
└── frontend/
    ├── package.json
    ├── next.config.ts            # /api rewrite → backend
    ├── .env.example
    └── src/
        ├── middleware.ts         # page-level RBAC guard
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── globals.css
        │   ├── login/page.tsx
        │   ├── signup/page.tsx
        │   ├── apply/page.tsx
        │   └── dashboard/
        │       ├── layout.tsx
        │       ├── page.tsx
        │       ├── sales/page.tsx
        │       ├── sanction/page.tsx
        │       ├── disbursement/page.tsx
        │       └── collection/page.tsx
        ├── components/
        │   ├── ui.tsx            # Button, Card, Input, StatusBadge, Alert
        │   └── apply/
        │       ├── Stepper.tsx
        │       ├── PersonalDetailsStep.tsx
        │       ├── SalarySlipStep.tsx
        │       ├── LoanConfigStep.tsx
        │       └── LoanStatusCard.tsx
        ├── context/AuthContext.tsx
        ├── hooks/useFetch.ts
        └── lib/
            ├── api.ts
            ├── types.ts
            ├── roles.ts
            ├── bre.ts
            ├── loanMath.ts
            └── format.ts
```

**Why split by layer (routes / middleware / models / services)?** Each folder answers one question:
- `routes` answers "what does HTTP look like?"
- `middleware` answers "who is allowed in?"
- `models` answers "what does the data look like?"
- `services` answers "what are the business rules?"

Services hold pure functions, so you can unit-test the BRE and the interest math without starting a server. Evaluators grade "Code quality" partly on this separation.

### 0.4 The API contract (design this before coding)

| Method | Path | Roles | Purpose | Success | Notable errors |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | public | Create **borrower** account | 201 | 400 validation, 409 email exists |
| POST | `/api/auth/login` | public | Issue JWT cookie | 200 | 401 bad credentials |
| POST | `/api/auth/logout` | any | Clear cookie | 200 | — |
| GET | `/api/auth/me` | any logged-in | Current user | 200 | 401 |
| GET | `/api/borrower/me` | borrower | Profile + slip + loans | 200 | 401, 403 |
| PUT | `/api/borrower/profile` | borrower | Save details, **runs BRE** | 200 | 400, **422 BRE failed**, 409 active loan |
| POST | `/api/borrower/salary-slip` | borrower | Upload (multipart) | 201 | 400, 409 no profile, 413 too big, 415 bad type |
| POST | `/api/borrower/loans` | borrower | Apply | 201 | 400, 409 (missing step / active loan), 422 BRE |
| GET | `/api/ops/sales/leads` | admin, sales | Registered, not applied | 200 | 401, 403 |
| GET | `/api/ops/sanction/loans` | admin, sanction | `APPLIED` loans | 200 | 401, 403 |
| PATCH | `/api/ops/sanction/loans/:id/approve` | admin, sanction | → `SANCTIONED` | 200 | 404, 409 wrong state |
| PATCH | `/api/ops/sanction/loans/:id/reject` | admin, sanction | → `REJECTED` (reason) | 200 | 400 no reason, 404, 409 |
| GET | `/api/ops/disbursement/loans` | admin, disbursement | `SANCTIONED` loans | 200 | 401, 403 |
| PATCH | `/api/ops/disbursement/loans/:id/disburse` | admin, disbursement | → `DISBURSED` | 200 | 404, 409 |
| GET | `/api/ops/collection/loans` | admin, collection | `DISBURSED` loans | 200 | 401, 403 |
| GET | `/api/ops/collection/loans/:id/payments` | admin, collection | Payment history | 200 | 404 |
| POST | `/api/ops/collection/loans/:id/payments` | admin, collection | Record payment, maybe auto-close | 201 | 400 amount, 409 dup UTR / wrong state |
| GET | `/api/ops/loans/:id/salary-slip` | admin, sanction | View uploaded slip | 200 (file) | 404 |

**Error body shape everywhere:** `{ "message": string, "errors"?: unknown }`. The frontend can always show `message`, and it can show `errors` when they exist (BRE failures, field validation).

**Status code philosophy:**
- **400**: your input is malformed.
- **401**: we don't know who you are.
- **403**: we know who you are, and you're not allowed.
- **404**: the resource doesn't exist.
- **409**: the request conflicts with current state (duplicate UTR, loan not in the right status).
- **413**: the file is too large.
- **415**: the file type is wrong.
- **422**: the input is well-formed but fails business rules (BRE).

---

<a id="phase-1"></a>
## Phase 1 — Project Setup

### 1.1 Prerequisites

- **Node.js 20 LTS or newer** (`node -v`).
- **MongoDB 6.0 or newer**. Pick one:
  - **Atlas (recommended):** create a free cluster at mongodb.com/atlas, create a DB user, allow your IP, then copy the connection string.
  - **Docker:** `docker run -d --name lms-mongo -p 27017:27017 mongo:7`
- Git, plus a REST client (curl, Postman, or Thunder Client).

### 1.2 Scaffold the repo

```bash
mkdir lms && cd lms
git init

# ---------- backend ----------
mkdir -p backend/src && cd backend
npm init -y

# Runtime deps
npm i express@^5 mongoose@^8 jsonwebtoken bcryptjs cookie-parser multer@^2 zod@^3 dotenv helmet

# Dev deps: TypeScript, a fast TS runner (tsx), and type definitions
npm i -D typescript tsx @types/node @types/express @types/jsonwebtoken @types/cookie-parser @types/multer

cd ..

# ---------- frontend ----------
# Pinning to v15 keeps file names (middleware.ts) consistent with this handbook.
npx create-next-app@15 frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd frontend
npm i jose      # JWT verification that runs in Next.js middleware (Edge runtime)
cd ..
```

> **Why `bcryptjs` instead of `bcrypt`?** `bcrypt` is a native C++ addon, so it can fail to install on some machines or CI images. `bcryptjs` is pure JavaScript, uses the same algorithm and hash format, and installs everywhere. The trade-off is that it's slightly slower. That doesn't matter at this scale.
>
> **Why Express 5?** Express 5 forwards errors from `async` handlers to your error middleware automatically. In Express 4, an `await` that throws inside a route crashes or hangs the request unless you wrap every handler in a `try/catch` or an `asyncHandler` helper. That removes a lot of boilerplate.
>
> **Why `zod`?** TypeScript types disappear at runtime, so `req.body` is really `any`. Zod validates the data at runtime *and* infers the TypeScript type from the same schema. One source of truth covers both.

### 1.3 Backend `package.json` scripts and `tsconfig.json`

Edit `backend/package.json`. Add or replace the `scripts` block:

```jsonc
{
  "scripts": {
    // tsx runs TypeScript directly and restarts on file change. No build step in dev.
    "dev": "tsx watch src/server.ts",
    // tsc type-checks the whole project and emits JS into dist/
    "build": "tsc",
    // Production: run the compiled JS
    "start": "node dist/server.js",
    // Seed one account per role
    "seed": "tsx src/seed.ts",
    // Type-check only (great before committing)
    "typecheck": "tsc --noEmit"
  }
}
```

`backend/tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",            // modern JS output; Node 20 supports it natively
    "module": "commonjs",          // CommonJS avoids the ".js extension in imports" friction of ESM
    "rootDir": "src",              // source lives here
    "outDir": "dist",              // compiled output goes here
    "strict": true,                // turns on all strict type checks. Non-negotiable for "code quality"
    "esModuleInterop": true,       // lets us write `import express from 'express'`
    "skipLibCheck": true,          // don't type-check node_modules .d.ts files (faster, fewer false alarms)
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]               // includes src/types/express.d.ts so req.user is typed
}
```

### 1.4 Root `.gitignore`

```gitignore
node_modules/
dist/
.next/
.env
.env.local
backend/uploads/*
!backend/uploads/.gitkeep
*.log
.DS_Store
```

```bash
mkdir -p backend/uploads && touch backend/uploads/.gitkeep
```

✅ **Checkpoint:** `cd backend && npx tsc --version` prints a version, and `cd frontend && npm run dev` serves the Next.js starter page at http://localhost:3000.

---

<a id="phase-2"></a>
## Phase 2 — Backend Foundations

### 2.1 Environment config — `backend/src/config/env.ts`

```ts
// Load variables from backend/.env into process.env as early as possible.
// 'dotenv/config' is a side-effect import: just importing it runs dotenv.config().
import 'dotenv/config';

/**
 * Read a required env var or crash at startup.
 * Failing fast at boot beats failing on the first request at 2 a.m.
 * with "secretOrPrivateKey must have a value".
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// One typed object for all config. The rest of the code imports `env`
// and never touches process.env directly, which keeps config discoverable and typed.
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  MONGO_URI: required('MONGO_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  // A number of seconds (not a string like "1d"). Recent @types/jsonwebtoken
  // types `expiresIn` strictly, and a plain number avoids type friction.
  JWT_EXPIRES_IN_SECONDS: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 24),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? 'uploads',
} as const; // `as const` makes every property readonly

export const isProd = env.NODE_ENV === 'production';
```

`backend/.env.example` (commit this). Copy it to `.env` (never commit that one):

```bash
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/lms
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN_SECONDS=86400
UPLOAD_DIR=uploads
```

### 2.2 Database connection — `backend/src/config/db.ts`

```ts
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
```

### 2.3 Shared constants — `backend/src/constants.ts`

```ts
// `as const` turns these arrays into readonly tuples of literal types,
// so `typeof ROLES[number]` becomes the union 'admin' | 'sales' | ...
// Runtime values (for Mongoose enums and Zod) and compile-time types
// both come from one definition. They can never drift apart.

export const ROLES = ['admin', 'sales', 'sanction', 'disbursement', 'collection', 'borrower'] as const;
export type Role = (typeof ROLES)[number];

export const LOAN_STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

// A borrower can have at most one loan in these states at a time.
export const ACTIVE_LOAN_STATUSES: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED'];

export const EMPLOYMENT_MODES = ['SALARIED', 'SELF_EMPLOYED', 'UNEMPLOYED'] as const;
export type EmploymentMode = (typeof EMPLOYMENT_MODES)[number];

export const AUTH_COOKIE = 'lms_token';
```

### 2.4 A typed HTTP error — `backend/src/utils/HttpError.ts`

```ts
/**
 * Throw this anywhere (route, middleware, service) to produce a clean HTTP error.
 * The central error handler turns it into: res.status(status).json({ message, errors }).
 *
 * Why a custom class? Business code can say *what* went wrong
 * (`throw new HttpError(409, 'Duplicate UTR')`) without knowing *how* responses
 * are formatted. Formatting lives in exactly one place.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number, // `public readonly` in a constructor param = declare + assign
    message: string,
    public readonly details?: unknown, // optional structured info (e.g. list of BRE failures)
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
```

### 2.5 Central error handler — `backend/src/middleware/errorHandler.ts`

```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { HttpError } from '../utils/HttpError';

// MongoDB reports unique index violations with code 11000.
function isDuplicateKeyError(err: unknown): err is { code: number; keyValue: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Express identifies error middleware by its 4 parameters (err, req, res, next).
 * Every thrown error or rejected promise in any route ends up here.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // 1. Errors we threw on purpose.
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, errors: err.details });
    return;
  }

  // 2. Zod validation failures → 400 with a field-by-field list the UI can show.
  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
    return;
  }

  // 3. Multer (file upload) errors. File too large → 413 Payload Too Large.
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooBig ? 413 : 400).json({ message: tooBig ? 'File too large (max 5 MB)' : err.message });
    return;
  }

  // 4. Unique index violation (duplicate email, duplicate UTR, second active loan).
  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    res.status(409).json({ message: `Duplicate ${field}`, errors: err.keyValue });
    return;
  }

  // 5. Anything else is a bug. Log it server-side, but never leak stack traces to clients.
  console.error('[unhandled]', err);
  res.status(500).json({ message: 'Internal server error' });
};
```

### 2.6 Express app — `backend/src/app.ts` (first version; routes are added later)

```ts
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Hides the "X-Powered-By: Express" header (a minor fingerprinting reduction).
app.disable('x-powered-by');

// helmet sets sensible security headers (nosniff, frame options, etc.).
app.use(helmet());

// Parse JSON bodies. The small limit protects against huge payloads.
// File uploads don't go through this. Multer handles multipart separately.
app.use(express.json({ limit: '100kb' }));

// Parses the Cookie header into req.cookies, so we can read the JWT cookie.
app.use(cookieParser());

// A health check is handy for "is the API up?" and for deployment platforms.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Routes get mounted here in later phases ──

// Unknown routes → JSON 404 (instead of Express's default HTML page).
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Must be registered LAST so it catches errors from everything above.
app.use(errorHandler);
```

### 2.7 Entry point — `backend/src/server.ts`

```ts
import fs from 'node:fs';
import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function main() {
  // Ensure the uploads directory exists before multer tries to write to it.
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

  // Connect first and listen second. Otherwise we'd accept requests we can't serve.
  await connectDB();

  app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[fatal] failed to start', err);
  process.exit(1); // non-zero exit tells process managers (or you) that startup failed
});
```

### Why it's structured this way
- **`app.ts` vs `server.ts`:** `app` is a plain object you can import into tests (e.g. with supertest) without opening a port or a DB connection. `server.ts` is the only file with side effects.
- **One error handler:** Every route stays small. It throws, and the handler formats the response. Consistent error JSON makes the frontend simpler, because it has one parsing path.
- **Fail fast on missing env:** Misconfiguration is the most common "works on my machine" bug.

✅ **Checkpoint:** `npm run dev` logs `connected` and `listening`. `curl localhost:4000/api/health` returns `{"status":"ok"}`.

---

<a id="phase-3"></a>
## Phase 3 — Data Modelling

### 3.1 Which collections, and why?

| Collection | One document = | Key relations |
|---|---|---|
| `users` | Any person who logs in (borrower **or** staff) | — |
| `loans` | One loan application through its lifecycle | `borrower → users._id` |
| `payments` | One repayment transaction | `loan → loans._id`, `recordedBy → users._id` |

**Decisions you should be able to defend:**

1. **One `users` collection with a `role` field, not separate `borrowers` and `staff` collections.** Login, JWT, and middleware all work the same for everyone. RBAC becomes a simple check on one field.
2. **The borrower's personal details are an embedded sub-document (`user.profile`).** They're 1:1 with the user and always read together. Embedding avoids a join, which is the standard MongoDB rule: "embed what you read together".
3. **Payments live in their own collection, not as an array inside the loan.** You need a **globally unique** UTR index across *all* payments. MongoDB unique indexes can't enforce uniqueness across array elements of *different* documents in a way that also prevents duplicates within one array. A separate collection also avoids unbounded array growth.
4. **The loan stores a *snapshot* of the borrower's details and salary slip at apply time.** If the borrower edits their profile later, the sanction officer still sees exactly what was submitted. That's an audit requirement in lending.
5. **Money is stored as integer paise, not floating-point rupees.** `0.1 + 0.2 !== 0.3` in JavaScript. When you add many payments, floats drift, and "amount paid === total repayment" might never be exactly true, so the loan would never close. Integers are exact.
6. **`amountPaid` is denormalised onto the loan.** It's a running total. Outstanding balance becomes `totalRepayment - amountPaid` with no aggregation over payments. We update it atomically (Phase 8).
7. **`statusHistory` array:** an audit log of who moved the loan, when, and why. It's cheap to add and impressive in a demo.

### 3.2 `backend/src/models/User.ts`

```ts
import { Schema, model, type Types } from 'mongoose';
import { ROLES, EMPLOYMENT_MODES, type Role, type EmploymentMode } from '../constants';

// ---------- TypeScript interfaces (compile-time shape) ----------

export interface IBorrowerProfile {
  fullName: string;
  pan: string;               // stored upper-case, e.g. ABCPE1234F
  dob: Date;
  monthlySalary: number;     // in rupees. Only used for the BRE threshold, never for money math.
  employmentMode: EmploymentMode;
  verifiedAt: Date;          // when the BRE last passed
}

// Metadata about an uploaded file. The file itself lives on disk.
export interface IStoredFile {
  storedName: string;        // random name on disk (never trust the user's filename)
  originalName: string;      // shown in the UI
  mimeType: string;
  size: number;              // bytes
  uploadedAt: Date;
}

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  profile?: IBorrowerProfile;   // only borrowers have this, and only after step 2
  salarySlip?: IStoredFile;     // the "pending" slip before a loan is created
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Mongoose schemas (runtime shape + validation) ----------

// `_id: false` because these are value objects, not entities that need their own IDs.
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
    // unique: true creates a unique index. That's the real guarantee against
    // duplicate signups, even if two requests race.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false → never returned by queries unless explicitly requested
    // with .select('+passwordHash'). Prevents accidental leaks in API responses.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'borrower', index: true },
    profile: { type: profileSchema, default: undefined },
    salarySlip: { type: storedFileSchema, default: undefined },
  },
  { timestamps: true }, // auto-manages createdAt / updatedAt
);

export const User = model<IUser>('User', userSchema);
```

### 3.3 `backend/src/models/Loan.ts`

```ts
import { Schema, model, type Types } from 'mongoose';
import { LOAN_STATUSES, ACTIVE_LOAN_STATUSES, EMPLOYMENT_MODES, type LoanStatus, type EmploymentMode } from '../constants';
import { storedFileSchema, type IStoredFile } from './User';

export interface IStatusChange {
  from: LoanStatus | null;     // null for the initial "created as APPLIED"
  to: LoanStatus;
  by: Types.ObjectId;          // the user who caused it
  at: Date;
  note?: string;
}

export interface ILoan {
  _id: Types.ObjectId;
  borrower: Types.ObjectId;    // reference to users._id

  // Snapshot at apply time (see "Why" in 3.1, point 4)
  borrowerSnapshot: {
    fullName: string;
    pan: string;
    dob: Date;
    monthlySalary: number;
    employmentMode: EmploymentMode;
  };
  salarySlip: IStoredFile;

  // Money: ALL in integer paise
  principal: number;
  tenureDays: number;
  interestRate: number;        // % per annum. Stored so a future rate change doesn't rewrite history.
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;

  status: LoanStatus;
  rejectionReason?: string;
  sanctionedAt?: Date;
  disbursedAt?: Date;
  closedAt?: Date;
  statusHistory: IStatusChange[];

  createdAt: Date;
  updatedAt: Date;
}

const statusChangeSchema = new Schema<IStatusChange>(
  {
    from: { type: String, enum: [...LOAN_STATUSES, null], default: null },
    to: { type: String, enum: LOAN_STATUSES, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true, default: Date.now },
    note: String,
  },
  { _id: false },
);

const loanSchema = new Schema<ILoan>(
  {
    borrower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    borrowerSnapshot: {
      fullName: { type: String, required: true },
      pan: { type: String, required: true },
      dob: { type: Date, required: true },
      monthlySalary: { type: Number, required: true },
      employmentMode: { type: String, enum: EMPLOYMENT_MODES, required: true },
    },
    salarySlip: { type: storedFileSchema, required: true },
    principal: { type: Number, required: true, min: 0 },
    tenureDays: { type: Number, required: true, min: 1 },
    interestRate: { type: Number, required: true },
    simpleInterest: { type: Number, required: true, min: 0 },
    totalRepayment: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: LOAN_STATUSES, required: true, default: 'APPLIED', index: true },
    rejectionReason: String,
    sanctionedAt: Date,
    disbursedAt: Date,
    closedAt: Date,
    statusHistory: { type: [statusChangeSchema], default: [] },
  },
  { timestamps: true },
);

/**
 * PARTIAL UNIQUE INDEX: at most ONE active loan per borrower.
 * Uniqueness on `borrower` only applies to documents whose status is active.
 * Closed and rejected loans don't count, so the borrower can apply again later.
 * This is a DATABASE-level guarantee: even if a user double-clicks "Apply"
 * and two requests race past the application-level check, the second insert
 * fails with error 11000 → our handler returns 409.
 * (`$in` inside partialFilterExpression requires MongoDB 6.0+.)
 */
loanSchema.index(
  { borrower: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_LOAN_STATUSES } }, name: 'one_active_loan_per_borrower' },
);

export const Loan = model<ILoan>('Loan', loanSchema);
```

### 3.4 `backend/src/models/Payment.ts`

```ts
import { Schema, model, type Types } from 'mongoose';

export interface IPayment {
  _id: Types.ObjectId;
  loan: Types.ObjectId;
  utr: string;           // Unique Transaction Reference from the bank
  amount: number;        // paise
  paidOn: Date;          // the date the borrower paid (business date)
  recordedBy: Types.ObjectId;
  createdAt: Date;       // when the executive entered it (system date)
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    loan: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    // unique across ALL payments. The DB enforces it, so even concurrent
    // requests with the same UTR can't both succeed.
    utr: { type: String, required: true, unique: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    paidOn: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>('Payment', paymentSchema);
```

### Why: application checks vs database constraints
You will check things like "is this UTR already used?" in code, but **the unique index is the real guarantee**. Code checks are a *check-then-act* pattern. Two requests can both check "not used", and then both insert. Only the database can make "check and insert" atomic. Use code checks for friendly messages, and use constraints for correctness.

✅ **Checkpoint:** The project still compiles (`npm run typecheck`).

---

<a id="phase-4"></a>
## Phase 4 — Authentication

### 4.1 Concepts in 60 seconds
- **bcrypt** is a deliberately *slow* one-way hash with a built-in random *salt*. Slow means brute-forcing a leaked hash is expensive. The salt means two users with the password "Password1" get different hashes, which defeats rainbow tables. You never decrypt a hash. At login you hash the attempt and compare.
- **JWT** (JSON Web Token) has the form `header.payload.signature`. The server signs `{ sub: userId, role }` with a secret. Later it verifies the signature, and if anyone tampered with the payload, verification fails. JWTs are **signed, not encrypted**: anyone can read the payload, so never put secrets in it.
- **Where to store the JWT:** in an **httpOnly cookie**, not `localStorage`. JavaScript can't read httpOnly cookies, so an XSS bug can't steal the token. `SameSite=Lax` blocks the cookie on cross-site POSTs, which is the main CSRF vector.

### 4.2 Token helpers — `backend/src/utils/tokens.ts`

```ts
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env, isProd } from '../config/env';
import type { Role } from '../constants';

// What we put inside the JWT. Keep it minimal: an id and a role.
// `sub` ("subject") is the standard JWT claim name for "who this token is about".
export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',                      // HMAC-SHA256 with a shared secret
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,   // adds the `exp` claim; verify() rejects expired tokens
  });
}

export function verifyToken(token: string): TokenPayload {
  // Pin the algorithm. Never let the token's header choose it.
  // (This blocks classic "alg: none" style attacks.)
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
}

export const authCookieOptions: CookieOptions = {
  httpOnly: true,                 // JS can't read it → XSS can't steal it
  sameSite: 'lax',                // not sent on cross-site POST/fetch → CSRF protection
  secure: isProd,                 // HTTPS-only in production (localhost is plain HTTP)
  path: '/',
  maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000, // Express uses milliseconds here
};
```

### 4.3 Typing `req.user` — `backend/src/types/express.d.ts`

```ts
import type { Role } from '../constants';

// The minimal identity info we attach to each authenticated request.
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

// "Declaration merging": we add a field to Express's own Request interface,
// so `req.user` is typed in every handler without casting.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {}; // makes this file a module so `declare global` is allowed
```

### 4.4 Authentication middleware — `backend/src/middleware/auth.ts`

```ts
import type { RequestHandler } from 'express';
import { AUTH_COOKIE } from '../constants';
import { User } from '../models/User';
import { HttpError } from '../utils/HttpError';
import { verifyToken, type TokenPayload } from '../utils/tokens';

/**
 * requireAuth answers ONE question: "Who is making this request?"
 * - No token / bad token / expired token / deleted user → 401 Unauthorized
 * - Success → sets req.user and calls next()
 * It does NOT decide permissions. That's requireRole's job (single responsibility).
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  // 1. Prefer the httpOnly cookie (browser). Fall back to "Authorization: Bearer"
  //    so you can also test with Postman/curl without cookies.
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const token: string | undefined = req.cookies?.[AUTH_COOKIE] ?? bearer;

  if (!token) throw new HttpError(401, 'Not authenticated');

  // 2. Verify signature + expiry. jwt.verify throws on any problem.
  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Session expired or invalid. Please log in again.');
  }

  // 3. Load the user fresh from the DB. Why not just trust the token's role?
  //    - If an admin changes someone's role or deletes them, it takes effect immediately.
  //    - It's one indexed lookup by _id, which is very cheap.
  const user = await User.findById(payload.sub).select('name email role').lean();
  if (!user) throw new HttpError(401, 'User no longer exists');

  req.user = { id: String(user._id), role: user.role, name: user.name, email: user.email };
  next();
};
```

> Express 5 detail: because this middleware is `async`, a thrown `HttpError` becomes a rejected promise, and Express 5 routes it to `errorHandler` automatically.

### 4.5 Auth routes — `backend/src/routes/auth.routes.ts`

```ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { AUTH_COOKIE } from '../constants';
import { HttpError } from '../utils/HttpError';
import { signToken, authCookieOptions } from '../utils/tokens';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

// Cost factor 10 → ~2^10 hashing rounds. ~50–100 ms per hash: slow for attackers,
// imperceptible for users. Raise to 12 in production if your servers can afford it.
const BCRYPT_ROUNDS = 10;

// ---------- Validation schemas ----------
const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long'), // bcrypt only uses the first 72 bytes
  // NOTE: there is deliberately NO `role` field. See "Why" below.
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// Shape we return to clients: never includes passwordHash.
function publicUser(u: { _id: unknown; name: string; email: string; role: string }) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role };
}

// ---------- POST /api/auth/signup ----------
authRouter.post('/signup', async (req, res) => {
  const { name, email, password } = signupSchema.parse(req.body); // throws ZodError → 400

  // Friendly pre-check. The unique index is the real guarantee (race-safe).
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Public signup ALWAYS creates a borrower.
  const user = await User.create({ name, email, passwordHash, role: 'borrower' });

  // Log them in immediately: issue the cookie.
  res.cookie(AUTH_COOKIE, signToken({ sub: String(user._id), role: user.role }), authCookieOptions);
  res.status(201).json({ user: publicUser(user) });
});

// ---------- POST /api/auth/login ----------
authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  // passwordHash has select:false, so we must explicitly opt in.
  const user = await User.findOne({ email }).select('+passwordHash');

  // SAME error for "no such email" and "wrong password". Otherwise attackers can
  // enumerate which emails are registered.
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

  res.cookie(AUTH_COOKIE, signToken({ sub: String(user._id), role: user.role }), authCookieOptions);
  res.json({ user: publicUser(user) });
});

// ---------- POST /api/auth/logout ----------
authRouter.post('/logout', (_req, res) => {
  // clearCookie must use the same path/sameSite/secure options the cookie was set with.
  const { maxAge: _ignored, ...opts } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, opts);
  res.json({ ok: true });
});

// ---------- GET /api/auth/me ----------
// The frontend calls this on page load to learn "who am I?" from the cookie.
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

Mount it in `app.ts`, **above** the 404 handler:

```ts
import { authRouter } from './routes/auth.routes';
// ...
app.use('/api/auth', authRouter);
```

### Why
- **No `role` in the signup body:** If signup accepted `role`, anyone could `POST {"role":"admin"}` and become an admin. That's a *mass-assignment / privilege-escalation* bug, and evaluators look for it. Staff accounts come from the seed script, or from an admin-only endpoint in a real system.
- **Generic login error:** It prevents account enumeration.
- **Cookie + Bearer fallback:** Browsers use cookies, and your curl tests can use Bearer. One middleware handles both.
- **Revalidating the user on every request:** This trades one cheap DB read for immediate revocation. Pure stateless JWTs can't be revoked before they expire. That's a classic interview question.

✅ **Checkpoint:**
```bash
curl -i -c /tmp/c.txt -X POST localhost:4000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"t@test.com","password":"Passw0rd!"}'
# → 201 and a Set-Cookie: lms_token=...; HttpOnly
curl -b /tmp/c.txt localhost:4000/api/auth/me     # → {"user":{...,"role":"borrower"}}
curl localhost:4000/api/auth/me                    # → 401
```

---

<a id="phase-5"></a>
## Phase 5 — RBAC Middleware

### 5.1 `backend/src/middleware/rbac.ts`

```ts
import type { RequestHandler } from 'express';
import type { Role } from '../constants';
import { HttpError } from '../utils/HttpError';

/**
 * Factory: returns a middleware that only lets the listed roles through.
 *   router.use(requireAuth, requireRole('admin', 'sanction'))
 *
 * It must run AFTER requireAuth (it relies on req.user).
 * - No req.user  → 401 (defensive; means requireAuth was forgotten)
 * - Wrong role   → 403 Forbidden
 *
 * Admin is listed EXPLICITLY on each route rather than auto-allowed here.
 * That way borrower-only routes (e.g. "apply for a loan") don't accidentally
 * let admins create loans, and every route's permissions are readable in one line.
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Not authenticated');
    if (!allowed.includes(req.user.role)) {
      throw new HttpError(403, `Forbidden: requires role ${allowed.join(' or ')}`);
    }
    next();
  };
}
```

### Why
- **401 vs 403:** 401 means "authenticate first" (log in). 403 means "you're authenticated, but this isn't for you". The frontend reacts differently: on 401 it redirects to login, and on 403 it shows "access denied".
- **How roles are stored:** One string field on the user, validated by a Mongoose enum. Each user has exactly one role, so a single string is enough. A permissions table would be over-engineering for six fixed roles. If the evaluator asks how this would scale, the answer is to move to **permissions** (`loan:approve`) mapped to roles, and to check permissions instead of roles.
- **Guarding at the router level** (`router.use(requireAuth, requireRole(...))`) means a new endpoint added to the sanction router is protected by default. You can't forget it.

✅ **Checkpoint:** None yet. The routers that use it come next.

---

<a id="phase-6"></a>
## Phase 6 — Domain Logic: BRE, Loan Math, State Machine

These are **pure functions**: no Express, no DB (except the state machine). They're the heart of the "Correct BRE + loan math" score (15%).

### 6.1 Business Rule Engine — `backend/src/services/bre.ts`

```ts
import type { EmploymentMode } from '../constants';

/**
 * PAN (Permanent Account Number) format: 10 characters, AAAAA9999A
 *   chars 1–3 : letters (alphabetic series AAA–ZZZ)
 *   char 4    : holder type, one of
 *               P=Person, C=Company, H=HUF, F=Firm, A=AOP, T=Trust,
 *               B=BOI, L=Local authority, J=Artificial juridical person, G=Government
 *   char 5    : letter (first letter of surname/name)
 *   chars 6–9 : digits
 *   char 10   : letter (check character)
 *
 * The naive regex is /^[A-Z]{5}[0-9]{4}[A-Z]$/. Ours is stricter on char 4.
 * (A lender would likely require 'P' for individual borrowers. Mention that as a
 * possible extension, but don't over-restrict the assignment.)
 */
export const PAN_REGEX = /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/;

export const BRE_LIMITS = {
  minAge: 23,
  maxAge: 50,
  minMonthlySalary: 25_000,
} as const;

export interface BreInput {
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export type BreRule = 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';

export interface BreFailure {
  rule: BreRule;
  message: string;
}

/**
 * Completed years of age on `today`.
 * Naive `(today - dob) / 365` is WRONG around birthdays and leap years.
 * Correct approach: subtract years, then subtract 1 if this year's birthday
 * hasn't happened yet.
 * We use UTC getters because '1995-06-15' is parsed as UTC midnight. Local
 * getters on a server west of UTC would read it as June 14th.
 */
export function calculateAge(dob: Date, today: Date = new Date()): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  const birthdayNotYetThisYear =
    monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate());
  if (birthdayNotYetThisYear) age--;
  return age;
}

/**
 * Runs ALL rules and returns EVERY failure (not just the first).
 * The borrower sees everything wrong at once, instead of fixing one error,
 * resubmitting, and discovering the next.
 * Empty array = eligible.
 */
export function runBre(input: BreInput, today: Date = new Date()): BreFailure[] {
  const failures: BreFailure[] = [];

  const age = calculateAge(input.dob, today);
  // Assumption (state it in your README): "between 23 and 50" is INCLUSIVE.
  if (Number.isNaN(age) || age < BRE_LIMITS.minAge || age > BRE_LIMITS.maxAge) {
    failures.push({
      rule: 'AGE',
      message: `Applicant must be between ${BRE_LIMITS.minAge} and ${BRE_LIMITS.maxAge} years old (current age: ${Number.isNaN(age) ? 'invalid' : age}).`,
    });
  }

  if (input.monthlySalary < BRE_LIMITS.minMonthlySalary) {
    failures.push({
      rule: 'SALARY',
      message: `Monthly salary must be at least ₹${BRE_LIMITS.minMonthlySalary.toLocaleString('en-IN')}.`,
    });
  }

  if (!PAN_REGEX.test(input.pan.toUpperCase())) {
    failures.push({ rule: 'PAN', message: 'PAN must be in the valid format (e.g. ABCPE1234F).' });
  }

  if (input.employmentMode === 'UNEMPLOYED') {
    failures.push({ rule: 'EMPLOYMENT', message: 'Unemployed applicants are not eligible.' });
  }

  return failures;
}
```

### 6.2 Loan math — `backend/src/services/loanMath.ts`

```ts
export const INTEREST_RATE_PA = 12; // % per annum, fixed by the spec

export const LOAN_LIMITS = {
  minAmount: 50_000,   // ₹50K
  maxAmount: 500_000,  // ₹5L
  minTenureDays: 30,
  maxTenureDays: 365,
} as const;

export interface LoanQuote {
  principal: number;        // paise
  simpleInterest: number;   // paise
  totalRepayment: number;   // paise
}

/**
 * Simple Interest, per spec:  SI = (P × R × T) / (365 × 100), T in days.
 *
 * Steps:
 *  1. Convert rupees → paise (×100) so everything after is integer math.
 *  2. Compute SI in paise. The division can produce a fraction of a paisa,
 *     so we round ONCE, at the end, to the nearest paisa.
 *  3. Total = P + SI (both integers → exact).
 *
 * Example: P = ₹1,00,000, T = 180 days
 *   SI = 1,00,00,000 paise × 12 × 180 / 36,500 = 5,91,780.82 → 5,91,781 paise = ₹5,917.81
 *   Total = ₹1,05,917.81
 */
export function calculateLoan(principalRupees: number, tenureDays: number, ratePa: number = INTEREST_RATE_PA): LoanQuote {
  const principal = Math.round(principalRupees * 100);
  const simpleInterest = Math.round((principal * ratePa * tenureDays) / (365 * 100));
  return { principal, simpleInterest, totalRepayment: principal + simpleInterest };
}
```

### 6.3 Loan state machine — `backend/src/services/loanStateMachine.ts`

```ts
import { isValidObjectId, type UpdateQuery } from 'mongoose';
import type { LoanStatus } from '../constants';
import { Loan, type ILoan } from '../models/Loan';
import { HttpError } from '../utils/HttpError';

/**
 * The single source of truth for legal moves.
 * Anything not listed here is impossible. REJECTED and CLOSED are terminal.
 */
export const TRANSITIONS: Readonly<Record<LoanStatus, readonly LoanStatus[]>> = {
  APPLIED: ['SANCTIONED', 'REJECTED'],
  SANCTIONED: ['DISBURSED'],
  DISBURSED: ['CLOSED'],
  REJECTED: [],
  CLOSED: [],
};

interface TransitionArgs {
  loanId: string;
  from: LoanStatus;
  to: LoanStatus;
  actorId: string;
  note?: string;
  set?: Partial<Pick<ILoan, 'rejectionReason' | 'sanctionedAt' | 'disbursedAt' | 'closedAt'>>;
}

/**
 * Atomically moves a loan from `from` to `to`.
 *
 * The key trick: the FILTER includes `status: from`.
 *   findOneAndUpdate({ _id, status: 'APPLIED' }, { $set: { status: 'SANCTIONED' } })
 * MongoDB evaluates filter + update atomically on a single document. If two
 * executives click "Approve" and "Reject" at the same instant, only one
 * matches. The other gets null → 409 Conflict. No read-then-write race.
 */
export async function transitionLoan({ loanId, from, to, actorId, note, set = {} }: TransitionArgs) {
  // Programmer error guard: callers must only request legal moves.
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal transition coded: ${from} → ${to}`);
  }
  // A malformed id would make Mongoose throw a CastError (→ 500). Return 400 instead.
  if (!isValidObjectId(loanId)) throw new HttpError(400, 'Invalid loan id');

  const update: UpdateQuery<ILoan> = {
    $set: { status: to, ...set },
    $push: { statusHistory: { from, to, by: actorId, at: new Date(), note } },
  };

  const loan = await Loan.findOneAndUpdate({ _id: loanId, status: from }, update, { new: true });

  if (!loan) {
    // Tell the client WHY: missing loan (404) vs wrong state (409).
    const current = await Loan.findById(loanId).select('status').lean();
    if (!current) throw new HttpError(404, 'Loan not found');
    throw new HttpError(409, `Loan is ${current.status}; expected ${from}`);
  }
  return loan;
}
```

### Why
- **Should the BRE live on the client, the server, or both?** **Both, for different reasons.** The **server is the authority**, because anyone can bypass a browser with curl, so a client-only BRE is no BRE at all. The **client copy is a UX nicety**: instant feedback before the round-trip. If they ever disagree, the server wins. We also **re-run the BRE at apply time**, because a borrower who was 50 when they filled step 2 may have turned 51 by the time they click Apply.
- **Return all failures:** better UX, and easy to render as a list.
- **Integer paise and round once:** rounding intermediate values compounds error. Rounding once at the end matches what a calculator would show.
- **A transition table instead of if/else scattered across routes:** every allowed move is visible in five lines. You can answer "can a CLOSED loan be disbursed?" by reading one object. Atomic conditional updates make the state machine safe under concurrency.

✅ **Checkpoint (quick sanity script):** `npx tsx -e "import {calculateLoan} from './src/services/loanMath'; console.log(calculateLoan(100000,180))"` → `{ principal: 10000000, simpleInterest: 591781, totalRepayment: 10591781 }`

---

<a id="phase-7"></a>
## Phase 7 — Borrower APIs

### 7.1 Upload middleware — `backend/src/middleware/upload.ts`

```ts
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env';
import { HttpError } from '../utils/HttpError';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed MIME type → file extension we'll save with.
const ALLOWED: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: env.UPLOAD_DIR,
  // NEVER use the client's filename on disk. It could be "../../etc/passwd" or
  // collide with another user's file. A random UUID + a safe extension is unguessable and unique.
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype] ?? path.extname(file.originalname)}`);
  },
});

export const salarySlipUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }, // multer aborts with LIMIT_FILE_SIZE → 413
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in ALLOWED) return cb(null, true);
    cb(new HttpError(415, 'Only PDF, JPG or PNG files are allowed'));
  },
}).single('salarySlip'); // form field name the frontend must use
```

> **Security note for your README:** `file.mimetype` comes from the client and can be spoofed. A production system would also check the file's *magic bytes* (e.g. with the `file-type` package) and virus-scan it. Mentioning this shows maturity.

### 7.2 `backend/src/routes/borrower.routes.ts`

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { salarySlipUpload } from '../middleware/upload';
import { User, type IStoredFile } from '../models/User';
import { Loan } from '../models/Loan';
import { ACTIVE_LOAN_STATUSES, EMPLOYMENT_MODES } from '../constants';
import { runBre } from '../services/bre';
import { calculateLoan, INTEREST_RATE_PA, LOAN_LIMITS } from '../services/loanMath';
import { HttpError } from '../utils/HttpError';
import { env } from '../config/env';

export const borrowerRouter = Router();

// Every route in this file: must be logged in AND be a borrower.
borrowerRouter.use(requireAuth, requireRole('borrower'));

// Hide the on-disk filename from clients. It's an internal detail.
function publicFile(f?: IStoredFile | null) {
  return f ? { originalName: f.originalName, mimeType: f.mimeType, size: f.size, uploadedAt: f.uploadedAt } : null;
}

async function findActiveLoan(borrowerId: string) {
  return Loan.findOne({ borrower: borrowerId, status: { $in: ACTIVE_LOAN_STATUSES } }).select('_id status').lean();
}

// ---------- GET /api/borrower/me ----------
// Everything the wizard needs to know "which step am I on?" in one request.
borrowerRouter.get('/me', async (req, res) => {
  const user = await User.findById(req.user!.id).lean();
  if (!user) throw new HttpError(404, 'User not found');

  const loans = await Loan.find({ borrower: user._id })
    .select('-salarySlip.storedName -statusHistory')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    profile: user.profile ?? null,
    salarySlip: publicFile(user.salarySlip),
    activeLoan: loans.find((l) => ACTIVE_LOAN_STATUSES.includes(l.status)) ?? null,
    loans, // full history (including rejected/closed)
  });
});

// ---------- PUT /api/borrower/profile  (Step 2 + BRE) ----------
const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  pan: z.string().trim().toUpperCase().length(10, 'PAN must be 10 characters'),
  // z.coerce.date turns "1995-06-15" into a Date; invalid strings fail validation.
  dob: z.coerce.date({ invalid_type_error: 'Invalid date of birth' }),
  monthlySalary: z.coerce.number().nonnegative().max(100_000_000),
  employmentMode: z.enum(EMPLOYMENT_MODES),
});

borrowerRouter.put('/profile', async (req, res) => {
  const data = profileSchema.parse(req.body); // shape check → 400

  // Don't allow editing details mid-loan. The sanction team is reviewing them.
  if (await findActiveLoan(req.user!.id)) {
    throw new HttpError(409, 'You already have an active loan; details cannot be changed now');
  }

  // Business rules → 422 with the list of failed rules
  const failures = runBre(data);
  if (failures.length > 0) {
    throw new HttpError(422, 'You are not eligible for a loan', failures);
  }

  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $set: { profile: { ...data, verifiedAt: new Date() } } },
    { new: true, runValidators: true },
  ).lean();

  res.json({ profile: user!.profile });
});

// ---------- POST /api/borrower/salary-slip  (Step 3) ----------
borrowerRouter.post(
  '/salary-slip',
  // Guard BEFORE multer runs, so we don't write a file to disk for a user who can't use it.
  async (req, _res, next) => {
    const user = await User.findById(req.user!.id).select('profile').lean();
    if (!user?.profile) throw new HttpError(409, 'Complete personal details first');
    if (await findActiveLoan(req.user!.id)) throw new HttpError(409, 'You already have an active loan');
    next();
  },
  salarySlipUpload,
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name must be "salarySlip")');

    const file: IStoredFile = {
      storedName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    };

    // Replace any previous pending slip. Delete the old file so orphans don't pile up.
    const before = await User.findByIdAndUpdate(req.user!.id, { $set: { salarySlip: file } }).select('salarySlip').lean();
    if (before?.salarySlip) {
      await fs.unlink(path.join(env.UPLOAD_DIR, before.salarySlip.storedName)).catch(() => undefined);
    }

    res.status(201).json({ salarySlip: publicFile(file) });
  },
);

// ---------- POST /api/borrower/loans  (Step 4: Apply) ----------
const applySchema = z.object({
  amount: z.number().int().min(LOAN_LIMITS.minAmount).max(LOAN_LIMITS.maxAmount),
  tenureDays: z.number().int().min(LOAN_LIMITS.minTenureDays).max(LOAN_LIMITS.maxTenureDays),
});

borrowerRouter.post('/loans', async (req, res) => {
  const { amount, tenureDays } = applySchema.parse(req.body);

  const user = await User.findById(req.user!.id);
  if (!user) throw new HttpError(404, 'User not found');

  // Enforce the step order on the SERVER. The UI's stepper is not a security boundary.
  if (!user.profile) throw new HttpError(409, 'Complete personal details first');
  if (!user.salarySlip) throw new HttpError(409, 'Upload your salary slip first');
  if (await findActiveLoan(user.id)) throw new HttpError(409, 'You already have an active loan');

  // Re-run the BRE: age can change between step 2 and now (birthdays happen).
  const failures = runBre(user.profile);
  if (failures.length > 0) throw new HttpError(422, 'You are no longer eligible', failures);

  // The SERVER computes the money. Never trust totals sent by the client.
  const quote = calculateLoan(amount, tenureDays);

  const { fullName, pan, dob, monthlySalary, employmentMode } = user.profile;
  const loan = await Loan.create({
    borrower: user._id,
    borrowerSnapshot: { fullName, pan, dob, monthlySalary, employmentMode },
    salarySlip: user.salarySlip,
    ...quote,
    tenureDays,
    interestRate: INTEREST_RATE_PA,
    status: 'APPLIED',
    statusHistory: [{ from: null, to: 'APPLIED', by: user._id, at: new Date(), note: 'Application submitted' }],
  }); // a racing duplicate hits the partial unique index → 11000 → 409

  // The slip now belongs to the loan. Clear the "pending" slot so a future
  // application (after this loan closes) needs a fresh, current slip.
  user.salarySlip = undefined;
  await user.save();

  res.status(201).json({ loan });
});
```

Mount in `app.ts`:

```ts
import { borrowerRouter } from './routes/borrower.routes';
app.use('/api/borrower', borrowerRouter);
```

### Why
- **The wizard state lives on the server.** Each step persists immediately (profile → user doc, slip → user doc). If the borrower closes the tab after step 3, they resume at step 4 tomorrow. The frontend *derives* the current step from `/borrower/me`, so the server and UI can't disagree.
- **Step order enforced server-side:** a user could skip straight to `POST /loans` with curl. The checks make that impossible.
- **The server computes money:** if the client sent `totalRepayment`, a user could edit it. The client only sends *choices* (amount, tenure). The server derives everything else.
- **422 for BRE failures:** the request was valid JSON with valid types. It's the *business* that says no. This distinction helps the frontend: on 400, highlight fields; on 422, show the eligibility rejection panel.

✅ **Checkpoint:** Use the borrower cookie from Phase 4:
```bash
# BRE FAIL (age + salary + PAN + unemployed): expect 422 with 4 failures
curl -b /tmp/c.txt -X PUT localhost:4000/api/borrower/profile -H 'Content-Type: application/json' \
  -d '{"fullName":"T","pan":"BAD","dob":"2010-01-01","monthlySalary":1000,"employmentMode":"UNEMPLOYED"}'
# (note: fullName "T" fails Zod first → 400. Use a real name to see the 422)

# BRE PASS
curl -b /tmp/c.txt -X PUT localhost:4000/api/borrower/profile -H 'Content-Type: application/json' \
  -d '{"fullName":"Test User","pan":"ABCPE1234F","dob":"1995-06-15","monthlySalary":60000,"employmentMode":"SALARIED"}'

curl -b /tmp/c.txt -F "salarySlip=@/path/to/slip.pdf" localhost:4000/api/borrower/salary-slip
curl -b /tmp/c.txt -X POST localhost:4000/api/borrower/loans -H 'Content-Type: application/json' \
  -d '{"amount":100000,"tenureDays":180}'   # → 201, totalRepayment 10591781
```

---

<a id="phase-8"></a>
## Phase 8 — Operations APIs

### 8.1 Sales — `backend/src/routes/ops/sales.routes.ts`

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { User } from '../../models/User';

export const salesRouter = Router();
salesRouter.use(requireAuth, requireRole('admin', 'sales'));

/**
 * GET /api/ops/sales/leads
 * Leads = borrowers who registered but have NEVER created a loan.
 * We also show how far they got (profile done? slip uploaded?), so sales can
 * prioritise follow-ups: someone with a slip uploaded is one click from applying.
 *
 * Aggregation pipeline, stage by stage:
 *  $match   → only borrowers
 *  $lookup  → "left join" loans where loans.borrower == users._id (limit 1, we only need existence)
 *  $match   → keep users whose joined array is empty (no loans)
 *  $project → shape the output; never expose passwordHash
 */
salesRouter.get('/leads', async (_req, res) => {
  const leads = await User.aggregate([
    { $match: { role: 'borrower' } },
    {
      $lookup: {
        from: 'loans',
        let: { uid: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$borrower', '$$uid'] } } }, { $limit: 1 }, { $project: { _id: 1 } }],
        as: 'loans',
      },
    },
    { $match: { loans: { $size: 0 } } },
    {
      $project: {
        name: 1,
        email: 1,
        createdAt: 1,
        fullName: '$profile.fullName',
        monthlySalary: '$profile.monthlySalary',
        // $type returns 'missing' when the field doesn't exist
        profileCompleted: { $ne: [{ $type: '$profile' }, 'missing'] },
        salarySlipUploaded: { $ne: [{ $type: '$salarySlip' }, 'missing'] },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  res.json({ leads });
});
```

### 8.2 Sanction — `backend/src/routes/ops/sanction.routes.ts`

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { transitionLoan } from '../../services/loanStateMachine';

export const sanctionRouter = Router();
sanctionRouter.use(requireAuth, requireRole('admin', 'sanction'));

// GET /api/ops/sanction/loans → queue of APPLIED loans, oldest first (FIFO fairness)
sanctionRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'APPLIED' })
    .populate('borrower', 'name email') // replace the ObjectId with { _id, name, email }
    .select('-salarySlip.storedName')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ loans });
});

// PATCH /api/ops/sanction/loans/:id/approve   APPLIED → SANCTIONED
sanctionRouter.patch('/loans/:id/approve', async (req, res) => {
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'APPLIED',
    to: 'SANCTIONED',
    actorId: req.user!.id,
    set: { sanctionedAt: new Date() },
    note: 'Approved',
  });
  res.json({ loan });
});

// PATCH /api/ops/sanction/loans/:id/reject   APPLIED → REJECTED (reason required)
const rejectSchema = z.object({ reason: z.string().trim().min(5, 'Please give a reason (min 5 chars)').max(500) });

sanctionRouter.patch('/loans/:id/reject', async (req, res) => {
  const { reason } = rejectSchema.parse(req.body);
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'APPLIED',
    to: 'REJECTED',
    actorId: req.user!.id,
    set: { rejectionReason: reason },
    note: reason,
  });
  res.json({ loan });
});
```

> **PATCH vs POST for actions:** PATCH means "partially modify this resource", and that's what approving does (it changes `status`). Some teams prefer `POST /loans/:id/approve` because it's a command, not a field edit. Either is defensible. Consistency matters more.

### 8.3 Disbursement — `backend/src/routes/ops/disbursement.routes.ts`

```ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { transitionLoan } from '../../services/loanStateMachine';

export const disbursementRouter = Router();
disbursementRouter.use(requireAuth, requireRole('admin', 'disbursement'));

disbursementRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'SANCTIONED' })
    .populate('borrower', 'name email')
    .select('-salarySlip.storedName')
    .sort({ sanctionedAt: 1 })
    .lean();
  res.json({ loans });
});

// SANCTIONED → DISBURSED. After this, the loan shows up in Collection.
disbursementRouter.patch('/loans/:id/disburse', async (req, res) => {
  const loan = await transitionLoan({
    loanId: req.params.id,
    from: 'SANCTIONED',
    to: 'DISBURSED',
    actorId: req.user!.id,
    set: { disbursedAt: new Date() },
    note: 'Funds released',
  });
  res.json({ loan });
});
```

### 8.4 Collection — `backend/src/routes/ops/collection.routes.ts` (the trickiest part)

```ts
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { Payment } from '../../models/Payment';
import { transitionLoan } from '../../services/loanStateMachine';
import { HttpError } from '../../utils/HttpError';

export const collectionRouter = Router();
collectionRouter.use(requireAuth, requireRole('admin', 'collection'));

function assertId(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(400, 'Invalid loan id');
}

// Start of the given day in UTC. Used for date-only comparisons.
function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// GET /api/ops/collection/loans → active (DISBURSED) loans with outstanding balance
collectionRouter.get('/loans', async (_req, res) => {
  const loans = await Loan.find({ status: 'DISBURSED' })
    .populate('borrower', 'name email')
    .select('-salarySlip.storedName')
    .sort({ disbursedAt: 1 })
    .lean();
  // Compute outstanding here so the UI doesn't need to.
  res.json({ loans: loans.map((l) => ({ ...l, outstanding: l.totalRepayment - l.amountPaid })) });
});

// GET /api/ops/collection/loans/:id/payments → payment history
collectionRouter.get('/loans/:id/payments', async (req, res) => {
  assertId(req.params.id);
  if (!(await Loan.exists({ _id: req.params.id }))) throw new HttpError(404, 'Loan not found');
  const payments = await Payment.find({ loan: req.params.id })
    .populate('recordedBy', 'name')
    .sort({ paidOn: -1, createdAt: -1 })
    .lean();
  res.json({ payments });
});

// POST /api/ops/collection/loans/:id/payments → record a payment
const paymentSchema = z.object({
  // UTR formats: IMPS 12 digits, NEFT 16 alphanumerics, RTGS 22 alphanumerics.
  // We accept 12–22 uppercase alphanumerics.
  utr: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{12,22}$/, 'UTR must be 12–22 letters/digits'),
  // Rupees with up to 2 decimals. z.coerce lets the form send "1500.50".
  amount: z.coerce.number().positive('Amount must be greater than 0')
    // n*100 should be a whole number of paise (tolerance absorbs float noise like 0.1*100)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Max 2 decimal places'),
  paidOn: z.coerce.date(),
});

collectionRouter.post('/loans/:id/payments', async (req, res) => {
  const loanId = req.params.id;
  assertId(loanId);
  const body = paymentSchema.parse(req.body);
  const amount = Math.round(body.amount * 100); // → paise

  // ---------- 1. Validate against current loan state (friendly errors) ----------
  const loan = await Loan.findById(loanId);
  if (!loan) throw new HttpError(404, 'Loan not found');
  if (loan.status !== 'DISBURSED') throw new HttpError(409, `Payments can only be recorded on DISBURSED loans (this one is ${loan.status})`);

  const outstanding = loan.totalRepayment - loan.amountPaid;
  if (amount > outstanding) {
    throw new HttpError(400, `Amount exceeds outstanding balance of ₹${(outstanding / 100).toFixed(2)}`);
  }
  if (body.paidOn > new Date()) throw new HttpError(400, 'Payment date cannot be in the future');
  if (loan.disbursedAt && body.paidOn < startOfUtcDay(loan.disbursedAt)) {
    throw new HttpError(400, 'Payment date cannot be before the disbursement date');
  }

  // ---------- 2. Insert the payment (unique UTR index guards duplicates → 409) ----------
  const payment = await Payment.create({
    loan: loan._id,
    utr: body.utr,
    amount,
    paidOn: body.paidOn,
    recordedBy: req.user!.id,
  });

  // ---------- 3. Atomically add to amountPaid, ONLY if it won't overpay ----------
  // $expr lets the filter compare fields: (amountPaid + amount) <= totalRepayment.
  // If another payment landed between step 1 and now, this filter fails safely.
  const updated = await Loan.findOneAndUpdate(
    {
      _id: loan._id,
      status: 'DISBURSED',
      $expr: { $lte: [{ $add: ['$amountPaid', amount] }, '$totalRepayment'] },
    },
    { $inc: { amountPaid: amount } },
    { new: true },
  );

  if (!updated) {
    // Compensate: undo the payment insert so the books stay consistent.
    await Payment.deleteOne({ _id: payment._id });
    throw new HttpError(409, 'Loan balance changed while recording; payment would exceed outstanding. Refresh and retry.');
  }

  // ---------- 4. Auto-close when fully repaid ----------
  let finalLoan = updated;
  if (updated.amountPaid === updated.totalRepayment) {
    // Exact equality is safe because everything is integer paise.
    finalLoan = await transitionLoan({
      loanId: String(updated._id),
      from: 'DISBURSED',
      to: 'CLOSED',
      actorId: req.user!.id,
      set: { closedAt: new Date() },
      note: 'Auto-closed: fully repaid',
    });
  }

  res.status(201).json({
    payment,
    loan: finalLoan,
    outstanding: finalLoan.totalRepayment - finalLoan.amountPaid,
    closed: finalLoan.status === 'CLOSED',
  });
});
```

### 8.5 Shared: viewing the salary slip — `backend/src/routes/ops/shared.routes.ts`

```ts
import path from 'node:path';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { Loan } from '../../models/Loan';
import { HttpError } from '../../utils/HttpError';
import { env } from '../../config/env';

export const opsSharedRouter = Router();
// Only the people who need to review documents can download them (least privilege).
opsSharedRouter.use(requireAuth, requireRole('admin', 'sanction'));

opsSharedRouter.get('/:id/salary-slip', async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid loan id');
  const loan = await Loan.findById(req.params.id).select('salarySlip').lean();
  if (!loan?.salarySlip) throw new HttpError(404, 'Salary slip not found');

  // path.basename strips any directory parts. A second guard against path traversal.
  const filePath = path.resolve(env.UPLOAD_DIR, path.basename(loan.salarySlip.storedName));
  res.setHeader('Content-Type', loan.salarySlip.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(loan.salarySlip.originalName)}"`);
  res.sendFile(filePath);
});
```

### 8.6 Final `app.ts` route section

```ts
import { authRouter } from './routes/auth.routes';
import { borrowerRouter } from './routes/borrower.routes';
import { salesRouter } from './routes/ops/sales.routes';
import { sanctionRouter } from './routes/ops/sanction.routes';
import { disbursementRouter } from './routes/ops/disbursement.routes';
import { collectionRouter } from './routes/ops/collection.routes';
import { opsSharedRouter } from './routes/ops/shared.routes';

// ... after cookieParser and health:
app.use('/api/auth', authRouter);
app.use('/api/borrower', borrowerRouter);
app.use('/api/ops/sales', salesRouter);
app.use('/api/ops/sanction', sanctionRouter);
app.use('/api/ops/disbursement', disbursementRouter);
app.use('/api/ops/collection', collectionRouter);
app.use('/api/ops/loans', opsSharedRouter);
// ... then the 404 handler, then errorHandler
```

### Why: the payment algorithm
The assignment asks *"how do you track outstanding balance? what validations on amount?"*

- **Tracking:** `amountPaid` is a running total on the loan, and `outstanding = totalRepayment − amountPaid`. Payments are the detailed ledger. `amountPaid` is a cached sum that we keep correct with atomic `$inc`.
- **Validations:**
  - amount > 0
  - at most 2 decimals
  - amount ≤ outstanding (no overpayment)
  - the loan must be `DISBURSED`
  - UTR has a valid format and is globally unique
  - date not in the future and not before disbursement
- **Concurrency:** two executives could record payments for the same loan at the same moment. The `$expr` conditional `$inc` guarantees the total never exceeds the repayment. If it would, we roll back the inserted payment (a *compensating action*).
- **Production-grade alternative:** a **MongoDB multi-document transaction** (`session.withTransaction(...)`) wraps the insert and the update into all-or-nothing. It requires a replica set. Atlas always has one, but a plain local `mongod` doesn't. We chose the compensating approach so the project runs anywhere. Mention that you know transactions exist.
- **Partial payments are allowed.** The loan only closes when the cumulative total hits exactly the total repayment. Because of the "≤ outstanding" rule, the last payment must be the exact remainder, and the UI pre-fills it.

✅ **Checkpoint:** Phase 14 runs a full curl walkthrough. For now: `npm run typecheck` passes.

---

<a id="phase-9"></a>
## Phase 9 — Seed Script

`backend/src/seed.ts`:

```ts
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db';
import { User } from './models/User';
import type { Role } from './constants';

// Known credentials for the evaluator. Also listed in the README.
const ACCOUNTS: { name: string; email: string; password: string; role: Role }[] = [
  { name: 'Admin User',        email: 'admin@lms.dev',        password: 'Admin@123',        role: 'admin' },
  { name: 'Sales Exec',        email: 'sales@lms.dev',        password: 'Sales@123',        role: 'sales' },
  { name: 'Sanction Exec',     email: 'sanction@lms.dev',     password: 'Sanction@123',     role: 'sanction' },
  { name: 'Disbursement Exec', email: 'disbursement@lms.dev', password: 'Disburse@123',     role: 'disbursement' },
  { name: 'Collection Exec',   email: 'collection@lms.dev',   password: 'Collect@123',      role: 'collection' },
  { name: 'Demo Borrower',     email: 'borrower@lms.dev',     password: 'Borrower@123',     role: 'borrower' },
];

async function seed() {
  await connectDB();

  // Make sure indexes (unique email/UTR, partial active-loan) exist before the app is used.
  await mongoose.connection.syncIndexes();

  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    // UPSERT = update if exists, insert if not. That makes the script IDEMPOTENT:
    // running it twice doesn't create duplicates or crash on the unique email index.
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
  .finally(() => mongoose.disconnect()); // close the connection so the process exits
```

**Why idempotent?** Evaluators run `npm run seed` more than once. A script that crashes the second time ("duplicate key") looks broken.

✅ **Checkpoint:** `npm run seed` prints six accounts. `curl -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@lms.dev","password":"Admin@123"}'` returns 200.

---

<a id="phase-10"></a>
## Phase 10 — Frontend Foundations

### 10.1 Proxy `/api` to Express — `frontend/next.config.ts`

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every request to http://localhost:3000/api/... is forwarded server-side
  // to the Express API. The browser only ever talks to ONE origin.
  // Result: no CORS, and the httpOnly cookie is first-party to the frontend.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

`frontend/.env.example` (copy to `.env.local`):

```bash
# Where Next.js forwards /api/* requests (server-side only)
BACKEND_URL=http://localhost:4000
# MUST equal backend JWT_SECRET. Used by middleware.ts to verify the cookie for page routing.
# No NEXT_PUBLIC_ prefix → never shipped to the browser.
JWT_SECRET=replace-with-the-same-secret-as-backend
```

### 10.2 Shared types — `frontend/src/lib/types.ts`

```ts
// Mirrors the backend's constants. In a monorepo you'd share one package.
// Here we duplicate deliberately: two small apps, no build tooling needed.
export type Role = 'admin' | 'sales' | 'sanction' | 'disbursement' | 'collection' | 'borrower';
export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';
export type EmploymentMode = 'SALARIED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface BorrowerProfile {
  fullName: string;
  pan: string;
  dob: string;            // JSON turns Dates into ISO strings
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

export interface FileInfo {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface Loan {
  _id: string;
  borrower: string | { _id: string; name: string; email: string }; // populated or not
  borrowerSnapshot: BorrowerProfile;
  principal: number;      // paise
  tenureDays: number;
  interestRate: number;
  simpleInterest: number; // paise
  totalRepayment: number; // paise
  amountPaid: number;     // paise
  outstanding?: number;   // paise (collection list only)
  status: LoanStatus;
  rejectionReason?: string;
  createdAt: string;
  sanctionedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
}

export interface Payment {
  _id: string;
  utr: string;
  amount: number;         // paise
  paidOn: string;
  recordedBy: { _id: string; name: string } | string;
  createdAt: string;
}

export interface BreFailure {
  rule: 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';
  message: string;
}
```

### 10.3 API client — `frontend/src/lib/api.ts`

```ts
/**
 * A typed error carrying the HTTP status and the backend's `errors` payload,
 * so components can branch: 422 → show BRE failures, 401 → go to login, etc.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: unknown,
  ) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;          // sent as application/json
  formData?: FormData;     // sent as multipart/form-data (file upload)
};

/**
 * One function for all API calls.
 * - Relative URL '/api/...': same origin, goes through the Next.js rewrite.
 * - Cookies are sent automatically for same-origin requests.
 * - Always parses JSON and throws ApiError on non-2xx.
 */
export async function api<T>(path: string, { method = 'GET', json, formData }: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    // For FormData, do NOT set Content-Type. The browser adds the multipart
    // boundary itself. Setting it manually breaks uploads.
    headers: json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: formData ?? (json !== undefined ? JSON.stringify(json) : undefined),
    cache: 'no-store', // dashboard data must always be fresh
  });

  const data = await res.json().catch(() => ({})); // tolerate empty bodies
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Request failed', data.errors);
  return data as T;
}
```

### 10.4 Roles → modules — `frontend/src/lib/roles.ts`

```ts
import type { Role } from './types';

export type ModuleKey = 'sales' | 'sanction' | 'disbursement' | 'collection';

/**
 * The FRONTEND copy of the access matrix. It drives:
 *   - which sidebar links appear
 *   - which /dashboard/* URLs middleware.ts allows
 * It must match the backend's requireRole(...) calls. The backend is the real
 * enforcement. This copy is for UX (don't show buttons that would 403).
 */
export const MODULES: { key: ModuleKey; label: string; href: string; roles: Role[] }[] = [
  { key: 'sales', label: 'Sales', href: '/dashboard/sales', roles: ['admin', 'sales'] },
  { key: 'sanction', label: 'Sanction', href: '/dashboard/sanction', roles: ['admin', 'sanction'] },
  { key: 'disbursement', label: 'Disbursement', href: '/dashboard/disbursement', roles: ['admin', 'disbursement'] },
  { key: 'collection', label: 'Collection', href: '/dashboard/collection', roles: ['admin', 'collection'] },
];

export function canAccessModule(role: Role, key: string): boolean {
  return MODULES.some((m) => m.key === key && m.roles.includes(role));
}

/** Where each role lands after login. */
export function homeFor(role: Role): string {
  if (role === 'borrower') return '/apply';
  if (role === 'admin') return '/dashboard/sales';
  return `/dashboard/${role}`; // sales/sanction/disbursement/collection match module keys
}
```

### 10.5 Client-side copies of the BRE and math — `frontend/src/lib/bre.ts`, `loanMath.ts`, `format.ts`

```ts
// ---------- src/lib/bre.ts ----------
// Instant-feedback copy of the server BRE. The SERVER is authoritative.
import type { EmploymentMode, BreFailure } from './types';

export const PAN_REGEX = /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/;

export function calculateAge(dobIso: string, today = new Date()): number {
  const dob = new Date(dobIso); // 'YYYY-MM-DD' → UTC midnight
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function previewBre(p: { pan: string; dob: string; monthlySalary: number; employmentMode: EmploymentMode }): BreFailure[] {
  const out: BreFailure[] = [];
  if (p.dob) {
    const age = calculateAge(p.dob);
    if (age < 23 || age > 50) out.push({ rule: 'AGE', message: `Age must be 23–50 (yours: ${age})` });
  }
  if (p.monthlySalary && p.monthlySalary < 25000) out.push({ rule: 'SALARY', message: 'Salary must be at least ₹25,000/month' });
  if (p.pan && !PAN_REGEX.test(p.pan.toUpperCase())) out.push({ rule: 'PAN', message: 'PAN format looks invalid (e.g. ABCPE1234F)' });
  if (p.employmentMode === 'UNEMPLOYED') out.push({ rule: 'EMPLOYMENT', message: 'Unemployed applicants are not eligible' });
  return out;
}
```

```ts
// ---------- src/lib/loanMath.ts ----------
// Identical formula to the backend, used for the LIVE calculation panel.
// The server recomputes on submit, so this can never be used to cheat.
export const INTEREST_RATE_PA = 12;
export const LIMITS = { minAmount: 50_000, maxAmount: 500_000, amountStep: 5_000, minTenure: 30, maxTenure: 365 };

export function calculateLoan(principalRupees: number, tenureDays: number) {
  const principal = Math.round(principalRupees * 100);
  const simpleInterest = Math.round((principal * INTEREST_RATE_PA * tenureDays) / (365 * 100));
  return { principal, simpleInterest, totalRepayment: principal + simpleInterest }; // paise
}
```

```ts
// ---------- src/lib/format.ts ----------
// Intl is built into JS. 'en-IN' gives lakh/crore grouping: ₹1,05,917.81
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export const formatPaise = (paise: number) => inr.format(paise / 100);
export const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
```

### 10.6 Auth context — `frontend/src/context/AuthContext.tsx`

```tsx
'use client'; // Context + hooks only work in Client Components

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { homeFor } from '@/lib/roles';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean; // true until we know whether a session exists
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On first load, ask the server "who am I?". The cookie is httpOnly, so
  // JS can't read it. The only way to know is to ask the API.
  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // useCallback keeps function identities stable across renders,
  // so consumers' effects that depend on them don't re-run needlessly.
  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/login', { method: 'POST', json: { email, password } });
    setUser(user);
    router.replace(homeFor(user.role)); // replace: back button shouldn't return to /login
    router.refresh(); // re-run middleware/server components with the new cookie
  }, [router]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api<{ user: User }>('/auth/signup', { method: 'POST', json: { name, email, password } });
    setUser(user);
    router.replace('/apply');
    router.refresh();
  }, [router]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    router.replace('/login');
    router.refresh();
  }, [router]);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

### 10.7 Data-fetching hook — `frontend/src/hooks/useFetch.ts`

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Tiny hook: GET `path` on mount, expose { data, error, loading, reload }.
 * `reload()` is called after a mutation (approve, disburse, pay) to refresh the list.
 * (In a bigger app you'd use TanStack Query/SWR for caching and dedupe.
 * Here, a 20-line hook is easier to explain and has zero dependencies.)
 */
export function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
```

### 10.8 Page-level route guard — `frontend/src/middleware.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { canAccessModule, homeFor } from '@/lib/roles';
import type { Role } from '@/lib/types';

// Middleware runs on the Edge runtime BEFORE a page renders.
// `jsonwebtoken` needs Node APIs and doesn't run there; `jose` is Web-Crypto based and does.
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getRole(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get('lms_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return (payload.role as Role) ?? null;
  } catch {
    return null; // expired/tampered → treat as logged out
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await getRole(req);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));

  // Login/signup pages: if already logged in, send them home.
  if (pathname === '/login' || pathname === '/signup') {
    return role ? redirect(homeFor(role)) : NextResponse.next();
  }

  // Everything else matched below requires a session.
  if (!role) return redirect('/login');

  if (pathname === '/') return redirect(homeFor(role));

  // Borrower portal: borrowers only.
  if (pathname.startsWith('/apply') && role !== 'borrower') return redirect(homeFor(role));

  // Dashboard: never borrowers. Executives only their own module.
  if (pathname.startsWith('/dashboard')) {
    if (role === 'borrower') return redirect('/apply');
    const moduleKey = pathname.split('/')[2]; // '/dashboard/sanction' → 'sanction'
    if (!moduleKey || !canAccessModule(role, moduleKey)) return redirect(homeFor(role));
  }

  return NextResponse.next();
}

// Only run on page routes. NOT on /api (Express handles its own auth) or static assets.
export const config = {
  matcher: ['/', '/login', '/signup', '/apply/:path*', '/dashboard/:path*'],
};
```

### Why
- **Defense in depth, two layers:**
  1. `middleware.ts` stops a sanction exec from even *rendering* `/dashboard/collection`. They get redirected, so there's no flash of forbidden UI.
  2. Express `requireRole` stops the *data*. Even if someone bypasses the frontend entirely with curl, they get a 403.

  The assignment says hiding a menu item is not enough. This is how you prove you understood that.
- **Why verify the JWT in middleware instead of just checking that the cookie exists?** Without verification, anyone could hand-craft a cookie with `role: admin` and see the admin UI shell. They still couldn't get data, but verifying with the shared secret closes even that.
- **Why React Context rather than Redux/Zustand?** The only global state is "who is logged in", and it changes rarely (login/logout). Context is built in and perfect for low-frequency global values. Page data (loans, payments) is *server state*: it's fetched per page and refreshed after mutations, so it lives in the page via `useFetch`. Mixing server state into a global store is a common anti-pattern.
- **Why Client Components for pages?** Dashboards are interactive: buttons, forms, sliders, refresh after actions. Server Components could fetch the initial lists, but they would need to forward the cookie to Express. Client fetching through the proxy is simpler, and simpler is the right call for an assignment.

---

<a id="phase-11"></a>
## Phase 11 — Auth Pages

### 11.1 Small UI kit — `frontend/src/components/ui.tsx`

```tsx
// A handful of styled primitives so every page looks consistent.
// Tailwind utility classes live here once instead of being copy-pasted everywhere.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { LoanStatus } from '@/lib/types';

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  }[variant];
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-rose-500' : 'border-slate-300'}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  }[kind];
  return <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

const STATUS_STYLES: Record<LoanStatus, string> = {
  APPLIED: 'bg-sky-100 text-sky-800',
  SANCTIONED: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  DISBURSED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-emerald-100 text-emerald-800',
};

export function StatusBadge({ status }: { status: LoanStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{status}</span>;
}
```

### 11.2 Root layout — `frontend/src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = { title: 'LMS — Loan Management System' };

// The root layout is a Server Component. It can still RENDER a Client
// Component (AuthProvider). Everything inside gets access to useAuth().
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

`frontend/src/app/globals.css`: replace its contents with just this (Tailwind v4 syntax):

```css
@import "tailwindcss";
```

`frontend/src/app/page.tsx`: middleware already redirects `/`, so this is only a fallback:

```tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/login');
}
```

### 11.3 Login — `frontend/src/app/login/page.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Alert, Button, Card, Input } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  // Controlled inputs: React state is the single source of truth for field values.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser's default full-page form POST
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password); // redirects on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
        <p className="mb-6 text-sm text-slate-500">Log in to your LMS account</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          New borrower? <Link href="/signup" className="font-medium text-indigo-600 hover:underline">Create an account</Link>
        </p>
      </Card>
    </main>
  );
}
```

### 11.4 Signup — `frontend/src/app/signup/page.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Alert, Button, Card, Input } from '@/components/ui';

export default function SignupPage() {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // One handler for all fields: uses the input's `name` attribute as the key.
  const update = (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form.name, form.email, form.password);
    } catch (err) {
      // Zod 400 errors arrive as a list. Show the first field message if present.
      if (err instanceof ApiError && Array.isArray(err.errors) && err.errors[0]?.message) setError(err.errors[0].message);
      else setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">Apply for a loan</h1>
        <p className="mb-6 text-sm text-slate-500">Create your borrower account</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <Input label="Name" name="name" required value={form.name} onChange={update} />
          <Input label="Email" name="email" type="email" required value={form.email} onChange={update} />
          <Input label="Password (min 8 chars)" name="password" type="password" minLength={8} required value={form.password} onChange={update} />
          <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Creating…' : 'Sign up'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Have an account? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
```

✅ **Checkpoint:** Run both servers. Signing up lands you on `/apply` (a 404 for now is fine). Logging in as `sanction@lms.dev` redirects to `/dashboard/sanction`.

---

<a id="phase-12"></a>
## Phase 12 — Borrower Portal (Multi-Step Wizard)

### 12.1 The page — `frontend/src/app/apply/page.tsx`

```tsx
'use client';

import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/context/AuthContext';
import type { BorrowerProfile, FileInfo, Loan } from '@/lib/types';
import { Alert, Button } from '@/components/ui';
import { Stepper } from '@/components/apply/Stepper';
import { PersonalDetailsStep } from '@/components/apply/PersonalDetailsStep';
import { SalarySlipStep } from '@/components/apply/SalarySlipStep';
import { LoanConfigStep } from '@/components/apply/LoanConfigStep';
import { LoanStatusCard } from '@/components/apply/LoanStatusCard';

interface BorrowerMe {
  profile: BorrowerProfile | null;
  salarySlip: FileInfo | null;
  activeLoan: Loan | null;
  loans: Loan[];
}

export default function ApplyPage() {
  const { user, logout } = useAuth();
  const { data, error, loading, reload } = useFetch<BorrowerMe>('/borrower/me');

  /**
   * DERIVED STATE: the current step is COMPUTED from server data, not stored
   * in its own useState. If we kept `const [step, setStep] = useState(1)`,
   * refreshing the page would reset it to step 1 even though the server knows
   * the user already finished step 3. Deriving it means it can never be wrong.
   *   step 2 → no profile yet
   *   step 3 → profile done, no slip
   *   step 4 → both done
   */
  const step: 2 | 3 | 4 = !data?.profile ? 2 : !data.salarySlip ? 3 : 4;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 sm:px-8">
        <span className="font-bold text-indigo-600">LMS · Borrower</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-slate-600 sm:inline">{user?.name}</span>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        {loading && !data && <p className="text-slate-500">Loading…</p>}
        {error && <Alert>{error}</Alert>}

        {data && (data.activeLoan ? (
          // Has a loan in progress: show its status instead of the wizard.
          <LoanStatusCard loan={data.activeLoan} />
        ) : (
          <>
            {/* Previous outcome (e.g. rejected/closed), shown above a fresh application */}
            {data.loans[0] && <LoanStatusCard loan={data.loans[0]} compact />}
            <Stepper current={step} />
            {step === 2 && <PersonalDetailsStep initial={data.profile} onDone={reload} />}
            {step === 3 && <SalarySlipStep onDone={reload} onBack={null} />}
            {step === 4 && <LoanConfigStep slip={data.salarySlip!} onDone={reload} />}
          </>
        ))}
      </main>
    </div>
  );
}
```

> **The `onDone={reload}` pattern:** each step only knows how to save itself. When it succeeds, it tells the parent "something changed", and the parent re-fetches `/borrower/me`. The derived `step` then advances on its own. Children never coordinate with each other directly. Data flows down, and events flow up.

### 12.2 Stepper — `frontend/src/components/apply/Stepper.tsx`

```tsx
const STEPS = ['Account', 'Personal details', 'Salary slip', 'Loan & apply'];

// Purely presentational: given the current step number, render progress.
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2 text-center text-xs sm:text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'active' : 'todo';
        return (
          <li key={label} className="flex flex-col items-center gap-1">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${
                state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={state === 'todo' ? 'text-slate-400' : 'text-slate-700'}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

### 12.3 Step 2 — `frontend/src/components/apply/PersonalDetailsStep.tsx`

```tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { previewBre } from '@/lib/bre';
import type { BorrowerProfile, BreFailure, EmploymentMode } from '@/lib/types';
import { Alert, Button, Card, Input } from '@/components/ui';

export function PersonalDetailsStep({ initial, onDone }: { initial: BorrowerProfile | null; onDone: () => void }) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? '',
    pan: initial?.pan ?? '',
    dob: initial?.dob?.slice(0, 10) ?? '', // ISO → 'YYYY-MM-DD' for <input type="date">
    monthlySalary: initial?.monthlySalary?.toString() ?? '',
    employmentMode: (initial?.employmentMode ?? 'SALARIED') as EmploymentMode,
  });
  const [serverFailures, setServerFailures] = useState<BreFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live client-side eligibility preview. useMemo recomputes only when the form changes.
  const clientFailures = useMemo(
    () => previewBre({ pan: form.pan, dob: form.dob, monthlySalary: Number(form.monthlySalary), employmentMode: form.employmentMode }),
    [form],
  );

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'pan' ? e.target.value.toUpperCase() : e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setServerFailures([]);
    setSubmitting(true);
    try {
      await api('/borrower/profile', {
        method: 'PUT',
        json: { ...form, monthlySalary: Number(form.monthlySalary) },
      });
      onDone(); // parent re-fetches → step advances to 3
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // BRE rejected on the SERVER: show each failed rule.
        setServerFailures((err.errors as BreFailure[]) ?? []);
      } else {
        setError(err instanceof Error ? err.message : 'Could not save details');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Personal details</h2>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Full name (as on PAN)" required value={form.fullName} onChange={set('fullName')} />
        </div>
        <Input label="PAN" required maxLength={10} placeholder="ABCPE1234F" value={form.pan} onChange={set('pan')} />
        <Input label="Date of birth" type="date" required value={form.dob} onChange={set('dob')} />
        <Input label="Monthly salary (₹)" type="number" min={0} required value={form.monthlySalary} onChange={set('monthlySalary')} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Employment mode</span>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.employmentMode} onChange={set('employmentMode')}>
            <option value="SALARIED">Salaried</option>
            <option value="SELF_EMPLOYED">Self-employed</option>
            <option value="UNEMPLOYED">Unemployed</option>
          </select>
        </label>

        <div className="space-y-3 sm:col-span-2">
          {/* Live hints: informational only, the user can still submit to see the server verdict */}
          {clientFailures.length > 0 && serverFailures.length === 0 && (
            <Alert kind="info">
              <p className="font-medium">Heads up: these may fail the eligibility check</p>
              <ul className="ml-4 list-disc">{clientFailures.map((f) => <li key={f.rule}>{f.message}</li>)}</ul>
            </Alert>
          )}
          {serverFailures.length > 0 && (
            <Alert>
              <p className="font-semibold">Application blocked: eligibility check failed</p>
              <ul className="ml-4 list-disc">{serverFailures.map((f) => <li key={f.rule}>{f.message}</li>)}</ul>
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Checking eligibility…' : 'Save & check eligibility'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

> **Why not disable Submit when client checks fail?** Because the demo video must show a **server-side BRE rejection**. Letting the request go through proves the server enforces the rules. The client hint is advisory.

### 12.4 Step 3 — `frontend/src/components/apply/SalarySlipStep.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { Alert, Button, Card } from '@/components/ui';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];

export function SalarySlipStep({ onDone }: { onDone: () => void; onBack: null }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Validate on selection for instant feedback (the server re-validates).
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && !ACCEPT.includes(f.type)) {
      setError('Only PDF, JPG or PNG files are allowed');
      setFile(null);
      return;
    }
    if (f && f.size > MAX_BYTES) {
      setError('File is larger than 5 MB');
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('salarySlip', file); // field name must match multer's .single('salarySlip')
      await api('/borrower/salary-slip', { method: 'POST', formData: fd });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Upload salary slip</h2>
      <p className="mb-4 text-sm text-slate-500">PDF, JPG or PNG · max 5 MB</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={onPick}
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700"
        />
        {file && <p className="text-sm text-slate-600">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={!file || uploading}>{uploading ? 'Uploading…' : 'Upload & continue'}</Button>
      </form>
    </Card>
  );
}
```

### 12.5 Step 4 — `frontend/src/components/apply/LoanConfigStep.tsx`

```tsx
'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { calculateLoan, INTEREST_RATE_PA, LIMITS } from '@/lib/loanMath';
import { formatPaise } from '@/lib/format';
import type { FileInfo } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export function LoanConfigStep({ slip, onDone }: { slip: FileInfo; onDone: () => void }) {
  const [amount, setAmount] = useState(100_000);
  const [tenure, setTenure] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * LIVE CALCULATION: recomputed on every slider move. It's cheap pure math,
   * so useMemo isn't strictly needed for performance. It documents that the
   * quote is a pure function of (amount, tenure).
   * Note: we DON'T store the quote in state. Derived values should be computed,
   * not synchronised, or they can drift out of sync with their inputs.
   */
  const quote = useMemo(() => calculateLoan(amount, tenure), [amount, tenure]);

  async function apply() {
    setError(null);
    setSubmitting(true);
    try {
      // Send only the CHOICES. The server recomputes interest and total.
      await api('/borrower/loans', { method: 'POST', json: { amount, tenureDays: tenure } });
      onDone(); // parent re-fetches → activeLoan exists → status card shows
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configure your loan</h2>
        <p className="text-sm text-slate-500">Salary slip: {slip.originalName} ✓</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Loan amount</span>
          <span className="font-semibold text-indigo-600">{formatPaise(amount * 100)}</span>
        </div>
        <input
          type="range"
          min={LIMITS.minAmount}
          max={LIMITS.maxAmount}
          step={LIMITS.amountStep}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))} // range inputs give strings → convert
          className="w-full accent-indigo-600"
          aria-label="Loan amount"
        />
        <div className="flex justify-between text-xs text-slate-400"><span>₹50K</span><span>₹5L</span></div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Tenure</span>
          <span className="font-semibold text-indigo-600">{tenure} days</span>
        </div>
        <input
          type="range"
          min={LIMITS.minTenure}
          max={LIMITS.maxTenure}
          step={1}
          value={tenure}
          onChange={(e) => setTenure(Number(e.target.value))}
          className="w-full accent-indigo-600"
          aria-label="Tenure in days"
        />
        <div className="flex justify-between text-xs text-slate-400"><span>30 days</span><span>365 days</span></div>
      </div>

      {/* Live calculation panel */}
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-500">Principal</dt><dd className="font-semibold">{formatPaise(quote.principal)}</dd></div>
        <div><dt className="text-slate-500">Rate</dt><dd className="font-semibold">{INTEREST_RATE_PA}% p.a.</dd></div>
        <div><dt className="text-slate-500">Interest (SI)</dt><dd className="font-semibold">{formatPaise(quote.simpleInterest)}</dd></div>
        <div><dt className="text-slate-500">Total repayment</dt><dd className="font-bold text-indigo-700">{formatPaise(quote.totalRepayment)}</dd></div>
      </dl>
      <p className="text-xs text-slate-400">SI = (P × R × T) / (365 × 100), T = tenure in days</p>

      {error && <Alert>{error}</Alert>}
      <Button onClick={apply} disabled={submitting} className="w-full">{submitting ? 'Submitting…' : 'Apply'}</Button>
    </Card>
  );
}
```

### 12.6 Status card — `frontend/src/components/apply/LoanStatusCard.tsx`

```tsx
import type { Loan, LoanStatus } from '@/lib/types';
import { formatDate, formatPaise } from '@/lib/format';
import { Card, StatusBadge } from '@/components/ui';

const MESSAGES: Record<LoanStatus, string> = {
  APPLIED: 'Your application is under review by our sanction team.',
  SANCTIONED: 'Approved! Funds will be disbursed shortly.',
  REJECTED: 'Unfortunately your application was not approved.',
  DISBURSED: 'Funds have been released. Repayment is in progress.',
  CLOSED: 'Fully repaid. This loan is closed. Thank you!',
};

export function LoanStatusCard({ loan, compact = false }: { loan: Loan; compact?: boolean }) {
  const pct = Math.min(100, Math.round((loan.amountPaid / loan.totalRepayment) * 100));
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{compact ? 'Previous application' : 'Your loan'}</h2>
        <StatusBadge status={loan.status} />
      </div>
      <p className="text-sm text-slate-600">{MESSAGES[loan.status]}</p>
      {loan.status === 'REJECTED' && loan.rejectionReason && (
        <p className="text-sm text-rose-700">Reason: {loan.rejectionReason}</p>
      )}
      {!compact && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">Amount</dt><dd>{formatPaise(loan.principal)}</dd></div>
            <div><dt className="text-slate-500">Tenure</dt><dd>{loan.tenureDays} days</dd></div>
            <div><dt className="text-slate-500">Total repayment</dt><dd>{formatPaise(loan.totalRepayment)}</dd></div>
            <div><dt className="text-slate-500">Applied on</dt><dd>{formatDate(loan.createdAt)}</dd></div>
          </dl>
          {loan.status === 'DISBURSED' && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Repaid {formatPaise(loan.amountPaid)}</span><span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-teal-500" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
```

✅ **Checkpoint:** Sign up as a new borrower. Enter an unemployed 20-year-old and you see a red "Application blocked" list with server messages. Fix the details, upload a PDF, move the sliders (the panel updates live), and click Apply. The status card shows `APPLIED`.

---

<a id="phase-13"></a>
## Phase 13 — Operations Dashboard

### 13.1 Dashboard shell — `frontend/src/app/dashboard/layout.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MODULES } from '@/lib/roles';
import { Button } from '@/components/ui';

/**
 * A layout wraps every /dashboard/* page and persists across navigation
 * (the sidebar doesn't re-mount when switching modules).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return <p className="p-8 text-slate-500">Loading…</p>;

  // FRONTEND RBAC: only render links this role may use.
  // (middleware.ts already blocks the URLs; the API blocks the data.)
  const visible = MODULES.filter((m) => m.roles.includes(user.role));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-white md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <span className="font-bold text-indigo-600">LMS · Operations</span>
          <span className="text-xs uppercase tracking-wide text-slate-500 md:mt-1 md:block">{user.role}</span>
        </div>
        {/* Horizontal scroll on mobile, vertical list on desktop: responsive with 2 classes */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {visible.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                pathname.startsWith(m.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 py-4 md:block">
          <p className="mb-2 truncate text-sm text-slate-600">{user.name}</p>
          <Button variant="ghost" className="w-full" onClick={logout}>Logout</Button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-8">
        <div className="mb-4 flex justify-end md:hidden"><Button variant="ghost" onClick={logout}>Logout</Button></div>
        {children}
      </main>
    </div>
  );
}
```

`frontend/src/app/dashboard/page.tsx`: middleware redirects `/dashboard` to the user's module, so this is a fallback:

```tsx
import { redirect } from 'next/navigation';
export default function DashboardIndex() {
  redirect('/login');
}
```

### 13.2 Sales — `frontend/src/app/dashboard/sales/page.tsx`

```tsx
'use client';

import { useFetch } from '@/hooks/useFetch';
import { formatDate } from '@/lib/format';
import { Alert, Card } from '@/components/ui';

interface Lead {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  fullName?: string;
  monthlySalary?: number;
  profileCompleted: boolean;
  salarySlipUploaded: boolean;
}

const Check = ({ ok }: { ok: boolean }) => <span className={ok ? 'text-emerald-600' : 'text-slate-300'}>{ok ? '●' : '○'}</span>;

export default function SalesPage() {
  const { data, error, loading } = useFetch<{ leads: Lead[] }>('/ops/sales/leads');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sales · Leads</h1>
      <p className="text-sm text-slate-500">Registered borrowers who haven&apos;t applied yet.</p>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Registered</th><th className="p-3">Details</th><th className="p-3">Slip</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-3 text-slate-400" colSpan={5}>Loading…</td></tr>}
            {data?.leads.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={5}>No leads 🎉</td></tr>}
            {data?.leads.map((l) => (
              <tr key={l._id} className="border-t">
                <td className="p-3 font-medium">{l.fullName ?? l.name}</td>
                <td className="p-3">{l.email}</td>
                <td className="p-3">{formatDate(l.createdAt)}</td>
                <td className="p-3"><Check ok={l.profileCompleted} /></td>
                <td className="p-3"><Check ok={l.salarySlipUploaded} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

### 13.3 Sanction — `frontend/src/app/dashboard/sanction/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import { calculateAge } from '@/lib/bre';
import type { Loan } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export default function SanctionPage() {
  const { data, error, loading, reload } = useFetch<{ loans: Loan[] }>('/ops/sanction/loans');
  const [busyId, setBusyId] = useState<string | null>(null);     // which row is processing
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // One wrapper for every action: busy state, error capture, refresh on success.
  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      setRejectingId(null);
      setReason('');
      await reload(); // the processed loan leaves the APPLIED queue
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sanction · Review applications</h1>
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {loading && !data && <p className="text-slate-500">Loading…</p>}
      {data?.loans.length === 0 && <Card><p className="text-slate-500">No applications awaiting review.</p></Card>}

      {data?.loans.map((loan) => {
        const s = loan.borrowerSnapshot;
        const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
        return (
          <Card key={loan._id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.fullName}</p>
                <p className="text-sm text-slate-500">{borrower?.email} · applied {formatDate(loan.createdAt)}</p>
              </div>
              <a className="text-sm font-medium text-indigo-600 hover:underline" href={`/api/ops/loans/${loan._id}/salary-slip`} target="_blank" rel="noreferrer">
                View salary slip ↗
              </a>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-slate-500">PAN</dt><dd className="font-mono">{s.pan}</dd></div>
              <div><dt className="text-slate-500">Age</dt><dd>{calculateAge(s.dob)}</dd></div>
              <div><dt className="text-slate-500">Salary / mo</dt><dd>{formatPaise(s.monthlySalary * 100)}</dd></div>
              <div><dt className="text-slate-500">Employment</dt><dd>{s.employmentMode.replace('_', ' ')}</dd></div>
              <div><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{formatPaise(loan.principal)}</dd></div>
              <div><dt className="text-slate-500">Tenure</dt><dd>{loan.tenureDays} days</dd></div>
              <div><dt className="text-slate-500">Interest</dt><dd>{formatPaise(loan.simpleInterest)}</dd></div>
              <div><dt className="text-slate-500">Total</dt><dd className="font-semibold">{formatPaise(loan.totalRepayment)}</dd></div>
            </dl>

            {rejectingId === loan._id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                  rows={2}
                  placeholder="Reason for rejection (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={busyId === loan._id || reason.trim().length < 5}
                    onClick={() => run(loan._id, () => api(`/ops/sanction/loans/${loan._id}/reject`, { method: 'PATCH', json: { reason } }))}>
                    Confirm reject
                  </Button>
                  <Button variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button disabled={busyId === loan._id}
                  onClick={() => run(loan._id, () => api(`/ops/sanction/loans/${loan._id}/approve`, { method: 'PATCH' }))}>
                  Approve
                </Button>
                <Button variant="ghost" onClick={() => { setRejectingId(loan._id); setReason(''); }}>Reject</Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
```

> The "View salary slip" link points to `/api/...`. Because it's same-origin (thanks to the rewrite), the browser sends the auth cookie automatically, and Express checks the role before streaming the file.

### 13.4 Disbursement — `frontend/src/app/dashboard/disbursement/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import type { Loan } from '@/lib/types';
import { Alert, Button, Card } from '@/components/ui';

export default function DisbursementPage() {
  const { data, error, loading, reload } = useFetch<{ loans: Loan[] }>('/ops/disbursement/loans');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function disburse(id: string) {
    // A cheap guard against accidental clicks on an irreversible money action.
    if (!confirm('Confirm funds have been released to the borrower?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      await api(`/ops/disbursement/loans/${id}/disburse`, { method: 'PATCH' });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Disbursement · Sanctioned loans</h1>
      {error && <Alert>{error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="p-3">Borrower</th><th className="p-3">Amount</th><th className="p-3">Tenure</th><th className="p-3">Sanctioned</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td className="p-3 text-slate-400" colSpan={5}>Loading…</td></tr>}
            {data?.loans.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={5}>Nothing to disburse.</td></tr>}
            {data?.loans.map((l) => (
              <tr key={l._id} className="border-t">
                <td className="p-3 font-medium">{l.borrowerSnapshot.fullName}</td>
                <td className="p-3">{formatPaise(l.principal)}</td>
                <td className="p-3">{l.tenureDays} d</td>
                <td className="p-3">{formatDate(l.sanctionedAt)}</td>
                <td className="p-3 text-right">
                  <Button disabled={busyId === l._id} onClick={() => disburse(l._id)}>Mark disbursed</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

### 13.5 Collection — `frontend/src/app/dashboard/collection/page.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { api } from '@/lib/api';
import { formatDate, formatPaise } from '@/lib/format';
import type { Loan, Payment } from '@/lib/types';
import { Alert, Button, Card, Input } from '@/components/ui';

const today = () => new Date().toISOString().slice(0, 10);

export default function CollectionPage() {
  const loans = useFetch<{ loans: Loan[] }>('/ops/collection/loans');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = loans.data?.loans.find((l) => l._id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Collection · Active loans</h1>
      {notice && <Alert kind="success">{notice}</Alert>}
      {loans.error && <Alert>{loans.error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr><th className="p-3">Borrower</th><th className="p-3">Total</th><th className="p-3">Outstanding</th></tr>
            </thead>
            <tbody>
              {loans.data?.loans.length === 0 && <tr><td className="p-3 text-slate-400" colSpan={3}>No active loans.</td></tr>}
              {loans.data?.loans.map((l) => (
                <tr key={l._id} onClick={() => { setSelectedId(l._id); setNotice(null); }}
                  className={`cursor-pointer border-t hover:bg-slate-50 ${l._id === selectedId ? 'bg-indigo-50' : ''}`}>
                  <td className="p-3 font-medium">{l.borrowerSnapshot.fullName}</td>
                  <td className="p-3">{formatPaise(l.totalRepayment)}</td>
                  <td className="p-3 font-semibold">{formatPaise(l.outstanding ?? l.totalRepayment - l.amountPaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {selected ? (
          // key={selected._id} → remount the panel when switching loans, resetting its form state
          <PaymentPanel
            key={selected._id}
            loan={selected}
            onRecorded={async (closed) => {
              if (closed) {
                setNotice(`Loan for ${selected.borrowerSnapshot.fullName} fully repaid and CLOSED.`);
                setSelectedId(null);
              }
              await loans.reload();
            }}
          />
        ) : (
          <Card><p className="text-slate-500">Select a loan to record a payment.</p></Card>
        )}
      </div>
    </div>
  );
}

function PaymentPanel({ loan, onRecorded }: { loan: Loan; onRecorded: (closed: boolean) => Promise<void> }) {
  const payments = useFetch<{ payments: Payment[] }>(`/ops/collection/loans/${loan._id}/payments`);
  const outstanding = loan.outstanding ?? loan.totalRepayment - loan.amountPaid;
  // Pre-fill the exact outstanding (in rupees) so the "final payment" is one click.
  const [form, setForm] = useState({ utr: '', amount: (outstanding / 100).toFixed(2), paidOn: today() });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<{ closed: boolean }>(`/ops/collection/loans/${loan._id}/payments`, {
        method: 'POST',
        json: { utr: form.utr, amount: Number(form.amount), paidOn: form.paidOn },
      });
      setForm((f) => ({ ...f, utr: '' }));
      await payments.reload();
      await onRecorded(res.closed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment'); // e.g. "Duplicate utr"
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">{loan.borrowerSnapshot.fullName}</h2>
        <p className="text-sm text-slate-500">
          Paid {formatPaise(loan.amountPaid)} of {formatPaise(loan.totalRepayment)} · Outstanding <b>{formatPaise(outstanding)}</b>
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
        <Input label="UTR number" required value={form.utr} onChange={(e) => setForm({ ...form, utr: e.target.value.toUpperCase() })} />
        <Input label="Amount (₹)" type="number" step="0.01" min="0.01" max={(outstanding / 100).toFixed(2)} required
          value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label="Paid on" type="date" max={today()} required value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
        <div className="sm:col-span-3">
          {error && <div className="mb-2"><Alert>{error}</Alert></div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Recording…' : 'Record payment'}</Button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Payment history</h3>
        {payments.data?.payments.length === 0 && <p className="text-sm text-slate-400">No payments yet.</p>}
        <ul className="divide-y text-sm">
          {payments.data?.payments.map((p) => (
            <li key={p._id} className="flex justify-between py-2">
              <span className="font-mono">{p.utr}</span>
              <span>{formatDate(p.paidOn)}</span>
              <span className="font-semibold">{formatPaise(p.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
```

### Why
- **`key={selected._id}` on `PaymentPanel`:** React reuses component instances by position. Without a key, switching loans would keep the previous loan's form values. Changing the `key` tells React "this is a different panel", so it remounts with fresh state. It's a common React interview topic.
- **Lists re-fetch after actions instead of patching local state:** this is simple and always correct, since the server decides the new status. Optimistic updates are a nice-to-have, not required here.
- **Responsive design:** `md:flex-row` turns the sidebar into a top bar on mobile. `overflow-x-auto` wrappers make tables scroll instead of overflowing. `grid sm:grid-cols-N` collapses forms to a single column on phones. That covers the "UI/UX + responsiveness" 10%.

---

<a id="phase-14"></a>
## Phase 14 — End-to-End Testing & Video Script

### 14.1 Run everything

```bash
# terminal 1
cd backend && cp .env.example .env   # edit MONGO_URI + JWT_SECRET
npm install && npm run seed && npm run dev

# terminal 2
cd frontend && cp .env.example .env.local   # same JWT_SECRET
npm install && npm run dev
# open http://localhost:3000
```

### 14.2 API smoke test (curl) — proves backend RBAC independent of the UI

```bash
API=http://localhost:4000/api
login () { curl -s -c "/tmp/$1.txt" -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1@lms.dev\",\"password\":\"$2\"}" > /dev/null; }

login borrower Borrower@123
login sanction Sanction@123
login disbursement Disburse@123
login collection Collect@123
login sales Sales@123

# --- RBAC negative tests: each must return 403 ---
curl -s -o /dev/null -w "sales→sanction: %{http_code}\n"     -b /tmp/sales.txt    $API/ops/sanction/loans
curl -s -o /dev/null -w "borrower→ops: %{http_code}\n"       -b /tmp/borrower.txt $API/ops/collection/loans
curl -s -o /dev/null -w "sanction→borrower: %{http_code}\n"  -b /tmp/sanction.txt $API/borrower/me
curl -s -o /dev/null -w "no cookie: %{http_code}\n"                               $API/ops/sales/leads   # 401

# --- Happy path ---
curl -s -b /tmp/borrower.txt -X PUT $API/borrower/profile -H 'Content-Type: application/json' \
  -d '{"fullName":"Demo Borrower","pan":"ABCPE1234F","dob":"1995-06-15","monthlySalary":60000,"employmentMode":"SALARIED"}'
curl -s -b /tmp/borrower.txt -F "salarySlip=@./sample-slip.pdf" $API/borrower/salary-slip
LOAN=$(curl -s -b /tmp/borrower.txt -X POST $API/borrower/loans -H 'Content-Type: application/json' \
  -d '{"amount":50000,"tenureDays":30}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).loan._id')
echo "loan=$LOAN"   # total = 50000 + 493.15 = ₹50,493.15  (5000000 + 49315 paise)

curl -s -b /tmp/sanction.txt     -X PATCH $API/ops/sanction/loans/$LOAN/approve
curl -s -b /tmp/disbursement.txt -X PATCH $API/ops/disbursement/loans/$LOAN/disburse

# Approving again must fail: wrong state → 409
curl -s -o /dev/null -w "re-approve: %{http_code}\n" -b /tmp/sanction.txt -X PATCH $API/ops/sanction/loans/$LOAN/approve

TODAY=$(date +%F)
pay () { curl -s -w " → %{http_code}\n" -b /tmp/collection.txt -X POST $API/ops/collection/loans/$LOAN/payments \
  -H 'Content-Type: application/json' -d "{\"utr\":\"$1\",\"amount\":$2,\"paidOn\":\"$TODAY\"}"; }

pay UTR000000000001 20000      # partial → 201
pay UTR000000000001 100        # duplicate UTR → 409
pay UTR000000000002 99999      # exceeds outstanding → 400
pay UTR000000000002 30493.15   # exact remainder → 201, "closed":true
```

Expected: the four RBAC lines print `403 403 403 401`, re-approve prints `409`, and the last payment returns `"closed":true`.

### 14.3 Demo video script (3–5 min)

| Time | Show |
|---|---|
| 0:00–0:20 | Intro: stack, architecture diagram (Phase 0.2), roles |
| 0:20–1:10 | **Borrower signup** → personal details with **BRE fail** (age 20, salary 10000, PAN `ABC123`, Unemployed) → the red list of all 4 failures. Fix it → **BRE pass** |
| 1:10–1:40 | Upload salary slip (briefly show a >5 MB or .docx rejection) → sliders move → live SI panel → **Apply** → status `APPLIED` |
| 1:40–2:00 | Log in as **sales** → the lead list (the new borrower is gone because they applied, and an un-applied one appears). Try typing `/dashboard/sanction` in the URL bar → redirected |
| 2:00–2:30 | **Sanction** → view slip → Approve (optionally reject another with a reason) |
| 2:30–2:50 | **Disbursement** → Mark disbursed |
| 2:50–3:40 | **Collection** → partial payment → duplicate UTR error → final payment → "CLOSED" banner |
| 3:40–4:10 | Borrower view shows CLOSED. Terminal: curl as sales → sanction API → **403** (backend RBAC proof) |
| 4:10–4:30 | Log in as **admin**, show all 4 modules. Wrap up |

---

<a id="phase-15"></a>
## Phase 15 — README, Repo Hygiene, Submission

### 15.1 `README.md` template (root)

````markdown
# Loan Management System (LMS)

Borrower portal + role-based operations dashboard.
**Stack:** Next.js 15 (App Router, TS, Tailwind) · Express 5 (TS) · MongoDB/Mongoose · JWT (httpOnly cookie) + bcrypt

## Demo
- Video: <link>
- Lifecycle: APPLIED → SANCTIONED/REJECTED → DISBURSED → CLOSED (auto on full repayment)

## Quick start
Prereqs: Node 20+, MongoDB 6+ (Atlas or `docker run -d -p 27017:27017 mongo:7`)

```bash
# Backend
cd backend
cp .env.example .env        # set MONGO_URI and JWT_SECRET
npm install
npm run seed                # creates one account per role
npm run dev                 # http://localhost:4000

# Frontend (new terminal)
cd frontend
cp .env.example .env.local  # JWT_SECRET must match backend
npm install
npm run dev                 # http://localhost:3000
```

## Test credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@lms.dev | Admin@123 |
| Sales | sales@lms.dev | Sales@123 |
| Sanction | sanction@lms.dev | Sanction@123 |
| Disbursement | disbursement@lms.dev | Disburse@123 |
| Collection | collection@lms.dev | Collect@123 |
| Borrower | borrower@lms.dev | Borrower@123 |

## Architecture & design decisions
- Next.js rewrites `/api/*` → Express (same-origin: no CORS; httpOnly cookie)
- RBAC enforced twice: `middleware.ts` (page routing) + Express `requireRole` (401/403)
- BRE runs on the server (authoritative) and client (instant feedback); re-checked at apply
- Money stored as integer paise; SI = P×R×T/(365×100), rounded once
- State machine with atomic conditional updates (`findOneAndUpdate({status: from})`)
- UTR unique index; one active loan per borrower (partial unique index)

## Assumptions
- Age 23–50 inclusive; PAN regex `^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$`
- Partial payments allowed; overpayment rejected; loan auto-closes at exact total
- Sales "leads" = borrowers with zero loans

## API reference
<paste the table from Phase 0.4>

## Possible improvements
Magic-byte file validation, S3 storage, Mongo transactions (replica set), refresh tokens, tests (Jest + supertest), pagination, audit log UI.
````

### 15.2 Hygiene checklist
- [ ] `.env` files are **not** committed (`git status` shows only `.env.example`)
- [ ] `uploads/` is git-ignored, but `.gitkeep` is kept
- [ ] `npm run typecheck` (backend) and `npm run build` (frontend) pass with **zero** errors
- [ ] `npm run lint` passes in the frontend
- [ ] No `console.log` debugging left, and no `any` types
- [ ] Small, meaningful commits (`feat(auth): signup/login with httpOnly JWT`, `feat(collection): payments with unique UTR and auto-close`)
- [ ] The README credentials match `seed.ts` exactly

### 15.3 Suggested commit order (≈ phases)
`chore: scaffold` → `feat(api): env, db, error handling` → `feat(models)` → `feat(auth)` → `feat(rbac)` → `feat(domain): bre, loan math, state machine` → `feat(borrower-api)` → `feat(ops-api)` → `chore: seed` → `feat(web): auth + guard` → `feat(web): borrower wizard` → `feat(web): dashboard` → `docs: readme`

---

<a id="appendix-a"></a>
## Appendix A — Answers to the Assignment's "Think About" Questions

| Question | Answer to give |
|---|---|
| Correct PAN regex? | `^[A-Z]{5}[0-9]{4}[A-Z]$` is the basic form. The stricter `^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$` validates the 4th-character holder type. Upper-case the input first. |
| Should the BRE live on the client, the server, or both? | Both. The server is authoritative, because clients are bypassable. The client gives instant UX feedback. The server re-runs it at apply time. |
| What status transitions happen in Sanction? | `APPLIED → SANCTIONED` (approve) or `APPLIED → REJECTED` (reject with a required reason). |
| What's the next status after disbursement? | `DISBURSED`, which is the active repayment phase. It moves to `CLOSED` automatically when `amountPaid === totalRepayment`. |
| How do you track outstanding balance? | A running `amountPaid` on the loan, updated with an atomic conditional `$inc`. `outstanding = totalRepayment − amountPaid`. Payments are the ledger. |
| Payment amount validations? | > 0, ≤ 2 decimals, ≤ outstanding, loan must be DISBURSED, valid and unique UTR, date not in the future and not before disbursement. |
| How do you store roles? | A single `role` enum string on the `users` document, mirrored in a TS union type. |
| How does middleware check them? | `requireAuth` (JWT → `req.user`, 401) runs first, then `requireRole(...roles)` (403), applied at the router level. |
| HTTP status for unauthorized access? | 401 when not logged in or the token is invalid. 403 when logged in with the wrong role. |

---

<a id="appendix-b"></a>
## Appendix B — Common Bugs and Fixes

| Symptom | Cause | Fix |
|---|---|---|
| Cookie not set in browser | Calling `http://localhost:4000` directly from the frontend | Always call the relative `/api/...` (goes through the rewrite) |
| Middleware always redirects to /login | `JWT_SECRET` differs between frontend and backend, or `.env.local` missing | Match the secrets, then restart `next dev` (env is read at startup) |
| Upload returns 400 "Unexpected field" | Form field name ≠ `salarySlip` | `fd.append('salarySlip', file)` |
| Upload fails with a weird boundary error | Manually set `Content-Type: multipart/form-data` | Don't set it for FormData |
| 500 on `/loans/abc/approve` | Invalid ObjectId → CastError | `isValidObjectId` check → 400 (already in code) |
| Loan never closes | Float money (`0.1+0.2`) | Integer paise everywhere |
| Duplicate UTR accepted | Unique index not built (collection existed before the schema change) | `npm run seed` (calls `syncIndexes`) or drop the collection |
| `partialFilterExpression $in` error | MongoDB < 6.0 | Upgrade, or use Atlas |
| Age off by one | Using `(now - dob)/365` or local-time getters | Use the birthday-aware `calculateAge` with UTC getters |
| Async error hangs request | Using Express 4 | Use Express 5, or wrap handlers in an async helper |
| Signup can create admin | Accepting `role` from the body | Never read `role` from client input |

---

<a id="appendix-c"></a>
## Appendix C — Viva / Interview Questions to Prepare

1. Walk through what happens, from browser to DB, when a sanction exec clicks Approve. *(fetch → Next rewrite → cookieParser → requireAuth → requireRole → transitionLoan → atomic findOneAndUpdate → JSON → reload)*
2. Why is the JWT in an httpOnly cookie and not localStorage? What attack does each choice expose you to? *(XSS vs CSRF; SameSite=Lax mitigates CSRF)*
3. How would you revoke a JWT before it expires? *(we re-load the user each request; alternatives: token version field, denylist, short-lived access token plus refresh token)*
4. What happens if two collection execs record the final payment simultaneously? *(conditional `$inc` lets one succeed; the other is rolled back with 409)*
5. Why store a borrower snapshot on the loan instead of always populating the user? *(audit/immutability)*
6. Why is "current step" derived instead of kept in `useState`? *(single source of truth; survives refresh)*
7. How would you add a new role, "Credit Manager", who can sanction loans over ₹2L? *(add to ROLES; extend requireRole, or move to permission-based checks with an amount condition)*
8. What would change to deploy this? *(Atlas, S3 for files, `secure` cookies over HTTPS, env-specific secrets, a single domain with the rewrite or a reverse proxy)*
9. How would you test the BRE? *(pure function → table-driven unit tests: boundary ages 22/23/50/51, salary 24999/25000, each PAN pattern)*
10. Why Mongo for this rather than Postgres? Where does Mongo make it harder? *(flexible profile/snapshots are easy; multi-document invariants like payment + balance need care or transactions)*

---

**You're done.** Build in phase order and get each checkpoint green before continuing. The end-to-end flow is worth 35% of the grade, so make sure it works completely before adding any extras.
