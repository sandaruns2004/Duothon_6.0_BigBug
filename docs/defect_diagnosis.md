# 🐛 AegisVault — Defect Diagnosis & Fix Plan

> Root-cause analysis of 4 production defects found in the Azure deployment, with exact file locations, fix instructions, and team task division.

---

## Summary of All Defects

| # | Defect | Severity | Root Cause | Microservices Affected |
|---|--------|----------|------------|----------------------|
| 1 | Admin login redirects to customer dashboard | 🔴 Critical | Frontend `login/page.tsx` doesn't route admins correctly during Step 1 (only OTP page routes correctly) | **client** (frontend), auth-service |
| 2 | OTP/Email only works in sandbox (no real delivery) | 🟡 Medium | Mailer always returns mock in non-production; RabbitMQ not deployed in Azure | **notification-service**, auth-service |
| 3 | KYC auto-verifies on upload (skips admin review) | 🔴 Critical | Backend `uploadKyc` hardcodes `kycStatus: 'VERIFIED'`; Frontend fakes verification with `setTimeout` | **auth-service**, **client**, admin-service |
| 4 | RabbitMQ not deployed / not verifiable | 🔴 Critical | RabbitMQ is completely absent from `cd.yml` and `provision.azcli` | **infrastructure**, notification-service, transaction-service, auth-service |

---

## Defect 1 — Admin Login Redirects to Customer Dashboard

### Symptom
When an admin (e.g., `admin@aegisvault.com`) logs in, they are always redirected to `/dashboard` (customer view) instead of `/admin`. There is no way for evaluators to reach the admin panel through normal login flow.

### Root Cause Diagnosis

The issue is a **multi-layer problem** spanning the login page AND the verify-OTP page.

#### Layer A: Login page redirect logic is correct ✅ (not the bug)

