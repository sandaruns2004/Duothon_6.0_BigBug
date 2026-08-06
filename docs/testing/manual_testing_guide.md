# 🧪 AegisVault — Comprehensive Manual Testing & Verification Guide

> **For evaluators, QA testers, and developers** — step-by-step instructions to manually verify every feature of the AegisVault platform.

---

## Prerequisites

Before running any tests, ensure the platform is running:

```bash
# Start all containers
docker compose up --build -d

# Wait ~60 seconds for health checks, then seed demo data
npm run seed:demo
```

**Access URLs:**

| Service | URL |
|---------|-----|
| Frontend (Browser) | `http://localhost:8080` |
| API Gateway (API) | `http://localhost:3000` |
| RabbitMQ Management | `http://localhost:15672` (guest / guest) |

**Demo Credentials:**

| Role | Email | Password | OTP Code |
|------|-------|----------|----------|
| Admin | `admin@aegisvault.com` | `AdminSecure2026!` | `123456` |
| Customer 1 | `customer1@aegisvault.com` | `CustomerSecure2026!` | `123456` |
| Customer 2 | `customer2@aegisvault.com` | `CustomerSecure2026!` | `123456` |

---

## Test 1 — Infrastructure Health Checks

**Goal:** Verify all 8 Docker containers are running and all services respond to health endpoints.

### 1.1 Docker Container Status

```bash
docker compose ps
```

**✅ Expected:** All 8 containers show `Up (healthy)`:
- `postgres`, `redis`, `rabbitmq`
- `auth-service`, `account-service`, `transaction-service`, `notification-service`, `admin-service`
- `api-gateway`, `client`

### 1.2 API Gateway Health

```bash
curl http://localhost:3000/health
```

**✅ Expected:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "uptimeSeconds": <number>
}
```

### 1.3 Individual Service Health (through gateway)

Test each downstream service is reachable:

```bash
# Auth Service
curl http://localhost:3001/health

# Account Service
curl http://localhost:3002/health

# Transaction Service
curl http://localhost:3003/health

# Notification Service
curl http://localhost:3004/health

# Admin Service
curl http://localhost:3005/health
```

**✅ Expected:** Each returns `200 OK` with `"status": "healthy"` and correct `"service"` name.

### 1.4 PostgreSQL Connectivity

```bash
docker compose exec postgres pg_isready -U aegis_admin -d aegisvault
```

**✅ Expected:** `aegisvault - accepting connections`

### 1.5 Redis Connectivity

```bash
docker compose exec redis redis-cli ping
```

**✅ Expected:** `PONG`

### 1.6 RabbitMQ Management Console

Open browser → `http://localhost:15672` → Login: `guest` / `guest`

**✅ Verify:**
- [ ] Dashboard loads with node status "green"
- [ ] Queues tab shows: `email_queue`, `notify_queue`, `audit_queue`
- [ ] Exchanges tab shows: `aegisvault.commands` (direct), `aegisvault.events` (topic)

---

## Test 2 — User Registration

**Goal:** Verify new user creation with input validation, NIC format checking, and password strength enforcement.

### 2.1 Register via Frontend UI

1. Navigate to `http://localhost:8080/register`
2. Fill in the form:
   - Email: `testuser@aegisvault.com`
   - Phone: `+94771234567`
   - NIC: `200112345678` (12-digit format)
   - Password: `TestSecure2026!`
3. Click **"Create Account"**

**✅ Expected:**
- [ ] Registration succeeds with success message
- [ ] Redirects to login page

### 2.2 Register via API (cURL)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@aegisvault.com",
    "phone": "+94779998877",
    "nic": "199912345678",
    "password": "ApiSecure2026!"
  }'
```

**✅ Expected:** `201 Created` with `"success": true` and user object containing `"kycStatus": "PENDING"`.

### 2.3 Duplicate Registration Rejection

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@aegisvault.com",
    "phone": "+94770001001",
    "nic": "199512345678",
    "password": "TestSecure2026!"
  }'
```

**✅ Expected:** `409 Conflict` with `"error"` containing `"already exists"`.

### 2.4 Validation Rejections

Test weak password:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "weak@aegisvault.com",
    "phone": "+94771112233",
    "nic": "200012345678",
    "password": "weak"
  }'
