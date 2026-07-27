# AegisVault Phase 2 — Complete Execution Task Tracker

> **Mission:** Build and deliver the complete AegisVault 5-microservice digital banking platform in 5 days.
> **Status:** 🚀 IN PROGRESS — Ready to begin Stage 1.

---

## 🟢 Stage 1: Monorepo Setup, Docker Compose, Database & Auth Engine

### 1.1 Project Workspace & Infrastructure Setup
- [x] Initialize monorepo root directory structure (`/services`, `/client`, `.github/workflows`)
- [x] Create `.gitignore`, root `package.json`, and `.env.example` with default database/JWT/Redis secrets
- [x] Write `docker-compose.yml` defining:
  - [x] PostgreSQL 16 (`postgres:16-alpine`) container with volume persistence
  - [x] Redis 7 (`redis:7-alpine`) container for session/rate-limit caching
  - [x] API Gateway (`:3000`) container
  - [x] 5 Microservice containers (`:3001` to `:3005`)
  - [x] Next.js Frontend (`:8080` -> `:3000`) container
- [x] Create standardized Dockerfile template for Node.js/Express microservices

### 1.2 API Gateway (`services/api-gateway` on port 3000)
- [x] Initialize Express.js app with `cors`, `helmet`, and `express-json`
- [x] Implement `express-rate-limit` backed by Redis (100 req/min for authenticated, 20 req/min for public)
- [x] Create JWT validation middleware (`jsonwebtoken`) with route whitelisting (`/api/auth/*`)
- [x] Configure `http-proxy-middleware` routing:
  - [x] `/api/auth/*` -> `http://auth-service:3001`
  - [x] `/api/accounts/*`, `/api/payments/*`, `/api/loans/*` -> `http://account-service:3002`
  - [x] `/api/transactions/*` -> `http://transaction-service:3003`
  - [x] `/api/notifications/*`, `/api/audit/*` -> `http://notification-service:3004`
  - [x] `/api/admin/*` -> `http://admin-service:3005`
- [x] Implement Winston request logger middleware (JSON structured logs)
- [x] Add `/health` endpoint

### 1.3 Auth Service (`services/auth-service` on port 3001)
- [x] Initialize Express.js app and install `@prisma/client`, `bcrypt`, `jsonwebtoken`, `zod`, `ioredis`
- [x] Create Prisma schema for `auth_schema`:
  - [x] `User` model (`id`, `email`, `phone`, `nic`, `passwordHash`, `role`, `failedAttempts`, `isLocked`, `kycStatus`)
  - [x] `RefreshToken` model (`id`, `userId`, `tokenHash`, `expiresAt`)
  - [x] `OtpRecord` model (`id`, `userId`, `otpHash`, `type`, `expiresAt`)
- [x] Implement `POST /api/auth/register` (Zod validation, bcrypt password hashing cost=12)
- [x] Implement `POST /api/auth/login` (credential check, failed attempts counter, account lockout after 5 fails)
- [x] Implement MFA OTP Generation (`POST /api/auth/login` triggers OTP email & caches hash in Redis with 5-min TTL)
- [x] Implement `POST /api/auth/verify-otp` (verify OTP against Redis -> issue access token 15m & refresh token 7d)
- [x] Implement `POST /api/auth/refresh` (validate refresh token -> issue new access token)
- [x] Implement `GET /api/users/profile` and `PUT /api/users/profile`
- [x] Implement `POST /api/users/kyc` (NIC document reference upload)
- [x] Add `/health` endpoint

---

## 🟡 Stage 2: Account Service, ACID Fund Transfers & Fraud Engine

### 2.1 Account Service (`services/account-service` on port 3002)
- [x] Initialize Express.js app with Prisma client
- [x] Create Prisma schema for `acct_schema`:
  - [x] `Account` model (`id`, `userId`, `accountNumber`, `accountType=SAVINGS|CURRENT|BUSINESS`, `balance`, `currency=LKR`, `status=ACTIVE|FROZEN|CLOSED`)
  - [x] `Loan` model (`id`, `userId`, `accountId`, `amount`, `interestRate`, `termMonths`, `monthlyPayment`, `status=PENDING|APPROVED|ACTIVE|PAID`)