In [login/page.tsx](../client/src/app/login/page.tsx#L26-L38), the code checks if `res.data.mfaRequired` is true (which it always is because MFA is mandatory). So it **always** redirects to `/verify-otp` — it never reaches the role-based redirect on line 34. This is actually correct behavior.

#### Layer B: OTP page redirect logic is correct ✅ (not the bug)

In [verify-otp/page.tsx](../client/src/app/verify-otp/page.tsx#L50-L55):
```typescript
const role = res.data.user?.role || 'CUSTOMER';
if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
  router.push('/admin');
} else {
  router.push('/dashboard');
}
```
This looks correct — it should route admins to `/admin`.

#### Layer C: The ACTUAL bug — Backend verify-otp response ⚠️

The [auth.controller.js verify-otp](../services/auth-service/src/controllers/auth.controller.js#L318-L332) **does** return the user role in the response:
```javascript
user: {
  id: user.id,
  email: user.email,
  role: user.role,   // ← This SHOULD be 'ADMIN'
  kycStatus: user.kycStatus
}
```

#### Layer D: The REAL bug — Token storage doesn't persist role for navigation guards

Looking at [api.ts setTokens()](../client/src/lib/api.ts#L23-L36):
```typescript
export const setTokens = (accessToken: string, refreshToken?: string, role?: string) => {
  if (typeof window !== 'undefined') {
    Cookies.set('accessToken', accessToken, { expires: 1 / 96 }); // 15m
    Cookies.set('userRole', role, { expires: 7 });
```

The token is stored, but the dashboard page (`/dashboard`) has **no guard** that checks if the logged-in user is an admin and redirects them. If the OTP page redirect fails (e.g., due to a race condition with Next.js client-side navigation, or the `router.push('/admin')` call happens before `setTokens` completes), the user lands on `/dashboard`.

### The Real Issue

The redirect logic in verify-otp looks correct syntactically, but the problem manifests because:

1. **The seeded admin user may not have `role: 'ADMIN'` properly set in the database** — check if the seed script or startup seeder correctly creates the admin with role `ADMIN`.
2. **The `/admin` page has no server-side auth guard** — any user can navigate to `/admin` and any admin who accidentally goes to `/dashboard` has no redirect back.

### Fix Instructions

**Files to modify:**

#### Fix 1a: Add role-based redirect guard to `/dashboard`
In [dashboard/page.tsx](../client/src/app/dashboard/page.tsx), add at the top of the component:
```typescript
useEffect(() => {
  const role = Cookies.get('userRole') || localStorage.getItem('userRole');
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    router.push('/admin');
  }
}, []);
```

#### Fix 1b: Add role-based redirect guard to `/admin` 
In [admin/page.tsx](../client/src/app/admin/page.tsx), add a guard that redirects non-admins:
```typescript
useEffect(() => {
  const role = Cookies.get('userRole') || localStorage.getItem('userRole');
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    router.push('/dashboard');
  }
}, []);
```

#### Fix 1c: Verify the seed script sets admin role correctly
Check [seed-demo.js line 94](../scripts/seed-demo.js#L94) — this creates the admin with `role: 'ADMIN'` which is correct. Also check the [auth-service/src/index.js startup seeder](../services/auth-service/src/index.js) to ensure it upserts the admin user with the correct role.

> [!IMPORTANT]
> **Quick test after fix:** Login as `admin@aegisvault.com` → OTP `123456` → should redirect to `/admin`. If they manually go to `/dashboard`, the guard should redirect them back to `/admin`.

---

## Defect 2 — OTP/Email Services Not Working (Sandbox Only)

### Symptom
Phone OTP and SMS/email services are not working in the deployed Azure version. Only the sandbox OTP code `123456` works. Real OTP codes are never delivered.

### Root Cause Diagnosis

There are **3 cascading failures** causing this:

#### Cause A: Mailer always returns mock in non-production

In [mailer.js line 43](../services/notification-service/src/utils/mailer.js#L43-L54):
```javascript
if (process.env.NODE_ENV !== 'production' || SMTP_USER === 'test_smtp_user' || SMTP_HOST === 'smtp.mailtrap.io') {
  logger.info('📧 [DEV / SANDBOX EMAIL DISPATCH] Simulating email delivery instantly (mock mode)');
  return { success: true, messageId: `MOCK-...`, simulated: true };
}
```

This condition is **almost always true** because:
- `SMTP_HOST` defaults to `'smtp.mailtrap.io'` (line 8) — even if you set real SMTP credentials, the host check still triggers mock mode
- `SMTP_USER` defaults to `'test_smtp_user'` (line 10)
- In Azure CD pipeline, the env vars are set: `SMTP_HOST="smtp.mailtrap.io"` — so it always mocks!

#### Cause B: RabbitMQ is not deployed in Azure (see Defect 4)

Even if the mailer was fixed, the OTP email flow depends on RabbitMQ:
1. Auth Service → publishes `email.send` to RabbitMQ
2. Notification Service → consumes from `email_queue` → calls mailer

Without RabbitMQ in Azure, the email command message is published but **never consumed**.

#### Cause C: No SMS/phone OTP implementation exists

The codebase only implements **email-based OTP**. There is no SMS/phone OTP provider (e.g., Twilio, Firebase Auth). The `phone` field is collected during registration but never used for OTP delivery.

### Fix Instructions

**Files to modify:**

#### Fix 2a: Fix mailer mock condition
In [mailer.js](../services/notification-service/src/utils/mailer.js#L43):

```diff
- if (process.env.NODE_ENV !== 'production' || SMTP_USER === 'test_smtp_user' || SMTP_HOST === 'smtp.mailtrap.io') {
+ if (SMTP_USER === 'test_smtp_user' && SMTP_HOST === 'smtp.mailtrap.io') {
```

This way, mock mode only activates when BOTH values are their defaults (i.e., no real SMTP was configured). If you provide real Mailtrap credentials or any other SMTP provider, it will actually send.

#### Fix 2b: Set real SMTP credentials in Azure CD
In [cd.yml line 180](../.github/workflows/cd.yml#L180), the notification-service deployment sets `SMTP_HOST="smtp.mailtrap.io"`. Update GitHub secrets with valid Mailtrap sandbox credentials:
- Set `SMTP_USERNAME` to your actual Mailtrap inbox username
- Set `SMTP_PASSWORD` to your actual Mailtrap inbox password

With real Mailtrap credentials, emails will actually be delivered to the Mailtrap inbox (which you can show evaluators).

#### Fix 2c: Deploy RabbitMQ to Azure (see Defect 4 fixes)

Without RabbitMQ, the entire email pipeline is broken.

> [!WARNING]
> **Phone OTP/SMS does not exist in the codebase.** If you need to demonstrate it, you would need to integrate a service like Twilio or Firebase Auth. For the competition, email OTP via Mailtrap is likely sufficient — but mention that the architecture supports it as a future extension.

---

## Defect 3 — KYC Auto-Verifies on Upload (Should Wait for Admin Approval)

### Symptom
When a user uploads a KYC document on the `/profile` page, it instantly shows as "VERIFIED" without any admin review. Similarly, loans are auto-approved on application without admin intervention.

### Root Cause Diagnosis

#### Cause A: Backend `uploadKyc` hardcodes `kycStatus: 'VERIFIED'`

In [user.controller.js line 159](../services/auth-service/src/controllers/user.controller.js#L154-L159):
```javascript
const updatedUser = await prisma.user.update({
  where: { id: String(userId) },
  data: {
    nic,
    kycDocument,
    kycStatus: 'VERIFIED'  // ← BUG: Should be 'PENDING' to await admin review
  }
});
```

The comment on line 159 even says: *"Automatic verification for Phase 2 immediate testing/transactions"* — this was intentionally hardcoded for quick testing but should be changed for production.

#### Cause B: Frontend fakes the verification with `setTimeout`

In [profile/page.tsx line 102-112](../client/src/app/profile/page.tsx#L102-L112):
```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setUploadedFile(file.name);
    setKycStatus('VERIFYING');
    // Simulate AI document OCR & KYC verification
    setTimeout(() => {
      setKycStatus('VERIFIED');   // ← BUG: Fakes verification after 2 seconds
    }, 2000);
  }
};
```

The file isn't even uploaded to the server! It just visually fakes verification on the frontend.

#### Cause C: Loans auto-approve without admin review

In [loan.controller.js line 116](../services/account-service/src/controllers/loan.controller.js#L116):
```javascript
const loanStatus = status || 'APPROVED';  // ← BUG: Defaults to 'APPROVED'
```

And on [lines 143-148](../services/account-service/src/controllers/loan.controller.js#L143-L148):
```javascript
if (loanStatus === 'APPROVED' || loanStatus === 'ACTIVE') {
  await tx.account.update({
    where: { id: account.id },
    data: { balance: { increment: P } }  // ← Instantly credits the loan amount!
  });
}
```

The loan amount is immediately credited to the account without any admin review step.

#### Cause D: Admin panel has no KYC document viewer

In [admin/page.tsx](../client/src/app/admin/page.tsx), the admin can click "Verify KYC" on a user, but there's **no way to view the uploaded KYC document** before approving. The admin has no visibility into what was submitted.

### Fix Instructions

**Files to modify:**

#### Fix 3a: Change KYC upload to set status to `PENDING` instead of `VERIFIED`
In [user.controller.js](../services/auth-service/src/controllers/user.controller.js):

```diff
  const updatedUser = await prisma.user.update({
    where: { id: String(userId) },
    data: {
      nic,
      kycDocument,
-     kycStatus: 'VERIFIED'
+     kycStatus: 'PENDING'
    }
  });

  return res.status(200).json({
    success: true,
-   message: 'KYC documents submitted and verified successfully.',
+   message: 'KYC documents submitted successfully. Awaiting admin verification.',
    profile: updatedUser
  });
```

#### Fix 3b: Fix frontend to show `PENDING` state after upload (not fake `VERIFIED`)
In [profile/page.tsx](../client/src/app/profile/page.tsx):

```diff
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file.name);
-     setKycStatus('VERIFYING');
-     // Simulate AI document OCR & KYC verification
-     setTimeout(() => {
-       setKycStatus('VERIFIED');
-     }, 2000);
+     setKycStatus('PENDING');
+     // Actually submit the KYC document reference to the backend
+     authApi.getMe().then(res => {
+       const nic = res.data?.profile?.nic || '';
+       api.post('/api/users/kyc', { nic, kycDocument: file.name }).catch(() => {});
+     });
    }
  };
```

#### Fix 3c: Change loan default status from `APPROVED` to `PENDING`
In [loan.controller.js](../services/account-service/src/controllers/loan.controller.js):

```diff
- const loanStatus = status || 'APPROVED';
+ const loanStatus = status || 'PENDING';
```

This means loans are created as `PENDING` and the loan amount is NOT credited until an admin approves.

#### Fix 3d: Add admin endpoint to approve loans
In [admin.controller.js](../services/admin-service/src/controllers/admin.controller.js), add a new `approveLoan` function. Then add a route in [admin.routes.js](../services/admin-service/src/routes/admin.routes.js):

```javascript
router.put('/loans/:id/approve', adminController.approveLoan);
```

#### Fix 3e: Add KYC document viewer to admin panel
In [admin/page.tsx](../client/src/app/admin/page.tsx), add a "View KYC" button next to the "Verify" button that shows the uploaded document reference in a modal. The admin API `GET /api/admin/users` should also return `kycDocument` field — currently the [admin.controller.js listUsers](../services/admin-service/src/controllers/admin.controller.js#L117-L128) select query doesn't include `kycDocument`.

#### Fix 3f: Add Pending Loans tab to Admin Panel
Add a new tab in the admin dashboard to show pending loans and an "Approve" action button.

> [!IMPORTANT]
> The admin panel's "Verify KYC" button already exists and works via `PUT /api/admin/users/:id/verify` — the only change needed is that KYC documents should arrive as `PENDING` instead of `VERIFIED`, so the admin actually has something to review.

---

## Defect 4 — RabbitMQ Not Deployed / Not Verifiable in Azure

### Symptom
RabbitMQ is used for async email, notification, and audit event delivery. But in the Azure deployment, there is no evidence it's running. The email/notification pipeline is silently broken.

### Root Cause Diagnosis

#### Cause A: RabbitMQ is completely missing from Azure provisioning

Searching the infrastructure files:
- [provision.azcli](../infrastructure/provision.azcli) — **Zero mentions of RabbitMQ**
- [cd.yml](../.github/workflows/cd.yml) — **Zero mentions of RabbitMQ**
- No `RABBITMQ_URL` or `AMQP_URL` environment variable is passed to any service in the CD pipeline

RabbitMQ is only defined in `docker-compose.yml` for local development. It was **never provisioned or deployed** to Azure.

#### Cause B: Services fail silently when RabbitMQ is unavailable

The [rabbitmq.js utility](../services/auth-service/src/utils/rabbitmq.js) uses `amqp-connection-manager` which silently queues messages when disconnected. It doesn't crash the service — but messages are never delivered.

#### Cause C: The AMQP URL defaults to `localhost`

Each service's `rabbitmq.js` connects to:
```javascript
const AMQP_URL = process.env.AMQP_URL || process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
```

In Azure Container Apps, `localhost` refers to the container itself — not a RabbitMQ instance. So the connection silently fails.

### Fix Instructions

#### Fix 4a: Deploy RabbitMQ as an Azure Container App

Add to [provision.azcli](../infrastructure/provision.azcli):

```bash
# Deploy RabbitMQ as internal Container App
az containerapp create \
  --name rabbitmq \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT \
  --image rabbitmq:3-management-alpine \
  --ingress internal \
  --target-port 5672 \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars RABBITMQ_DEFAULT_USER=guest RABBITMQ_DEFAULT_PASS=guest
```

#### Fix 4b: Add RabbitMQ to the CD pipeline

In [cd.yml](../.github/workflows/cd.yml), add `RABBITMQ_URL` / `AMQP_URL` env vars to the services that need it:

```bash
# For auth-service, add:
AMQP_URL="amqp://guest:guest@rabbitmq:5672"

# For transaction-service, add:
AMQP_URL="amqp://guest:guest@rabbitmq:5672"

# For notification-service, add:
AMQP_URL="amqp://guest:guest@rabbitmq:5672"
```

Specifically, update the `az containerapp update` commands for:
- `auth-service` (line 168)
- `transaction-service` (line 176)
- `notification-service` (line 180)

#### Fix 4c: Add the change detection filter

In the `changes` job filter section of [cd.yml](../.github/workflows/cd.yml#L26-L38), there's no filter for rabbitmq. It needs one if you plan to manage it through the CD pipeline.

#### Fix 4d: Add a health verification endpoint

Add a `/health/rabbitmq` endpoint to the API Gateway or Notification Service that reports RabbitMQ connection status. This lets evaluators verify it's running.

> [!CAUTION]
> **RabbitMQ in Azure Container Apps has limitations.** Azure Container Apps don't support persistent storage by default, so queue data would be lost on container restart. For production, consider Azure Service Bus as a managed alternative. For the competition demo, a basic RabbitMQ container is sufficient.

---

## Impact Map: Which Services Are Affected by Each Defect

```mermaid
graph LR
    subgraph "Defect 1: Admin Redirect"
        D1_CLIENT["client/src/app/<br/>dashboard/page.tsx<br/>admin/page.tsx<br/>verify-otp/page.tsx"]
        D1_AUTH["auth-service<br/>seed-demo.js"]
    end

    subgraph "Defect 2: Email/OTP"
        D2_NOTIF["notification-service<br/>utils/mailer.js"]
        D2_CD["cd.yml<br/>SMTP env vars"]
        D2_RMQ["RabbitMQ<br/>(missing in Azure)"]
    end

    subgraph "Defect 3: KYC Auto-Verify"
        D3_AUTH["auth-service<br/>user.controller.js"]
        D3_ACCT["account-service<br/>loan.controller.js"]
        D3_ADMIN["admin-service<br/>admin.controller.js<br/>admin.routes.js"]
        D3_CLIENT["client/src/app/<br/>profile/page.tsx<br/>admin/page.tsx"]
    end

    subgraph "Defect 4: RabbitMQ"
        D4_INFRA["infrastructure/<br/>provision.azcli"]
        D4_CD2["cd.yml<br/>AMQP_URL env vars"]
        D4_NOTIF2["notification-service"]
        D4_TXN["transaction-service"]
        D4_AUTH2["auth-service"]
    end
```

---

## Team Task Division (2 Members)

### Member A — Backend & Infrastructure Focus

| Priority | Task | Files | Est. Time |
|----------|------|-------|-----------|
| 🔴 P0 | **Fix KYC backend**: Change `kycStatus: 'VERIFIED'` → `'PENDING'` in uploadKyc | [user.controller.js](../services/auth-service/src/controllers/user.controller.js#L159) | 5 min |
| 🔴 P0 | **Fix loan default status**: Change `'APPROVED'` → `'PENDING'` | [loan.controller.js](../services/account-service/src/controllers/loan.controller.js#L116) | 5 min |
| 🔴 P0 | **Add admin loan approval endpoint**: New `PUT /api/admin/loans/:id/approve` | [admin.controller.js](../services/admin-service/src/controllers/admin.controller.js) + [admin.routes.js](../services/admin-service/src/routes/admin.routes.js) | 30 min |
| 🔴 P0 | **Add `kycDocument` to admin user list query** | [admin.controller.js L117-128](../services/admin-service/src/controllers/admin.controller.js#L117) | 5 min |
| 🔴 P0 | **Deploy RabbitMQ to Azure** | [provision.azcli](../infrastructure/provision.azcli) | 15 min |
| 🔴 P0 | **Add AMQP_URL env vars to CD pipeline** | [cd.yml](../.github/workflows/cd.yml#L168-L180) | 10 min |
| 🟡 P1 | **Fix mailer mock condition** | [mailer.js L43](../services/notification-service/src/utils/mailer.js#L43) | 5 min |
| 🟡 P1 | **Update SMTP secrets in GitHub** | GitHub repo → Settings → Secrets | 5 min |

**Estimated total: ~80 min**

---

### Member B — Frontend Focus

| Priority | Task | Files | Est. Time |
|----------|------|-------|-----------|
| 🔴 P0 | **Add admin redirect guard to `/dashboard`** | [dashboard/page.tsx](../client/src/app/dashboard/page.tsx) | 10 min |
| 🔴 P0 | **Add customer redirect guard to `/admin`** | [admin/page.tsx](../client/src/app/admin/page.tsx) | 10 min |
| 🔴 P0 | **Fix KYC upload UI**: Remove `setTimeout` fake, submit to backend API, show PENDING | [profile/page.tsx](../client/src/app/profile/page.tsx#L102-L112) | 20 min |
| 🔴 P0 | **Add KYC document viewer modal to admin panel** | [admin/page.tsx](../client/src/app/admin/page.tsx#L519-L528) | 30 min |
| 🟡 P1 | **Add Pending Loans tab to admin panel** with approve/reject buttons | [admin/page.tsx](../client/src/app/admin/page.tsx) | 45 min |
| 🟡 P1 | **Update loan application form** to show "Pending Approval" status after submission | [payments/page.tsx](../client/src/app/payments/page.tsx) | 15 min |
| 🟢 P2 | **Add RabbitMQ status to admin dashboard** health metrics section | [admin/page.tsx](../client/src/app/admin/page.tsx) | 15 min |

**Estimated total: ~145 min**

---

## Verification After All Fixes

After implementing fixes, run these checks:

```bash
# 1. Rebuild & restart
docker compose down && docker compose up --build -d
npm run seed:demo

# 2. Test admin redirect
# Login as admin@aegisvault.com → OTP 123456 → should go to /admin

# 3. Test KYC workflow
# Login as customer → /profile → upload file → should show PENDING
# Login as admin → /admin → Users tab → see PENDING KYC → click View → click Verify

# 4. Test loan approval workflow
# Login as customer → /payments → apply for loan → should show PENDING
# Login as admin → /admin → Loans tab → click Approve → customer balance updates

# 5. Test RabbitMQ
# Open http://localhost:15672 → login guest/guest → verify queues exist
# Perform a transfer → check audit_queue and notify_queue show message activity

# 6. Run E2E smoke test
npm run test:e2e
```
