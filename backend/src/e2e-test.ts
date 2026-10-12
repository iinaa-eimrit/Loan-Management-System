import fs from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:4000/api';

async function req(url: string, options: RequestInit = {}, cookie?: string) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${API}${url}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data, setCookie: setCookie ? setCookie.split(';')[0] : '' };
}

async function run() {
  console.log('--- Starting End-to-End API Smoke Test ---');

  // 1. Log in all roles
  const roles = [
    { role: 'borrower', email: 'borrower@lms.dev', pass: 'Borrower@123' },
    { role: 'sales', email: 'sales@lms.dev', pass: 'Sales@123' },
    { role: 'sanction', email: 'sanction@lms.dev', pass: 'Sanction@123' },
    { role: 'disbursement', email: 'disbursement@lms.dev', pass: 'Disburse@123' },
    { role: 'collection', email: 'collection@lms.dev', pass: 'Collect@123' },
    { role: 'admin', email: 'admin@lms.dev', pass: 'Admin@123' },
  ];

  const cookies: Record<string, string> = {};
  for (const r of roles) {
    const res = await req('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: r.email, password: r.pass }),
    });
    if (res.status !== 200 || !res.setCookie) {
      throw new Error(`Login failed for ${r.role}: ${res.status} ${JSON.stringify(res.data)}`);
    }
    cookies[r.role] = res.setCookie;
    console.log(`✔ Login successful for ${r.role}`);
  }

  // 2. RBAC Negative Tests
  console.log('\n--- Running RBAC Negative Tests ---');

  // sales -> sanction: 403
  const t1 = await req('/ops/sanction/loans', {}, cookies['sales']);
  console.log(`sales -> sanction/loans: ${t1.status} (expected 403)`);
  if (t1.status !== 403) throw new Error('RBAC sales->sanction failed');

  // borrower -> ops/collection: 403
  const t2 = await req('/ops/collection/loans', {}, cookies['borrower']);
  console.log(`borrower -> collection/loans: ${t2.status} (expected 403)`);
  if (t2.status !== 403) throw new Error('RBAC borrower->collection failed');

  // sanction -> borrower/me: 403
  const t3 = await req('/borrower/me', {}, cookies['sanction']);
  console.log(`sanction -> borrower/me: ${t3.status} (expected 403)`);
  if (t3.status !== 403) throw new Error('RBAC sanction->borrower failed');

  // unauthenticated -> ops/sales/leads: 401
  const t4 = await req('/ops/sales/leads', {});
  console.log(`no cookie -> sales/leads: ${t4.status} (expected 401)`);
  if (t4.status !== 401) throw new Error('RBAC no cookie failed');

  // 3. Borrower Journey (Happy path)
  console.log('\n--- Running Borrower Journey & Lifecycle ---');

  // BRE Check Fail
  const breFail = await req('/borrower/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Too Young',
      pan: 'ABC1234567',
      dob: '2010-01-01',
      monthlySalary: 10000,
      employmentMode: 'UNEMPLOYED',
    }),
  }, cookies['borrower']);
  console.log(`BRE Fail check: ${breFail.status} (expected 422) failures=${JSON.stringify(breFail.data.errors)}`);
  if (breFail.status !== 422) throw new Error('BRE rejection check failed');

  // BRE Check Pass
  const brePass = await req('/borrower/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Demo Borrower',
      pan: 'ABCPE1234F',
      dob: '1995-06-15',
      monthlySalary: 60000,
      employmentMode: 'SALARIED',
    }),
  }, cookies['borrower']);
  console.log(`BRE Pass check: ${brePass.status} (expected 200)`);
  if (brePass.status !== 200) throw new Error('BRE pass failed');

  // Upload salary slip
  const slipPath = path.resolve(process.cwd(), 'sample-slip.pdf');
  const fileBytes = fs.readFileSync(slipPath);
  const formData = new FormData();
  formData.append('salarySlip', new Blob([fileBytes], { type: 'application/pdf' }), 'sample-slip.pdf');

  const uploadRes = await fetch(`${API}/borrower/salary-slip`, {
    method: 'POST',
    headers: { Cookie: cookies['borrower'] },
    body: formData,
  });
  console.log(`Upload salary slip: ${uploadRes.status} (expected 201)`);
  if (uploadRes.status !== 201) throw new Error('Salary slip upload failed');

  // Apply for loan
  const loanRes = await req('/borrower/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 50000, tenureDays: 30 }),
  }, cookies['borrower']);
  console.log(`Apply loan: ${loanRes.status} (expected 201)`);
  if (loanRes.status !== 201) throw new Error('Loan apply failed');
  const loanId = loanRes.data.loan._id;
  console.log(`Loan ID: ${loanId}, Total repayment: ${loanRes.data.loan.totalRepayment} paise (₹${loanRes.data.loan.totalRepayment / 100})`);

  // 4. Sanction Approve
  const approveRes = await req(`/ops/sanction/loans/${loanId}/approve`, { method: 'PATCH' }, cookies['sanction']);
  console.log(`Sanction approve: ${approveRes.status} (expected 200), status: ${approveRes.data.loan.status}`);
  if (approveRes.status !== 200 || approveRes.data.loan.status !== 'SANCTIONED') throw new Error('Sanction approve failed');

  // 5. Disbursement Disburse
  const disburseRes = await req(`/ops/disbursement/loans/${loanId}/disburse`, { method: 'PATCH' }, cookies['disbursement']);
  console.log(`Disburse loan: ${disburseRes.status} (expected 200), status: ${disburseRes.data.loan.status}`);
  if (disburseRes.status !== 200 || disburseRes.data.loan.status !== 'DISBURSED') throw new Error('Disbursement failed');

  // Re-approve attempt (Must fail with 409)
  const reApprove = await req(`/ops/sanction/loans/${loanId}/approve`, { method: 'PATCH' }, cookies['sanction']);
  console.log(`Re-approve attempt: ${reApprove.status} (expected 409)`);
  if (reApprove.status !== 409) throw new Error('Re-approve did not return 409');

  // 6. Collection Payments
  const today = new Date().toISOString().slice(0, 10);
  const utr1 = `UTR${Date.now()}111`;
  const utr2 = `UTR${Date.now()}222`;

  // Partial payment: ₹20,000
  const pay1 = await req(`/ops/collection/loans/${loanId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: utr1, amount: 20000, paidOn: today }),
  }, cookies['collection']);
  console.log(`Partial payment 1: ${pay1.status} (expected 201), outstanding: ₹${pay1.data.outstanding / 100}`);
  if (pay1.status !== 201) throw new Error('Partial payment 1 failed');

  // Duplicate UTR check: 409
  const payDup = await req(`/ops/collection/loans/${loanId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: utr1, amount: 100, paidOn: today }),
  }, cookies['collection']);
  console.log(`Duplicate UTR attempt: ${payDup.status} (expected 409)`);
  if (payDup.status !== 409) throw new Error('Duplicate UTR did not return 409');

  // Overpayment check: 400
  const payOver = await req(`/ops/collection/loans/${loanId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: utr2, amount: 99999, paidOn: today }),
  }, cookies['collection']);
  console.log(`Overpayment attempt: ${payOver.status} (expected 400)`);
  if (payOver.status !== 400) throw new Error('Overpayment did not return 400');

  // Exact remainder payment: ₹30,493.15
  const payFinal = await req(`/ops/collection/loans/${loanId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: utr2, amount: 30493.15, paidOn: today }),
  }, cookies['collection']);
  console.log(`Final payment: ${payFinal.status} (expected 201), closed: ${payFinal.data.closed}, status: ${payFinal.data.loan.status}`);
  if (payFinal.status !== 201 || !payFinal.data.closed || payFinal.data.loan.status !== 'CLOSED') {
    throw new Error('Final payment auto-close failed');
  }

  console.log('\n=========================================');
  console.log('✅ ALL END-TO-END SMOKE TESTS PASSED 100%');
  console.log('=========================================\n');
}

run().catch((e) => {
  console.error('❌ E2E Test Failure:', e);
  process.exit(1);
});