```

**✅ Expected:** `400 Bad Request` with validation error about password requirements (min 8 chars, uppercase, lowercase, number, special character).

---

## Test 3 — MFA Login Flow (Multi-Factor Authentication)

**Goal:** Verify the 2-step login: password → OTP verification → JWT issuance.

### 3.1 Step 1: Login Request (Trigger MFA)

**Via Frontend:**
1. Navigate to `http://localhost:8080/login`
2. Enter `customer1@aegisvault.com` / `CustomerSecure2026!`
3. Click **"Sign In"**

**✅ Expected:**
- [ ] Redirects to `/verify-otp` page
- [ ] OTP input form appears with 6-digit entry field

**Via API:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@aegisvault.com",
    "password": "CustomerSecure2026!"
  }'
```

**✅ Expected:**
```json
{
  "success": true,
  "requireMfa": true,
  "userId": "usr-cust-demo-001",
  "expiresInSeconds": 300
}
```

### 3.2 Step 2: OTP Verification → JWT Token Issuance

**Via Frontend:**
1. On the `/verify-otp` page, enter `123456`
2. Click **"Verify Code"**

**✅ Expected:**
- [ ] Success message appears
- [ ] Redirects to `/dashboard` (for customers) or `/admin` (for admins)
- [ ] Navbar shows logged-in state

**Via API:**

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@aegisvault.com",
    "otp": "123456"
  }'
```

**✅ Expected:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiI...",
  "refreshToken": "eyJhbGciOiJIUzI1NiI...",
  "user": {
    "id": "usr-cust-demo-001",
    "email": "customer1@aegisvault.com",
    "role": "CUSTOMER"
  }
}
```

> **Save this `accessToken` — you'll need it for all subsequent API tests.** Set it as a variable:
> ```bash
> TOKEN="eyJhbGciOiJIUzI1NiI..."
> ```

### 3.3 Invalid OTP Rejection

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@aegisvault.com",
    "otp": "999999"
  }'
```

**✅ Expected:** `401 Unauthorized` with error about invalid or expired OTP.

### 3.4 Admin Login → Admin Dashboard Redirect

1. Navigate to `http://localhost:8080/login`
2. Enter `admin@aegisvault.com` / `AdminSecure2026!`
3. Verify OTP with `123456`

**✅ Expected:** Redirects to `/admin` (admin dashboard), NOT `/dashboard`.

---

## Test 4 — Account Lockout (5-Attempt Brute Force Protection)

**Goal:** Verify accounts lock after 5 consecutive failed login attempts.

### 4.1 Trigger Lockout

First, register a new test user (or use an existing one). Then attempt 5+ wrong passwords:

```bash
# Attempts 1-5 with wrong password
for i in 1 2 3 4 5; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "customer1@aegisvault.com", "password": "WrongPassword!"}' | jq .
  echo ""
done
```

**✅ Expected progression:**
- Attempts 1-4: `401 Unauthorized` with "Invalid credentials"
- Attempt 5: `403 Forbidden` with `"5 consecutive failed login attempts"` — account now locked

### 4.2 Verify Lock Persists

Try logging in with the CORRECT password after lockout:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@aegisvault.com",
    "password": "CustomerSecure2026!"
  }'
```

**✅ Expected:** `403 Forbidden` with `"Account is locked"` — even correct password is rejected.

### 4.3 Admin Unlocks the Account

Login as admin first, get a token, then unlock:

```bash
# 1. Admin login
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@aegisvault.com", "password": "AdminSecure2026!"}' | jq .

# 2. Admin verify OTP
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@aegisvault.com", "otp": "123456"}' | jq -r '.accessToken')

# 3. Unlock the customer account
curl -X PUT http://localhost:3000/api/admin/users/usr-cust-demo-001/unlock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Testing unlock after lockout"}'
```

**✅ Expected:** `200 OK` with `"isLocked": false` and `"failedAttempts": 0`.

### 4.4 Verify Customer Can Login Again

Re-attempt login with correct credentials for the unlocked customer.

**✅ Expected:** Login succeeds, MFA OTP triggered as normal.

---

## Test 5 — Customer Dashboard & Account Management

**Goal:** Verify the customer dashboard displays real account data correctly.

### 5.1 Dashboard Page Load

1. Login as `customer1@aegisvault.com` (with OTP `123456`)
2. Should auto-redirect to `/dashboard`

**✅ Verify:**
- [ ] Account card shows Account Number `#810000000001`
- [ ] Account type shows `SAVINGS`
- [ ] Balance shows approximately `1,500,000.00 LKR` (may differ if transfers executed)
- [ ] Recent transaction activity shows at least 1 demo transaction