- [x] Implement `POST /api/accounts` (auto-generate unique 12-digit account number, default 0 balance)
- [x] Implement `GET /api/accounts` (list all accounts for authenticated user)
- [x] Implement `GET /api/accounts/:id/balance` (real-time balance check for internal/external queries)
- [x] Implement internal `POST /api/accounts/execute-transfer`:
  - [x] Execute atomic SQL transaction (`BEGIN` -> debit sender if balance sufficient -> credit receiver -> `COMMIT`)
  - [x] Handle automatic rollback if sender has insufficient funds
- [x] Add `/health` endpoint

### 2.2 Transaction Service (`services/transaction-service` on port 3003)
- [x] Initialize Express.js app with Prisma client
- [x] Create Prisma schema for `txn_schema`:
  - [x] `Transaction` model (`id`, `fromAccountId`, `toAccountId`, `amount`, `currency`, `type=TRANSFER|PAYMENT|DEPOSIT`, `status`, `referenceNumber`, `fraudFlag`, `description`)
  - [x] `FraudAlert` model (`id`, `transactionId`, `ruleTriggered`, `riskScore`, `status=FLAGGED|REVIEWED|CLEARED`)
- [x] Build Rule-Based Fraud Detection Engine:
  - [x] Rule 1: High transfer amount (`amount > 500,000 LKR` -> flag)
  - [x] Rule 2: High velocity (`> 3 transfers within 10 minutes` -> flag)
  - [x] Rule 3: Large transfer to new recipient (`amount > 100,000 LKR` -> flag)
- [x] Implement `POST /api/transactions/transfer`:
  - [x] Check sender balance via HTTP `GET http://account-service:3002/api/accounts/:id/balance`
  - [x] Execute fraud detection rules
  - [x] Call Account Service `POST http://account-service:3002/api/accounts/execute-transfer`
  - [x] Save transaction record in `txn_schema.transactions`
  - [x] Dispatch async fire-and-forget alert to Notification Service (`POST /internal/notify` and `/internal/audit`)
- [x] Implement `GET /api/transactions` (paginated history with type/date filters)
- [x] Implement `GET /api/transactions/:id` and `GET /api/transactions/:id/receipt`
- [x] Add `/health` endpoint

---

## 🟠 Stage 3: Payment Operations, Loans & External Network Gateway

### 3.1 Utility Bill Payments & Loans Engine
- [x] Implement `POST /api/payments/bill` in Account Service (debit account, generate utility receipt for Electricity, Water, Internet, Mobile)
- [x] Implement `POST /api/loans/apply` in Account Service (calculate monthly amortization payment, store loan request)
- [x] Implement `GET /api/loans` and `GET /api/loans/:id` (return amortization schedule and payment status)

### 3.2 External Financial Ecosystem Mock Gateway (F12)
- [x] Implement mock external clearing endpoint `POST /api/transactions/external-transfer` in Transaction Service
- [x] Simulate ISO 8583 message clearing for VISA / Mastercard / SWIFT interbank remittances (with 99.9% clearing response)

---

## 🟣 Stage 4: Multi-Channel Notifications, Audit Trail & Admin Service

### 4.1 Notification Service (`services/notification-service` on port 3004)
- [ ] Initialize Express.js app with Prisma client and `nodemailer`
- [ ] Create Prisma schema for `notif_schema`:
  - [ ] `Notification` model (`id`, `userId`, `title`, `message`, `type`, `channel=EMAIL|PUSH`, `isRead`)
  - [ ] `AuditLog` model (`id`, `userId`, `action`, `resource`, `resourceId`, `ipAddress`, `details`, `hash`, `previousHash`)
