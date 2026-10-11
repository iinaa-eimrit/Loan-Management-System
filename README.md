# Loan Management System (LMS)

A full-stack, production-ready lending platform with an end-to-end borrower application portal and an internal operations dashboard with 4 specialized modules guarded by role-based access control (RBAC).

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express 5, TypeScript
- **Database:** MongoDB & Mongoose 8
- **Authentication:** JWT in `httpOnly` cookies + bcryptjs password hashing

---

## Table of Contents
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Quick Start Guide](#quick-start-guide)
- [Test Credentials](#test-credentials)
- [Loan Lifecycle & State Machine](#loan-lifecycle--state-machine)
- [Business Rule Engine (BRE) & Loan Math](#business-rule-engine-bre--loan-math)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [REST API Reference](#rest-api-reference)
- [Answers to Assignment "Think About" Questions](#answers-to-assignment-think-about-questions)
- [Automated Testing](#automated-testing)
- [3-5 Minute Demo Video Script](#3-5-minute-demo-video-script)

---

## Architecture & Design Decisions

```
 Browser ──► Next.js (port 3000)
               │  • Pages (React, Tailwind CSS)
               │  • middleware.ts  → Route guard (redirects by role via jose)
               │  • rewrites: /api/*  ──────────────┐
               │                                    ▼
               │                     Express 5 API (port 4000)
               │                       • requireAuth  (JWT in httpOnly cookie)
               │                       • requireRole  (RBAC → 401/403)
               │                       • BRE, loan math, state machine
               │                       • multer → /uploads (salary slips)
               │                                    │
               │                                    ▼
               │                              MongoDB (users, loans, payments)
```

1. **Unified Origin via Next.js Proxy Rewrites:** Next.js proxies all `/api/*` requests server-side to the Express API (`localhost:4000`). From the browser perspective, both UI and API share one origin (`localhost:3000`), completely eliminating CORS issues and allowing `httpOnly` secure cookies to be first-party.
2. **Two-Layer Access Control (Defense in Depth):**
   - **Frontend:** `middleware.ts` runs on the Edge runtime with Web-Crypto `jose` to verify the JWT and redirect users away from modules they cannot access.
   - **Backend:** Express `requireRole` middleware checks every endpoint, returning 401/403 on unauthorized requests even if client routes are bypassed.
3. **Exact Currency Representation:** All monetary values are calculated and stored in **integer paise** rather than floating-point rupees, eliminating JavaScript floating-point rounding drift (`0.1 + 0.2 !== 0.3`).
4. **Atomic State Transitions:** State moves occur using conditional queries (`findOneAndUpdate({ _id, status: from })`) ensuring race-free concurrency.
5. **Database-Level Invariants:**
   - At most one active loan per borrower via MongoDB partial unique index (`one_active_loan_per_borrower`).
   - Globally unique UTR constraint across all payments.
   - Unique email constraint across users.

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20+ LTS
- **MongoDB**: v6.0+ running on `localhost:27017` (or MongoDB Atlas connection string)

### 1. Backend Setup

```bash
cd backend

# Create .env from example (default points to localhost:27017/lms)
cp .env.example .env

# Install dependencies
npm install

# Seed known user accounts for all roles
npm run seed

# Run the dev server (starts on http://localhost:4000)
npm run dev
```

### 2. Frontend Setup (New Terminal)

```bash
cd frontend

# Create .env.local from example
cp .env.example .env.local

# Install dependencies
npm install

# Run the dev server (starts on http://localhost:3000)
npm run dev
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Test Credentials

A seed script (`backend/src/seed.ts`) pre-creates known credentials for all roles:

| Role | Email | Password | Access / Purpose |
|---|---|---|---|
| **Admin** | `admin@lms.dev` | `Admin@123` | Full access to all 4 dashboard modules |
| **Sales** | `sales@lms.dev` | `Sales@123` | Leads tracking (registered users without loans) |
| **Sanction** | `sanction@lms.dev` | `Sanction@123` | Review applications, view slips, approve / reject |
| **Disbursement** | `disbursement@lms.dev` | `Disburse@123` | Release funds for sanctioned loans |
| **Collection** | `collection@lms.dev` | `Collect@123` | Record repayments with unique UTR, auto-close |
| **Borrower** | `borrower@lms.dev` | `Borrower@123` | Multi-step application wizard & loan status card |

---

## Loan Lifecycle & State Machine

```
                     (Sanction exec)               (Disbursement exec)        (Collection exec records
 Borrower clicks      approve                       mark disbursed             payments; system closes
 "Apply"            ┌──────────────► SANCTIONED ───────────────► DISBURSED ──── when fully repaid) ───► CLOSED
 ─────────► APPLIED ┤
                    └──────────────► REJECTED (with reason)
                     (Sanction exec) reject
```

- `APPLIED`: Borrower configured terms and submitted salary slip.
- `SANCTIONED`: Sanction executive reviewed snapshot and approved.
- `REJECTED`: Sanction executive rejected with mandatory reason (terminal).
- `DISBURSED`: Disbursement executive marked funds released; loan enters repayment.
- `CLOSED`: Collection executive recorded repayments until `amountPaid === totalRepayment` (auto-closed, terminal).

---

## Business Rule Engine (BRE) & Loan Math

### Business Rule Engine (BRE)
The BRE evaluates four critical eligibility conditions:
1. **Age:** Must be between 23 and 50 years old (inclusive), computed accurately using UTC calendar birthday comparison.
2. **Monthly Salary:** Must be at least ₹25,000 / month.
3. **PAN Format:** Must match strict PAN structure: `^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$`.
4. **Employment Mode:** Must be `SALARIED` or `SELF_EMPLOYED`. `UNEMPLOYED` applicants are rejected.

> **Execution:** Runs on the client as an advisory preview, and on the server as authoritative enforcement (returning HTTP 422 with all failed rules listed). Re-checked at apply time.

### Loan Math Formula
- Fixed interest rate: **12% per annum**.
- Simple Interest formula:
  $$\text{SI} = \frac{P \times R \times T}{365 \times 100}$$
  where $T$ is tenure in days, $P$ is principal in paise.
- $\text{Total Repayment} = P + \text{SI}$.
- Rounded once at the end to integer paise.

---

## Role-Based Access Control (RBAC)

- **Borrowers:** Restricted to the borrower application portal (`/apply`). Blocked from `/dashboard/*`.
- **Executives:** Restricted strictly to their assigned module on `/dashboard/[role]`. Blocked from other executive modules and borrower portal.
- **Admin:** Unrestricted access across all 4 operational modules.

---

## REST API Reference

| Method | Path | Roles | Purpose | Success | Status Codes & Errors |
|---|---|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Create borrower account & set JWT cookie | 201 | 400 validation, 409 email exists |
| `POST` | `/api/auth/login` | Public | Verify credentials & issue JWT cookie | 200 | 401 invalid credentials |
| `POST` | `/api/auth/logout` | Any | Clear auth cookie | 200 | — |
| `GET` | `/api/auth/me` | Any | Get current session user | 200 | 401 unauthenticated |
| `GET` | `/api/borrower/me` | Borrower | Fetch profile, slip status, and active loan | 200 | 401, 403 forbidden |
| `PUT` | `/api/borrower/profile` | Borrower | Update personal details & run BRE | 200 | 400, 422 BRE failure, 409 active loan |
| `POST` | `/api/borrower/salary-slip` | Borrower | Upload salary slip (PDF/PNG/JPG, max 5MB) | 201 | 400, 409 missing step, 413 too large, 415 invalid type |
| `POST` | `/api/borrower/loans` | Borrower | Apply for configured loan | 201 | 400, 409 missing step / active loan, 422 BRE |
| `GET` | `/api/ops/sales/leads` | Admin, Sales | View registered borrowers without loans | 200 | 401, 403 |
| `GET` | `/api/ops/sanction/loans` | Admin, Sanction | Review pending `APPLIED` loans | 200 | 401, 403 |
| `PATCH` | `/api/ops/sanction/loans/:id/approve` | Admin, Sanction | Transition loan `APPLIED` → `SANCTIONED` | 200 | 404, 409 illegal state |
| `PATCH` | `/api/ops/sanction/loans/:id/reject` | Admin, Sanction | Transition loan `APPLIED` → `REJECTED` | 200 | 400 missing reason, 404, 409 |
| `GET` | `/api/ops/disbursement/loans` | Admin, Disbursement | List `SANCTIONED` loans | 200 | 401, 403 |
| `PATCH` | `/api/ops/disbursement/loans/:id/disburse` | Admin, Disbursement | Transition loan `SANCTIONED` → `DISBURSED` | 200 | 404, 409 |
| `GET` | `/api/ops/collection/loans` | Admin, Collection | List `DISBURSED` active loans with balance | 200 | 401, 403 |
| `GET` | `/api/ops/collection/loans/:id/payments` | Admin, Collection | Fetch repayment history for loan | 200 | 404 |
| `POST` | `/api/ops/collection/loans/:id/payments` | Admin, Collection | Record repayment & auto-close loan | 201 | 400 invalid amount, 409 dup UTR / wrong state |
| `GET` | `/api/ops/loans/:id/salary-slip` | Admin, Sanction | View uploaded borrower salary slip | 200 (file) | 400, 404 |

---

## Answers to Assignment "Think About" Questions

1. **What is the correct PAN regex?**
   - The formal Indian Income Tax PAN structure is `^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$`. The 4th character designates entity type (`P` for individual/person), the 5th character is the first letter of the applicant's surname, followed by 4 sequential digits and an alphabetic checksum.
2. **Should BRE live on the client, the server, or both? Why?**
   - **Both.** The **server is authoritative** because client code can be bypassed by direct API calls (e.g., via curl). The **client provides instantaneous UX feedback** without network roundtrips. The server also re-runs the BRE upon final application submission to prevent stale eligibility exploitation.
3. **What status transitions happen in Sanction?**
   - `APPLIED → SANCTIONED` upon executive approval, or `APPLIED → REJECTED` with a mandatory rejection reason.
4. **What is the next status after disbursement?**
   - `DISBURSED`. This signifies active funds payout and unlocks the repayment cycle in Collection.
5. **How do you track outstanding balance? What validations on payment amount?**
   - Outstanding balance is computed as `totalRepayment - amountPaid`.
   - Validations: Amount > 0, maximum 2 decimal places, amount $\le$ outstanding balance, unique UTR across all payments, and payment date not in the future or before disbursement. When `amountPaid === totalRepayment`, the loan auto-closes to `CLOSED`.

---

## Automated Testing

Run the automated end-to-end smoke test verifying all roles, RBAC permissions, BRE pass/fail checks, salary slip upload, loan approval, disbursement, duplicate UTR prevention, and auto-closing payment:

```bash
cd backend
npm run test:e2e
```

---

## 3-5 Minute Demo Video Script

| Timestamp | Screen | Action & Narration |
|---|---|---|
| **0:00 - 0:30** | Slide / README | Introduction to LMS stack (Next.js 15, Express 5, MongoDB, TypeScript), architecture with proxy rewrites, and 6 RBAC roles. |
| **0:30 - 1:15** | Borrower Signup & BRE Fail | Sign up as new borrower. Enter age 20, salary ₹10,000, PAN `ABC1234567`, Unemployed. Submit to demonstrate **server-side BRE rejection (HTTP 422)** displaying all 4 failure reasons. |
| **1:15 - 1:45** | BRE Pass & Salary Slip | Correct details to eligible values (age 28, ₹60,000, `ABCPE1234F`, Salaried). Upload sample salary slip. |
| **1:45 - 2:15** | Loan Sliders & Apply | Adjust amount (₹50,000) and tenure (30 days) sliders showing **live Simple Interest updates**. Click Apply → status changes to `APPLIED`. |
| **2:15 - 2:40** | Sales Module | Log in as `sales@lms.dev`. Show lead tracking table. Attempt to open `/dashboard/sanction` directly in URL bar → redirected. |
| **2:40 - 3:10** | Sanction Module | Log in as `sanction@lms.dev`. Open salary slip preview ↗. Click **Approve** → loan status transitions to `SANCTIONED`. |
| **3:10 - 3:30** | Disbursement Module | Log in as `disbursement@lms.dev`. Review sanctioned loans queue. Click **Mark Disbursed** → loan transitions to `DISBURSED`. |
| **3:30 - 4:15** | Collection & Auto-Close | Log in as `collection@lms.dev`. Record partial repayment (₹20,000). Show duplicate UTR error (409). Record exact final remainder (₹30,493.15) → loan automatically transitions to `CLOSED`. |
| **4:15 - 4:30** | Admin & Wrap Up | Log in as `admin@lms.dev` demonstrating full access across all 4 operational tabs. Confirm borrower portal shows `CLOSED` loan. |