### 5.2 Balance Privacy Toggle

- [ ] Click the eye icon next to the balance
- **✅ Expected:** Balance hides to `•••••••• LKR`
- [ ] Click again
- **✅ Expected:** Balance reveals back

### 5.3 Fetch Accounts via API

```bash
curl http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** `200 OK` with `"success": true` and array of accounts for the authenticated user.

### 5.4 Check Specific Account Balance via API

```bash
curl http://localhost:3000/api/accounts/acct-demo-001/balance \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** Returns `balance`, `accountNumber`, and `status: "ACTIVE"`.

---

## Test 6 — ACID Fund Transfers

**Goal:** Verify atomic fund transfers with balance verification, confirmation modal, and receipt generation.

### 6.1 Successful Internal Transfer (via Frontend)

1. Navigate to `http://localhost:8080/transfer`
2. Fill in:
   - From Account: `810000000001` (Customer 1's savings)
   - To Account: `810000000002` (Customer 2's current)
   - Amount: `25000`
   - Description: `Manual test transfer`
3. Click **"Review Transfer"**

**✅ Verify Confirmation Modal:**
- [ ] Modal shows sender/receiver account numbers
- [ ] Amount: `LKR 25,000.00`
- [ ] Transfer fee: `LKR 0.00` (fee only applies above 100,000 LKR)
- [ ] Total debit: `LKR 25,000.00`

4. Click **"Confirm & Execute"**

**✅ Verify Success:**
- [ ] Success receipt modal appears
- [ ] Shows reference number (e.g., `TXN-2026-xxxx`)
- [ ] Shows timestamp
- [ ] Print button works (`window.print()`)

### 6.2 Verify Balance Changes (ACID Compliance)

After the transfer above:

```bash
# Customer 1 balance should have decreased by 25,000
curl http://localhost:3000/api/accounts/acct-demo-001/balance \
  -H "Authorization: Bearer $TOKEN"

# Customer 2 balance should have increased by 25,000
# (Login as customer2 first, or check via admin)
```

**✅ Expected:**
- Customer 1: Balance ≈ `1,475,000.00` (decreased from 1,500,000)
- Customer 2: Balance ≈ `775,000.00` (increased from 750,000)
- **Both balances changed atomically** — not one without the other

### 6.3 Transfer via API (cURL)

```bash
curl -X POST http://localhost:3000/api/accounts/execute-transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fromAccountNumber": "810000000001",
    "toAccountNumber": "810000000002",
    "amount": 10000,
    "currency": "LKR",
    "description": "API test transfer"
  }'
```

**✅ Expected:** `200/201` with `"success": true`.

### 6.4 Insufficient Funds Rejection

```bash
curl -X POST http://localhost:3000/api/accounts/execute-transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fromAccountNumber": "810000000001",
    "toAccountNumber": "810000000002",
    "amount": 99999999,
    "currency": "LKR"
  }'
```

**✅ Expected:** `400 Bad Request` with `"Insufficient funds"` — no balance changes on either account.

### 6.5 Same-Account Transfer Rejection

```bash
curl -X POST http://localhost:3000/api/accounts/execute-transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fromAccountNumber": "810000000001",
    "toAccountNumber": "810000000001",
    "amount": 1000,
    "currency": "LKR"
  }'
```

**✅ Expected:** `400 Bad Request` — cannot transfer to the same account.

### 6.6 Transfer Fee Calculation (Amounts > 100,000 LKR)

On the frontend transfer page, enter amount `200000`:

**✅ Expected:**
- [ ] Transfer fee shows: `LKR 1,000.00` (0.5% of 200,000)
- [ ] Total debit shows: `LKR 201,000.00`

---

## Test 7 — Fraud Detection Engine (3 Rules)

**Goal:** Verify the rule-based fraud engine flags suspicious transactions.

### 7.1 Rule 1: High Amount Threshold (> 500,000 LKR)

```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fromAccountId": "810000000001",
    "toAccountId": "810000000002",
    "amount": 650000,
    "currency": "LKR",
    "description": "High value test"
  }'
```

**✅ Expected:**
```json
{
  "success": true,
  "transaction": {
    "fraudFlag": true,
    "status": "SUCCESS"
  },
  "fraudAlerts": [
    {
      "ruleTriggered": "RULE_1_HIGH_AMOUNT",
      "riskScore": 40
    }
  ]
}
```

> **Key point:** The transaction STILL EXECUTES (status: SUCCESS), but it's FLAGGED for admin review.

### 7.2 Rule 2: High Velocity (> 3 Transfers in 10 Minutes)

Execute 4+ transfers rapidly:

```bash
for i in 1 2 3 4; do
  curl -s -X POST http://localhost:3000/api/transactions/transfer \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"fromAccountId\": \"810000000001\",
      \"toAccountId\": \"810000000002\",
      \"amount\": 1000,
      \"currency\": \"LKR\",
      \"description\": \"Velocity test $i\"
    }" | jq '.transaction.fraudFlag'
  echo ""
done
```

**✅ Expected:** The 4th transfer should have `"fraudFlag": true` with `RULE_2_HIGH_VELOCITY` in the alerts.

### 7.3 Rule 3: New Recipient + Large Amount (> 100,000 LKR)

Transfer > 100,000 LKR to a never-before-used recipient:

```bash
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fromAccountId": "810000000001",
    "toAccountId": "890099990001",
    "amount": 150000,
    "currency": "LKR",
    "description": "New recipient large amount test"
  }'
```

**✅ Expected:** `fraudFlag: true` with `RULE_3_NEW_RECIPIENT_LARGE_AMOUNT` triggered.

### 7.4 Verify Fraud Alerts in Admin Dashboard

1. Login as admin → go to `/admin`
2. Click the **"Fraud Alerts"** tab

**✅ Verify:**
- [ ] All flagged transactions from above appear in the fraud alerts list
- [ ] Each shows amount, reference number, date, and accounts involved

---

## Test 8 — Transaction History & Receipts

**Goal:** Verify transaction listing, filtering, and printable receipts.

### 8.1 Transaction History Page (Frontend)

1. Login as `customer1@aegisvault.com`
2. Navigate to `http://localhost:8080/transactions`

**✅ Verify:**
- [ ] Transaction table loads with all recent transactions
- [ ] Each row shows: Reference Number, Amount, Type (TRANSFER), Status, Date
- [ ] Fraud-flagged transactions show 🚨 indicator

### 8.2 Filter Tabs

- [ ] Click **"ALL"** tab → shows all transactions
- [ ] Click **"CREDIT"** tab → shows only incoming credits
- [ ] Click **"DEBIT"** tab → shows only outgoing debits
- [ ] Click **"🚨 Flagged"** tab → shows only fraud-flagged transactions

### 8.3 Transaction History via API

```bash
curl "http://localhost:3000/api/transactions?limit=10&page=1" \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** `200 OK` with paginated transactions array and `pagination` metadata (totalItems, currentPage, totalPages).

### 8.4 Individual Transaction Receipt

```bash
curl http://localhost:3000/api/transactions/txn-demo-001 \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** Full transaction details including `referenceNumber`, `amount`, `fromAccountId`, `toAccountId`, `status`, `fraudFlag`, `createdAt`.

### 8.5 Printable Receipt (Frontend)

1. On the `/transactions` page, click **"Receipt"** button on any transaction
2. A modal should open with formatted receipt details

**✅ Verify:**
- [ ] Receipt shows reference number, amount, sender/receiver, timestamp
- [ ] **"Print Receipt"** button triggers browser print dialog

---

## Test 9 — Utility Bill Payments

**Goal:** Verify bill payment flow with account debiting and receipt generation.

### 9.1 Pay a Bill (Frontend)

1. Navigate to `http://localhost:8080/payments`
2. Select biller: **CEB Electricity**
3. Enter bill reference: `ELEC-2026-001`
4. Enter amount: `5000`
5. Select account to debit
6. Click **"Pay Bill"**

**✅ Verify:**
- [ ] Payment success confirmation appears
- [ ] Receipt shows receipt number, biller, amount, timestamp
- [ ] Account balance decreased by 5,000 LKR

### 9.2 Pay Bill via API

```bash
curl -X POST http://localhost:3000/api/payments/bill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountId": "acct-demo-001",
    "biller": "SLT_FIBER",
    "billReference": "SLT-2026-TEST",
    "amount": 3500,
    "currency": "LKR"
  }'
```

**✅ Expected:** `200/201` with `"success": true` and `receiptNumber` in the response.

---

## Test 10 — Loan Amortization Engine

**Goal:** Verify the loan calculator and application flow.

### 10.1 Loan Calculator (Frontend)

1. Navigate to `http://localhost:8080/payments` (Loan section)
2. Enter:
   - Loan Amount: `500000`
   - Interest Rate: `12` (%)
   - Term: `24` months
3. Click **"Calculate"**

**✅ Verify:**
- [ ] Monthly EMI payment is calculated (≈ LKR 23,536)
- [ ] Total interest shows the sum over 24 months
- [ ] Full amortization schedule table with monthly breakdown

### 10.2 Apply for Loan via API

```bash
curl -X POST http://localhost:3000/api/loans/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountId": "acct-demo-001",
    "amount": 250000,
    "interestRate": 10,
    "termMonths": 12,
    "purpose": "Vehicle purchase"
  }'
```

**✅ Expected:** `201 Created` with loan details, `monthlyPayment`, `status: "APPROVED"/"ACTIVE"`, and `repaymentSchedule` array.

### 10.3 List Loans

```bash
curl http://localhost:3000/api/loans \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** Array of loans with their statuses and amortization schedules.

---

## Test 11 — Admin Dashboard & Governance

**Goal:** Verify admin-only features: metrics aggregation, user management, and KYC verification.

### 11.1 Dashboard Metrics

1. Login as `admin@aegisvault.com` → navigate to `/admin`

**✅ Verify dashboard KPI cards:**
- [ ] **Total Users** — shows total registered user count
- [ ] **Active Accounts** — shows count of ACTIVE bank accounts
- [ ] **Transactions Today** — shows today's transaction count
- [ ] **Flagged Transactions** — shows count of fraud-flagged transactions
- [ ] **Uptime** — shows formatted uptime string

### 11.2 Dashboard Metrics via API

```bash
curl http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected:**
```json
{
  "success": true,
  "dashboard": {
    "totalUsers": <number>,
    "kycPendingUsers": <number>,
    "activeAccounts": <number>,
    "totalTransactionsToday": <number>,
    "flaggedTransactionsCount": <number>,
    "uptimeFormatted": "Xh Ym Zs"
  }
}
```

### 11.3 User Directory

1. In admin dashboard, click **"Users"** tab

**✅ Verify:**
- [ ] User table loads with columns: Email, Phone, NIC, Role, KYC Status, Locked Status, Created Date
- [ ] Search box filters users by email/phone/NIC in real-time
- [ ] Pagination controls work (if > 20 users)

### 11.4 User Management via API

```bash
# List all users
curl "http://localhost:3000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Search users
curl "http://localhost:3000/api/admin/users?search=customer1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by role
curl "http://localhost:3000/api/admin/users?role=CUSTOMER" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected:** Each returns paginated user list with `pagination` metadata.

### 11.5 Suspend User Account

```bash
curl -X PUT http://localhost:3000/api/admin/users/usr-cust-demo-002/suspend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Suspicious activity during manual test"}'
```

**✅ Expected:** `200 OK` with `"isLocked": true`. Customer 2 can no longer login.

### 11.6 Verify Suspended User Cannot Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "customer2@aegisvault.com", "password": "CustomerSecure2026!"}'
```

**✅ Expected:** `403 Forbidden` with `"Account is locked"`.

### 11.7 Unlock User Account

```bash
curl -X PUT http://localhost:3000/api/admin/users/usr-cust-demo-002/unlock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Test complete, restoring access"}'
```

**✅ Expected:** `200 OK` with `"isLocked": false`, `"failedAttempts": 0`.

### 11.8 Verify KYC

```bash
curl -X PUT http://localhost:3000/api/admin/users/usr-cust-demo-001/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Documents verified during manual testing"}'
```

**✅ Expected:** `200 OK` with `"kycStatus": "VERIFIED"`.

### 11.9 Fraud Alerts List

```bash
curl "http://localhost:3000/api/admin/fraud-alerts?page=1&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected:** Array of transactions with `"fraudFlag": true`, including amounts, reference numbers, and accounts.

---

## Test 12 — SHA-256 Cryptographic Audit Trail

**Goal:** Verify the tamper-evident hash chain records all actions and can detect data tampering.

### 12.1 View Audit Logs (Frontend)

1. Login as admin → `/admin`
2. Click the **"Audit Logs"** tab

**✅ Verify:**
- [ ] Audit log table loads with entries
- [ ] Each entry shows: Action, User ID, Resource, Hash (truncated), Previous Hash, Timestamp
- [ ] Genesis entry exists with action `SYSTEM_GENESIS_SEED`

### 12.2 Query Audit Logs via API

```bash
curl "http://localhost:3000/api/audit?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected:** Array of audit log entries, each containing `hash`, `previousHash`, `action`, `userId`, `createdAt`.

### 12.3 Verify Hash Chain Integrity ⭐

This is the most important security test — it mathematically proves no records were tampered with.

**Via Frontend:**
1. In admin dashboard → Audit Logs tab
2. Click **"Verify Hash Chain"** button

**✅ Expected:** Green success banner: "All cryptographic hash-chain signatures verified successfully."

**Via API:**

```bash
curl http://localhost:3000/api/audit/verify-chain \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected:**
```json
{
  "success": true,
  "verification": {
    "valid": true,
    "totalRecords": <number>,
    "message": "All cryptographic hash-chain signatures verified successfully."
  }
}
```

### 12.4 Understanding the Hash Chain

Each audit record's hash is calculated as:

```
hash = SHA256( previousHash | timestamp | action | userId | details )
```

This means:
- If anyone edits a historical record's data → its hash will no longer match
- If a hash changes → ALL subsequent records' `previousHash` values break
- The `verify-chain` endpoint recalculates every hash from scratch and compares

---

## Test 13 — Notification System

**Goal:** Verify in-app notifications are stored and RabbitMQ message flow works.

### 13.1 Fetch Notifications

After performing some transfers (which trigger notifications via RabbitMQ):

```bash
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** Array of notifications with `"type"`, `"subject"`, `"read"` status, and `"createdAt"`.

### 13.2 Mark Notification as Read

```bash
curl -X PUT http://localhost:3000/api/notifications/<notification-id>/read \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** `200 OK` with notification now showing `"read": true`.

### 13.3 Mark All as Read

```bash
curl -X PUT http://localhost:3000/api/notifications/read-all \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** `200 OK` with all notifications marked as read.

### 13.4 RabbitMQ Queue Verification

Open RabbitMQ Management at `http://localhost:15672`:

**✅ Verify after performing a transfer:**
- [ ] `email_queue` shows message activity (messages published and consumed)
- [ ] `notify_queue` shows message activity
- [ ] `audit_queue` shows message activity
- [ ] No messages sitting unconsumed (consumer count > 0)

---

## Test 14 — JWT Token Refresh (Silent Re-auth)

**Goal:** Verify expired access tokens are automatically refreshed.

### 14.1 Manual Token Refresh

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

**✅ Expected:** `200 OK` with a new `accessToken` (the old access token can now be discarded).

### 14.2 Invalid Token Rejection

```bash
curl http://localhost:3000/api/accounts \
  -H "Authorization: Bearer invalid.jwt.token.here"
```

**✅ Expected:** `401 Unauthorized` with `"Invalid or expired token"`.

### 14.3 No Token Rejection

```bash
curl http://localhost:3000/api/accounts
```

**✅ Expected:** `401 Unauthorized` with `"No authentication token provided"`.

---

## Test 15 — Rate Limiting

**Goal:** Verify the API Gateway throttles excessive requests.

### 15.1 Public Route Rate Limit (20 req/min)

Rapidly hit the login endpoint:

```bash
for i in $(seq 1 25); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "ratelimit@test.com", "password": "test"}')
  echo "Request $i: HTTP $STATUS"
done
```

**✅ Expected:** After ~20 requests, you start getting `429 Too Many Requests`.

### 15.2 Authenticated Route Rate Limit (100 req/min)

Similar test but with a valid JWT token on a protected endpoint — should allow up to 100 requests per minute before throttling.

---

## Test 16 — User Profile & KYC

**Goal:** Verify profile viewing, editing, and KYC submission.

### 16.1 Get User Profile

```bash
curl http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

**✅ Expected:** `200 OK` with user data (email, phone, NIC, role, kycStatus).

### 16.2 Update Profile

```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone": "+94771112233"}'
```

**✅ Expected:** `200 OK` with updated phone number.

### 16.3 Submit KYC

```bash
curl -X POST http://localhost:3000/api/users/kyc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"documentRef": "NIC-SCAN-2026-001"}'
```

**✅ Expected:** `200 OK` with `"kycStatus": "VERIFIED"`.

---

## Test 17 — Frontend UI/UX Verification Checklist

**Goal:** Walk through every page and verify the visual presentation and interactivity.

### 17.1 Landing Page (`/`)

- [ ] Hero section renders with animated text (Framer Motion)
- [ ] "ACID-Compliant • Zero-Trust Quantum Banking" badge visible
- [ ] 3 feature cards load: Cryptographic Audit, ACID Engine, Fraud Detection
- [ ] Hover effects work on feature cards (scale animation)
- [ ] CTA buttons link to: `/dashboard`, `/login`, `/register`

### 17.2 Login Page (`/login`)

- [ ] Email and password inputs render
- [ ] "Sandbox Demo Credentials" button auto-fills credentials
- [ ] Invalid credentials show error message in red
- [ ] Loading spinner shows during API call
- [ ] Link to `/register` visible

### 17.3 Registration Page (`/register`)

- [ ] 4 input fields: Email, Phone, NIC, Password
- [ ] Password strength meter updates in real-time (4 levels)
- [ ] NIC format validation (9-digit+V/X or 12-digit)
- [ ] Link to `/login` visible

### 17.4 OTP Verification Page (`/verify-otp`)

- [ ] 6-digit OTP input field renders
- [ ] Countdown timer displays (60 seconds)
- [ ] "Sandbox Demo Credentials" autofill button works (fills `123456`)
- [ ] Invalid OTP shows error message
- [ ] Successful OTP redirects to dashboard

### 17.5 Dashboard (`/dashboard`)

- [ ] Account card with number, type, and balance
- [ ] Balance privacy toggle (eye icon) works
- [ ] Recent transactions section loads
- [ ] Navigation links to Transfer, Transactions, Payments, Profile

### 17.6 Transfer Page (`/transfer`)

- [ ] Form validates: account number length, amount > 0, not same account
- [ ] Confirmation modal shows transfer summary before execution
- [ ] Fee calculation visible for amounts > 100,000 LKR
- [ ] Success receipt with print button

### 17.7 Transactions Page (`/transactions`)

- [ ] Table loads with transaction history
- [ ] Filter tabs work: ALL, CREDIT, DEBIT, Flagged
- [ ] Fraud-flagged rows show 🚨 indicator
- [ ] Receipt modal opens on click

### 17.8 Payments Page (`/payments`)

- [ ] Biller dropdown with options (CEB, Water, SLT, Dialog)
- [ ] Bill reference and amount inputs
- [ ] Payment success confirmation
- [ ] Loan calculator section with EMI result

### 17.9 Admin Dashboard (`/admin`)

- [ ] KPI cards: Users, Accounts, Transactions, Flagged, Uptime
- [ ] Recharts area/bar charts render with data
- [ ] **Users tab**: Table with search, action buttons (Suspend/Verify/Unlock)
- [ ] **Fraud Alerts tab**: Flagged transaction list with details
- [ ] **Audit Logs tab**: Hash chain viewer with Verify button
- [ ] Responsive layout on tablet/mobile

### 17.10 Navbar Component

- [ ] Logo and brand name visible
- [ ] Navigation links change based on auth state (logged in vs logged out)
- [ ] Role-based menu items (Admin sees admin link, Customer does not)
- [ ] Logout button clears tokens and redirects to `/login`

---

## Test 18 — Automated Test Suites

**Goal:** Run the existing Jest + Supertest automated test suites.

### 18.1 Auth Service Tests

```bash
cd services/auth-service && npm test
```

**✅ Expected tests pass:**
- [ ] Health check returns 200 OK
- [ ] Successful user registration with valid NIC
- [ ] 409 Conflict on duplicate email/NIC
- [ ] Account lockout after 5 failed attempts
- [ ] Locked account rejected immediately
- [ ] JWT issuance after successful OTP verification

### 18.2 Transaction Service Tests

```bash
cd services/transaction-service && npm test
```

**✅ Expected tests pass:**
- [ ] Health check returns 200 OK
- [ ] Successful ACID atomic transfer execution
- [ ] Insufficient funds rejection and rollback
- [ ] Fraud flag triggered for high-value amounts (Rule 1)

---

## Test 19 — E2E Smoke Test (Automated)

**Goal:** Run the 7-step end-to-end smoke test that validates the full platform.

```bash
npm run test:e2e
# or
node scripts/smoke-test.js
```

**✅ Expected 7 steps pass:**
1. ✅ API Gateway health check
2. ✅ Admin MFA login (Step 1)
3. ✅ Admin OTP verification (Step 2)
4. ✅ SHA-256 audit trail query
5. ✅ Customer 1 MFA login + OTP
6. ✅ Customer account listing
7. ✅ Customer transaction history

---

## Test 20 — Docker & CI/CD Verification

### 20.1 Docker Compose Validation

```bash
docker compose config
```

**✅ Expected:** No errors — valid YAML output of the full compose configuration.

### 20.2 Container Resource Verification

```bash
docker compose logs --tail=20 auth-service
docker compose logs --tail=20 api-gateway
docker compose logs --tail=20 notification-service
```

**✅ Verify in logs:**
- [ ] Auth service: `"Auth Service running on port 3001"` and `"Database schema synced"`
- [ ] API Gateway: `"API Gateway running on port 3000"` and `"Redis connection established"`
- [ ] Notification Service: `"Notification Service running on port 3004"` and `"RabbitMQ consumers started"`

### 20.3 CI Pipeline (if pushing to GitHub)

Push a commit to `develop` or `main` branch:

**✅ Verify in GitHub Actions:**
- [ ] `unit-tests` job runs auth-service and transaction-service Jest suites
- [ ] `frontend-check` job runs `npm run build` on the client
- [ ] `docker-compose-test` job validates compose config and dry-run builds

---

## Quick Test Summary Checklist

| # | Feature | Test Method | Status |
|---|---------|-------------|--------|
| 1 | Health Checks (all 8 containers) | `docker compose ps` + `/health` endpoints | ☐ |
| 2 | User Registration + Validation | Frontend + cURL | ☐ |
| 3 | MFA Login (Password → OTP → JWT) | Frontend + cURL | ☐ |
| 4 | 5-Attempt Account Lockout | cURL loop | ☐ |
| 5 | Admin Unlock Account | cURL with admin token | ☐ |
| 6 | Dashboard Data Display | Frontend visual check | ☐ |
| 7 | Balance Privacy Toggle | Frontend click test | ☐ |
| 8 | ACID Fund Transfer (Success) | Frontend + cURL | ☐ |
| 9 | Transfer Insufficient Funds Rejection | cURL | ☐ |
| 10 | Transfer Confirmation Modal & Receipt | Frontend visual check | ☐ |
| 11 | Transfer Fee Calculation (>100K) | Frontend visual check | ☐ |
| 12 | Fraud Rule 1: High Amount (>500K) | cURL | ☐ |
| 13 | Fraud Rule 2: High Velocity (>3 in 10min) | cURL loop | ☐ |
| 14 | Fraud Rule 3: New Recipient + Large Amount | cURL | ☐ |
| 15 | Transaction History + Filters | Frontend tabs | ☐ |
| 16 | Printable Transaction Receipt | Frontend print modal | ☐ |
| 17 | Utility Bill Payment | Frontend + cURL | ☐ |
| 18 | Loan Calculator & Application | Frontend + cURL | ☐ |
| 19 | Admin Dashboard Metrics | Frontend + cURL | ☐ |
| 20 | Admin User Directory + Search | Frontend + cURL | ☐ |
| 21 | Admin Suspend User | cURL | ☐ |
| 22 | Admin Verify KYC | cURL | ☐ |
| 23 | Admin Fraud Alerts List | Frontend + cURL | ☐ |
| 24 | SHA-256 Audit Log Viewer | Frontend | ☐ |
| 25 | SHA-256 Hash Chain Verification | Frontend button + cURL | ☐ |
| 26 | RabbitMQ Queue Activity | RabbitMQ Management UI | ☐ |
| 27 | Notification List + Mark Read | cURL | ☐ |
| 28 | JWT Token Refresh | cURL | ☐ |
| 29 | Invalid/Missing Token Rejection | cURL | ☐ |
| 30 | Rate Limiting (429 after threshold) | cURL loop | ☐ |
| 31 | User Profile View/Edit | cURL | ☐ |
| 32 | KYC Submission | cURL | ☐ |
| 33 | Landing Page Animations | Frontend visual check | ☐ |
| 34 | Responsive Layout (Mobile) | Browser DevTools resize | ☐ |
| 35 | Auth Service Unit Tests (Jest) | `npm test` | ☐ |
| 36 | Transaction Service Unit Tests (Jest) | `npm test` | ☐ |
| 37 | E2E Smoke Test (7 steps) | `npm run test:e2e` | ☐ |
| 38 | Docker Compose Config Validation | `docker compose config` | ☐ |