- [ ] Implement HTML email sender using Nodemailer (Gmail SMTP or Mailtrap sandbox)
- [ ] Implement internal `POST /internal/notify` (store DB notification + send HTML email alert)
- [ ] Implement internal `POST /internal/email` (direct OTP email sender called by Auth Service)
- [ ] Build Cryptographic Hash-Chain Audit Engine (`POST /internal/audit`):
  - [ ] Retrieve last log record's `hash` (`prevHash`)
  - [ ] Calculate `hash = SHA256(prevHash + timestamp + action + userId + details)`
  - [ ] Store immutable audit record
- [ ] Implement `GET /api/notifications`, `PUT /api/notifications/:id/read`, and `PUT /api/notifications/read-all`
- [ ] Implement admin viewer `GET /api/audit` (searchable/filterable audit trail)
- [ ] Add `/health` endpoint

### 4.2 Admin Service (`services/admin-service` on port 3005)
- [ ] Initialize Express.js app with Prisma client
- [ ] Create Prisma schema for `admin_schema`:
  - [ ] `SystemMetric` model (`id`, `metricName`, `metricValue`, `recordedAt`)
  - [ ] `AdminAction` model (`id`, `adminUserId`, `action`, `targetUserId`, `reason`)
- [ ] Implement `GET /api/admin/dashboard` (aggregate total users, total transactions today, active accounts, uptime)
- [ ] Implement `GET /api/admin/users` (list all users with search, pagination, and role filters)
- [ ] Implement `PUT /api/admin/users/:id/suspend` and `PUT /api/admin/users/:id/verify` (KYC verification)
- [ ] Implement `GET /api/admin/fraud-alerts` (list flagged transactions from Transaction Service)
- [ ] Add `/health` endpoint

---

## 🔴 Stage 5: Next.js 14 Frontend UI, Testing & Submission Packaging

### 5.1 Next.js 14 Frontend (`client/`)
- [ ] Initialize Next.js 14 project (TypeScript, App Router, Tailwind CSS, shadcn/ui)
- [ ] Configure `lib/api.ts` (API wrapper client handling JWT cookie/header injection & auto-refresh)
- [ ] Build 3 Authentication Screens:
  - [ ] Login page (`/login`)
  - [ ] Registration page (`/register` with NIC validation)
  - [ ] OTP Verification page (`/verify-otp` with 6-digit input & countdown timer)
- [ ] Build 5 Customer Banking Screens:
  - [ ] Dashboard page (`/dashboard` — balance card, account selector, quick actions, recent transactions)
  - [ ] Send Money page (`/transfer` — recipient search, fee display, ACID transfer confirmation modal)
  - [ ] Transaction History page (`/transactions` — date/type filter tabs, paginated table, receipt download)
  - [ ] Bill Payments & Loans page (`/payments` — utility biller selector, loan application calculator)
  - [ ] Profile & Notifications page (`/profile` — KYC file dropzone, security alert list)
- [ ] Build Admin Panel Screen (`/admin`):
  - [ ] KPI Metrics Cards + Recharts line/bar graphs (24h transaction volume)
  - [ ] User Management table (Suspend account, Verify KYC button)
  - [ ] Fraud Alerts review modal + Cryptographic Audit Trail hash viewer

### 5.2 QA Automated Testing & CI/CD
- [ ] Write Jest + Supertest test suite for `auth-service` (registration, JWT generation, 5-attempt lockout)
- [ ] Write Jest + Supertest test suite for `transaction-service` (atomic transfer, insufficient funds rollback, fraud velocity flag)
- [ ] Write `.github/workflows/ci.yml` (ESLint linting -> Jest unit tests -> Docker Compose build test)
- [ ] Create database demo seed script (`npm run seed:demo`) prepopulating admin user, 2 test customers, and sample transactions

### 5.3 Documentation & Delivery
- [ ] Write `USER_GUIDE.md` (prerequisites, step-by-step Docker startup, architecture diagram, screenshots)
- [ ] Verify `docker compose up --build` boots clean on 0-dependency fresh machine
- [ ] Create clean submission ZIP file ready for duothan.ieeensbm.org
