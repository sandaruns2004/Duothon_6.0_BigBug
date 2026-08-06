# AegisVault — Complete System Architecture Guide

> **A senior developer's walkthrough of the entire codebase** — every file, every connection, every flow.

---

## Table of Contents

1. [What Is AegisVault?](#1-what-is-aegisvault)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure (File Map)](#4-project-structure-file-map)
5. [Infrastructure Layer](#5-infrastructure-layer)
   - 5.1 [PostgreSQL (Database)](#51-postgresql-database)
   - 5.2 [Redis (Cache & Rate Limiter)](#52-redis-cache--rate-limiter)
   - 5.3 [RabbitMQ (Message Broker)](#53-rabbitmq-message-broker)
6. [Microservices (Backend)](#6-microservices-backend)
   - 6.1 [API Gateway (Port 3000)](#61-api-gateway-port-3000)
   - 6.2 [Auth Service (Port 3001)](#62-auth-service-port-3001)
   - 6.3 [Account Service (Port 3002)](#63-account-service-port-3002)
   - 6.4 [Transaction Service (Port 3003)](#64-transaction-service-port-3003)
   - 6.5 [Notification Service (Port 3004)](#65-notification-service-port-3004)
   - 6.6 [Admin Service (Port 3005)](#66-admin-service-port-3005)
7. [Frontend (Next.js Client)](#7-frontend-nextjs-client)
8. [Docker & Container Orchestration](#8-docker--container-orchestration)
9. [CI/CD Pipeline (GitHub Actions)](#9-cicd-pipeline-github-actions)
10. [Azure Cloud Deployment](#10-azure-cloud-deployment)
11. [Key Data Flows (End-to-End)](#11-key-data-flows-end-to-end)
12. [Scripts & Tooling](#12-scripts--tooling)
13. [Security Architecture](#13-security-architecture)
14. [Complete File-by-File Reference](#14-complete-file-by-file-reference)

---

## 1. What Is AegisVault?

AegisVault is a **digital banking platform** built as a microservices architecture for the IEEE NSBM Duothon 6.0 competition. Think of it like a simplified version of how a real bank's backend works:

- Customers can **register**, **log in with MFA** (multi-factor authentication), **create bank accounts**, **transfer money**, **pay utility bills**, and **apply for loans**.
- Admins can **manage users**, **verify KYC documents**, **suspend/unlock accounts**, and **view fraud alerts**.
- Every financial action is recorded in a **tamper-evident cryptographic audit trail** (SHA-256 hash chain).
- A **rule-based fraud engine** flags suspicious transactions in real-time.
- **ISO 8583 clearing simulation** mimics real interbank payment networks (VISA/SWIFT).

---

## 2. High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        CLIENT["Next.js Frontend<br/>(Port 8080)"]
    end

    subgraph "Gateway Layer"
        GW["API Gateway<br/>(Port 3000)<br/>JWT Auth · Rate Limiter · Reverse Proxy"]
    end

    subgraph "Microservices Layer"
        AUTH["Auth Service<br/>(Port 3001)<br/>Registration · MFA · JWT · KYC"]
        ACCT["Account Service<br/>(Port 3002)<br/>Accounts · ACID Transfers · Loans · Bills"]
        TXN["Transaction Service<br/>(Port 3003)<br/>Transfer Orchestrator · Fraud · ISO 8583"]
        NOTIF["Notification Service<br/>(Port 3004)<br/>Email · In-App Alerts · Audit Engine"]
        ADMIN["Admin Service<br/>(Port 3005)<br/>Dashboard · User Governance · KYC Verify"]
    end

    subgraph "Infrastructure Layer"
        PG["PostgreSQL 16<br/>(Port 5433)<br/>5 Schemas: auth_db, acct_db, txn_db, notif_db, admin_db"]
        REDIS["Redis 7<br/>(Port 6379)<br/>OTP Cache · Rate Limit Counters"]
        RMQ["RabbitMQ 3<br/>(Ports 5672/15672)<br/>email_queue · notify_queue · audit_queue"]
    end

    subgraph "3rd Party Services"
        SMTP["SMTP (Mailtrap)<br/>Email Delivery"]
    end

    CLIENT -->|"HTTP/HTTPS"| GW
    GW -->|"Reverse Proxy"| AUTH
    GW -->|"Reverse Proxy"| ACCT
    GW -->|"Reverse Proxy"| TXN
    GW -->|"Reverse Proxy"| NOTIF
    GW -->|"Reverse Proxy"| ADMIN

    AUTH -->|"Prisma ORM"| PG
    ACCT -->|"Prisma ORM"| PG
    TXN -->|"Prisma ORM"| PG
    NOTIF -->|"Prisma ORM"| PG
    ADMIN -->|"Prisma ORM"| PG

    AUTH -->|"OTP Cache"| REDIS
    GW -->|"Rate Limit Store"| REDIS

    AUTH -->|"Publish email.send"| RMQ
    TXN -->|"Publish notify.send & audit.log"| RMQ
    RMQ -->|"Consume queues"| NOTIF

    TXN -->|"HTTP: Balance Check & Execute Transfer"| ACCT
    NOTIF -->|"Nodemailer"| SMTP
```

> [!IMPORTANT]
> The key insight: **the API Gateway is the ONLY public-facing service**. All client requests go through it. It authenticates the JWT, rate-limits, and then reverse-proxies the request to the correct internal microservice. The microservices never talk to the client directly.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (TypeScript) + Tailwind CSS + Framer Motion | Single-page app with SSR capability |
| **API Gateway** | Express.js + `http-proxy-middleware` | Reverse proxy, JWT auth, rate limiting |
| **Microservices** | Express.js (Node.js 20) | 5 independent REST API services |
| **ORM** | Prisma 5.11 (multi-schema) | Type-safe database access with migrations |
| **Database** | PostgreSQL 16 Alpine | ACID-compliant relational database |
| **Cache** | Redis 7 Alpine | OTP TTL storage, rate limit counters |
| **Message Broker** | RabbitMQ 3 Management Alpine | Async email, notification, and audit events |
| **Email** | Nodemailer + Mailtrap (sandbox) | Transactional email delivery |
| **Validation** | Zod | Runtime schema validation for all inputs |
| **Auth** | JWT (jsonwebtoken) + bcrypt (cost=12) | Token-based auth with password hashing |
| **Logging** | Winston | Structured JSON logging across all services |
| **Containers** | Docker + Docker Compose | Local development orchestration |
| **CI/CD** | GitHub Actions (2 workflows) | Automated testing, building, and deployment |
| **Cloud** | Azure Container Apps + Azure Container Registry | Production hosting |

---

## 4. Project Structure (File Map)

```
Duothon_6.0_BigBug/
├── .github/workflows/          # CI/CD Pipeline
│   ├── ci.yml                  # Continuous Integration (tests, lint, build check)
│   └── cd.yml                  # Continuous Deployment (build → push ACR → deploy Azure)
│
├── client/                     # Next.js 14 Frontend Application
│   ├── Dockerfile              # Multi-stage Docker build for client
│   ├── package.json            # Frontend dependencies (next, react, tailwind, axios, framer-motion)
│   ├── tailwind.config.ts      # Tailwind CSS design system configuration
│   ├── next.config.js          # Next.js configuration
│   ├── tsconfig.json           # TypeScript configuration
│   └── src/
│       ├── app/                # Next.js App Router pages
│       │   ├── layout.tsx      # Root layout (Navbar, footer, global styles)
│       │   ├── page.tsx        # Landing/home page
│       │   ├── globals.css     # Global CSS with design tokens
│       │   ├── login/          # Login page
│       │   ├── register/       # Registration page
│       │   ├── verify-otp/     # OTP verification page
│       │   ├── dashboard/      # Customer dashboard
│       │   ├── transfer/       # Fund transfer page
│       │   ├── transactions/   # Transaction history
│       │   ├── payments/       # Utility bill payments
│       │   ├── profile/        # User profile & KYC
│       │   ├── admin/          # Admin dashboard & governance
│       │   └── api/            # Next.js API routes (proxy)
│       ├── components/
│       │   └── Navbar.tsx      # Navigation bar component
│       └── lib/
│           └── api.ts          # Axios HTTP client with JWT auto-refresh
│
├── services/                   # Backend Microservices
│   ├── api-gateway/            # Reverse Proxy & Security Gateway
│   ├── auth-service/           # Authentication, MFA, JWT Tokens
│   ├── account-service/        # Bank Accounts, Transfers, Loans, Bills
│   ├── transaction-service/    # Transaction Orchestration, Fraud, ISO 8583
│   ├── notification-service/   # Email, Notifications, Audit Engine
│   └── admin-service/          # Admin Dashboard, Governance, Fraud Alerts
│
├── databases/
│   └── postgres/
│       └── Dockerfile          # Custom PostgreSQL container (init scripts)
│
├── infrastructure/
│   ├── provision.azcli         # Azure Container Apps provisioning script
│   └── provision-dbs.azcli    # Azure PostgreSQL/Redis provisioning
│
├── scripts/
│   ├── init-schemas.sql        # PostgreSQL schema initialization (5 schemas)
│   ├── seed-demo.js            # Demo data seeder (users, accounts, transactions)
│   ├── smoke-test.js           # E2E API smoke test (7-step validation)
│   ├── run-seed.sh             # Shell wrapper for seed script
│   └── package-submission.js   # Competition submission packager
│
├── docker-compose.yml          # Full 8-container orchestration
├── Dockerfile.template         # Standardized Dockerfile template for services
├── package.json                # Monorepo root (npm workspaces)
├── .env.example                # Environment variable template
├── .gitignore                  # Git ignore rules
└── .dockerignore               # Docker ignore rules
```

---

## 5. Infrastructure Layer

### 5.1 PostgreSQL (Database)

**What it does:** This is the single source of truth for ALL persistent data. Instead of running 5 separate database servers, the project uses **one PostgreSQL instance with 5 isolated schemas** — which is a smart architectural decision because:

1. It saves resources (only 1 DB container)
2. Each microservice still has complete data isolation
3. Cross-service queries are possible for the admin dashboard

**How it's configured:**

The [init-schemas.sql](../scripts/init-schemas.sql) script runs automatically when the PostgreSQL container starts (via Docker's `docker-entrypoint-initdb.d` mechanism). It creates these 5 schemas:

| Schema | Used By | Contains |
|--------|---------|----------|
| `auth_db` | Auth Service | `users`, `refresh_tokens`, `otp_records` |
| `acct_db` | Account Service | `accounts`, `loans`, `utility_receipts` |
| `txn_db` | Transaction Service | `transactions`, `fraud_alerts` |
| `notif_db` | Notification Service | `notifications`, `audit_logs` |
| `admin_db` | Admin Service | `users` (read), `accounts` (read), `transactions` (read), `system_metrics`, `admin_actions` |

Each service connects to the SAME PostgreSQL server but with a different `?schema=` parameter in the connection URL:

```
postgresql://aegis_admin:securep@ss123@postgres:5432/aegisvault?schema=auth_db
postgresql://aegis_admin:securep@ss123@postgres:5432/aegisvault?schema=acct_db
...
```

**Prisma ORM:** Every service has its own [schema.prisma](../services/auth-service/prisma/schema.prisma) file that defines the database models for that service. Prisma uses the `multiSchema` preview feature to target specific PostgreSQL schemas. The generated client code lives in `prisma/generated/client/`.

> [!NOTE]
> **Schema push on startup**: The auth service runs `npx prisma db push` on startup to auto-sync its schema with PostgreSQL. This means the tables are created automatically — no manual migration step needed.

---

### 5.2 Redis (Cache & Rate Limiter)

**What it does:** Redis serves two purposes in this architecture:

1. **OTP Caching (Auth Service):** When a user logs in, a 6-digit OTP is generated and stored in Redis with a 5-minute TTL (`aegis_otp:login:<email>`). This makes OTP verification instant without hitting the database.

2. **Rate Limiting (API Gateway):** The rate limiter stores request counters in Redis using the `rate-limit-redis` package. Keys are prefixed with `aegis_rl_public:` or `aegis_rl_auth:`.

**Graceful fallback:** If Redis goes down, neither feature crashes:
- The **rate limiter** falls back to an in-memory store (see [rateLimiter.js](../services/api-gateway/src/middleware/rateLimiter.js))
- The **OTP check** falls back to querying the `otp_records` PostgreSQL table (see [auth.controller.js](../services/auth-service/src/controllers/auth.controller.js#L241))

---

### 5.3 RabbitMQ (Message Broker)

**What it does:** RabbitMQ handles **asynchronous communication** between services. When something happens (e.g., a transaction completes), the originating service publishes a message to RabbitMQ, and the Notification Service picks it up later. This is called the **producer-consumer pattern**.

**Exchanges & Queues:**

```mermaid
graph LR
    subgraph "Producers"
        AUTH_P["Auth Service"]
        TXN_P["Transaction Service"]
    end

    subgraph "Exchanges"
        CMD["aegisvault.commands<br/>(direct exchange)"]
        EVT["aegisvault.events<br/>(topic exchange)"]
    end

    subgraph "Queues"
        EQ["email_queue"]
        NQ["notify_queue"]
        AQ["audit_queue"]
    end

    subgraph "Consumer"
        NOTIF_C["Notification Service"]
    end

    AUTH_P -->|"email.send"| CMD
    TXN_P -->|"notify.send"| CMD
    TXN_P -->|"audit.log"| EVT

    CMD -->|"routing: email.send"| EQ
    CMD -->|"routing: notify.send"| NQ
    EVT -->|"routing: audit.log"| AQ

    EQ --> NOTIF_C
    NQ --> NOTIF_C
    AQ --> NOTIF_C
```

| Queue | Exchange | Routing Key | What Triggers It | What Happens |
|-------|----------|-------------|------------------|--------------|
| `email_queue` | `aegisvault.commands` (direct) | `email.send` | Auth Service login (OTP email) | Sends HTML email via Nodemailer |
| `notify_queue` | `aegisvault.commands` (direct) | `notify.send` | Transaction completes | Stores DB notification + sends alert email |
| `audit_queue` | `aegisvault.events` (topic) | `audit.log` | Transaction completes | Records SHA-256 audit log entry |

> [!TIP]
> **Why two exchanges?** The `commands` exchange uses **direct routing** (exact match — "send this email to this person"). The `events` exchange uses **topic routing** (pattern-based — any subscriber interested in audit events can listen).

---

## 6. Microservices (Backend)

Every microservice follows the same internal structure:

```
service-name/
├── Dockerfile          # Container image build instructions
├── package.json        # Dependencies & scripts
├── init.sql            # Raw SQL reference (not used at runtime)
├── prisma/
│   ├── schema.prisma   # Prisma data model definition
│   └── generated/      # Auto-generated Prisma client
└── src/
    ├── index.js        # Express app entry point & server startup
    ├── config/
    │   ├── db.js       # Prisma client initialization
    │   ├── logger.js   # Winston structured JSON logger
    │   └── redis.js    # Redis client (auth-service only)
    ├── controllers/    # Business logic (the "brains")
    ├── routes/         # Express route definitions (URL → controller mapping)
    └── utils/          # Shared utility modules
```

---

### 6.1 API Gateway (Port 3000)

**Purpose:** The API Gateway is the **single entry point** for all client requests. It's like a security guard + traffic cop combined.

**File breakdown:**

#### [index.js](../services/api-gateway/src/index.js) — Entry point
Sets up the Express app with this middleware pipeline (order matters!):
1. **CORS** — Allows cross-origin requests from the frontend
2. **Helmet** — Sets security HTTP headers (X-Frame-Options, CSP, etc.)
3. **Request Logger** — Logs every HTTP request in structured JSON
4. **Body Parser** — Parses JSON request bodies (up to 10MB)
5. **Rate Limiters** — Throttles requests per IP/user
6. **JWT Auth** — Validates Bearer tokens and injects `x-user-*` headers
7. **Reverse Proxy** — Forwards requests to the correct microservice
8. **404 Handler** — Catches unmatched routes
9. **Error Handler** — Global exception handler

#### [middleware/jwtAuth.js](../services/api-gateway/src/middleware/jwtAuth.js) — JWT Authentication
- Maintains a **whitelist** of public routes that don't need authentication (login, register, verify-otp, health)
- For protected routes, extracts the JWT from the `Authorization: Bearer <token>` header OR from cookies
- Verifies the JWT signature using the shared secret
- **Key behavior:** After verification, it **injects three headers** into the request before forwarding:
  - `x-user-id` — The authenticated user's ID
  - `x-user-role` — CUSTOMER / ADMIN / OFFICER
  - `x-user-email` — The user's email
- These headers are how downstream microservices know *who* is making the request without having to verify the JWT themselves

#### [middleware/proxy.js](../services/api-gateway/src/middleware/proxy.js) — Reverse Proxy
- Uses `http-proxy-middleware` to forward requests to backend services
- Route mapping:
  - `/api/auth/*` and `/api/users/*` → Auth Service (`:3001`)
  - `/api/accounts/*`, `/api/payments/*`, `/api/loans/*` → Account Service (`:3002`)
  - `/api/transactions/*` → Transaction Service (`:3003`)
  - `/api/notifications/*`, `/api/audit/*` → Notification Service (`:3004`)
  - `/api/admin/*` → Admin Service (`:3005`)
- Forwards the `x-user-id`, `x-user-role`, `x-user-email` headers to downstream services
- Uses `fixRequestBody` to ensure JSON bodies stream correctly through the proxy
- Returns `503 Service Unavailable` if a backend service is unreachable

#### [middleware/rateLimiter.js](../services/api-gateway/src/middleware/rateLimiter.js) — Rate Limiting
- **Public rate limiter** (`/api/auth/*`): 20 requests/minute per IP
- **Authenticated rate limiter** (`/api/*`): 100 requests/minute per user ID (or IP if unauthenticated)
- Uses Redis as backing store when available; falls back to in-memory store otherwise

#### [config/redis.js](../services/api-gateway/src/config/redis.js) — Redis Client
- Connects to Redis using `ioredis` with retry logic
- `lazyConnect: true` means it doesn't crash on startup if Redis is unavailable
- Exports a `checkRedisConnected()` helper used by the rate limiter

#### [config/logger.js](../services/api-gateway/src/config/logger.js) — Winston Logger
- Outputs structured JSON logs with timestamps
- The `requestLogger` middleware logs every HTTP request completion with: method, path, status code, duration, user ID, and user agent
- Logs are color-coded by severity: `>=500` → error, `>=400` → warn, else → info

---

### 6.2 Auth Service (Port 3001)

**Purpose:** Handles everything related to user identity — registration, MFA login, OTP verification, JWT token issuance, token refresh, user profiles, and KYC verification.

**File breakdown:**

#### [index.js](../services/auth-service/src/index.js) — Entry point
- **Special startup behavior:** Runs `initDatabaseAndSeed()` before starting the server which:
  1. Runs `prisma db push` to sync the schema with PostgreSQL (creates tables if they don't exist)
  2. Seeds a demo customer (`customer1@aegisvault.com`)
  3. Seeds a demo admin (`admin@aegisvault.com`)
- Mounts routes on both `/api/auth` and `/auth` prefixes for flexible proxy compatibility

#### [controllers/auth.controller.js](../services/auth-service/src/controllers/auth.controller.js) — Auth Business Logic

**`POST /api/auth/register`** — User Registration
- Checks for duplicate email/phone/NIC
- Hashes password with bcrypt (cost factor = 12, which takes ~250ms — slow enough to resist brute force)
- Creates user with `kycStatus: 'PENDING'`

**`POST /api/auth/login`** — MFA Login (Step 1)
- Verifies email/password credentials
- **Account lockout:** After 5 consecutive failed password attempts, the account is permanently locked (`isLocked: true`). An admin must unlock it.
- On success: generates a 6-digit OTP, hashes it with SHA-256, stores it in Redis with a 5-minute TTL AND in the `otp_records` database table
- Sends the OTP via RabbitMQ → Notification Service → Email
- Returns `requireMfa: true` (tells the frontend to show the OTP form)

**`POST /api/auth/verify-otp`** — MFA Verification (Step 2)
- Accepts the 6-digit OTP from the user
- Looks up the hash from Redis first; falls back to database if Redis is down
- Verifies using **constant-time comparison** (`crypto.timingSafeEqual`) to prevent timing attacks
- **Demo backdoor:** OTP `123456` always works (for competition judges)
- On success: issues two JWT tokens:
  - **Access Token** (15-minute expiry) — used for API authorization
  - **Refresh Token** (7-day expiry) — used to get new access tokens without re-login

**`POST /api/auth/refresh`** — Token Refresh
- Validates the refresh token JWT signature
- Looks up the hashed refresh token in the `refresh_tokens` database table
- Issues a new 15-minute access token

#### [controllers/user.controller.js](../services/auth-service/src/controllers/user.controller.js) — User Profile
- `GET /api/users/profile` — Returns the authenticated user's profile data
- `PUT /api/users/profile` — Updates email/phone with duplicate checking
- `POST /api/users/kyc` — Submits KYC document reference and auto-verifies

#### [utils/otp.js](../services/auth-service/src/utils/otp.js) — OTP Utilities
- `generateNumericOtp(6)` — Uses `crypto.randomInt()` for cryptographically secure random generation
- `hashOtp(otp)` — SHA-256 hash for storage (never store plaintext OTPs!)
- `verifyOtpHash(otp, hash)` — Constant-time comparison
- `sendOtpEmail(email, otp)` — Publishes the OTP email command to RabbitMQ

#### [utils/rabbitmq.js](../services/auth-service/src/utils/rabbitmq.js) — RabbitMQ Client
- Uses `amqp-connection-manager` for automatic reconnection
- Asserts two exchanges on startup:
  - `aegisvault.commands` (direct) — for command messages
  - `aegisvault.events` (topic) — for event messages
- `publishCommand(routingKey, message)` — Publishes to the commands exchange
- `publishEvent(routingKey, message)` — Publishes to the events exchange
- Messages are `persistent: true` (survives RabbitMQ restart)

#### [utils/validation.js](../services/auth-service/src/utils/validation.js) — Input Validation
- Uses **Zod** schemas to validate all request bodies
- Password policy: min 8 chars, must contain uppercase + lowercase + number + special character
- The `validate(schema)` middleware factory parses `req.body` and returns structured 400 errors if validation fails

#### [prisma/schema.prisma](../services/auth-service/prisma/schema.prisma) — Database Schema
- **User** — id, email, phone, NIC, passwordHash, role (CUSTOMER/ADMIN/OFFICER), failedAttempts, isLocked, kycStatus (PENDING/VERIFIED/REJECTED)
- **RefreshToken** — userId → User, tokenHash, expiresAt
- **OtpRecord** — userId → User, otpHash, type (MFA_LOGIN), expiresAt

---

### 6.3 Account Service (Port 3002)

**Purpose:** Manages bank accounts, balances, ACID-compliant fund transfers, utility bill payments, and loan applications.

**File breakdown:**

#### [controllers/account.controller.js](../services/account-service/src/controllers/account.controller.js) — Account & Transfer Logic

**`POST /api/accounts`** — Create Bank Account
- Auto-generates a 12-digit account number
- Sets initial deposit balance
- Account types: SAVINGS, CURRENT, BUSINESS

**`GET /api/accounts`** — List User Accounts
- Returns all accounts owned by the authenticated user

**`GET /api/accounts/:id/balance`** — Balance Check
- Looks up by UUID or account number
- Used internally by the Transaction Service for pre-transfer validation

**`POST /api/accounts/execute-transfer`** — ACID Fund Transfer ⚡
- This is the most critical endpoint. It executes an **atomic SQL transaction** using `prisma.$transaction()`:
  1. Lock & fetch sender account → verify it's ACTIVE
  2. Verify sufficient funds (balance ≥ amount)
  3. Lock & fetch receiver account → verify it's ACTIVE and different from sender
  4. `Debit sender` (balance -= amount)
  5. `Credit receiver` (balance += amount)
- If ANY step fails, the entire transaction **rolls back** automatically. This is ACID compliance — either both balances change, or neither does.

**`POST /api/payments/bill`** — Utility Bill Payment
- Debits the account and creates a `UtilityReceipt` record with a unique receipt number

**`POST /api/accounts/debit` & `POST /api/accounts/credit`** — Direct Balance Modifications
- Used by the Transaction Service for external transfers
- Both use `prisma.$transaction` for atomicity

#### [controllers/loan.controller.js](../services/account-service/src/controllers/loan.controller.js) — Loan Management

**`POST /api/loans/apply`** — Apply for a Loan
- Calculates fixed monthly amortization payment using the standard formula: `P * r(1+r)^n / ((1+r)^n - 1)`
- Generates a full monthly repayment schedule
- If approved, credits the loan amount to the target account

**`GET /api/loans`** — List Loans with amortization schedules
**`GET /api/loans/:id`** — Single loan details
**`POST /api/loans/calculate`** — Calculator only (no DB write)

#### [prisma/schema.prisma](../services/account-service/prisma/schema.prisma) — Database Schema
- **Account** — userId, accountNumber (unique), accountType, balance (Decimal 15,2), currency (LKR), status (ACTIVE/FROZEN/CLOSED)
- **Loan** — userId, accountId → Account, amount, interestRate, termMonths, monthlyPayment, status (PENDING/APPROVED/ACTIVE/PAID)
- **UtilityReceipt** — userId, accountId → Account, biller, amount, receiptNumber (unique), status

---

### 6.4 Transaction Service (Port 3003)

**Purpose:** The transaction orchestrator — it coordinates between the Account Service, Fraud Engine, ISO 8583 Simulator, and Notification Service to process fund transfers.

**File breakdown:**

#### [controllers/transaction.controller.js](../services/transaction-service/src/controllers/transaction.controller.js) — Transfer Orchestration

**`POST /api/transactions/transfer`** — Internal Transfer (the main flow):

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant TxnSvc as Transaction Service
    participant FraudEng as Fraud Engine
    participant AcctSvc as Account Service
    participant RMQ as RabbitMQ
    participant NotifSvc as Notification Service

    Client->>Gateway: POST /api/transactions/transfer
    Gateway->>Gateway: JWT Verify + Rate Limit
    Gateway->>TxnSvc: Proxy (with x-user-* headers)
    
    TxnSvc->>AcctSvc: GET /api/accounts/{id}/balance
    AcctSvc-->>TxnSvc: Balance & Status
    
    TxnSvc->>FraudEng: evaluateFraudRules(amount, accounts)
    FraudEng-->>TxnSvc: {isFlagged, triggeredRules, riskScore}
    
    TxnSvc->>AcctSvc: POST /api/accounts/execute-transfer
    AcctSvc->>AcctSvc: BEGIN → Debit → Credit → COMMIT
    AcctSvc-->>TxnSvc: Transfer result
    
    TxnSvc->>TxnSvc: Save transaction record in txn_db
    TxnSvc->>TxnSvc: Save fraud alerts (if flagged)
    
    TxnSvc->>RMQ: Publish notify.send + audit.log (fire-and-forget)
    TxnSvc-->>Client: 201 {transaction, fraudAlerts}
    
    RMQ->>NotifSvc: Consume messages
    NotifSvc->>NotifSvc: Store notification + Send email
    NotifSvc->>NotifSvc: Record SHA-256 audit log
```

1. **Balance pre-check** via HTTP GET to Account Service
2. **Fraud detection** via the rule-based engine (3 rules)
3. **Execute transfer** via HTTP POST to Account Service (ACID transaction)
4. **Store transaction record** in txn_db schema
5. **Store fraud alerts** if any rules triggered
6. **Dispatch async notifications** via RabbitMQ (fire-and-forget — doesn't block the response)

**`POST /api/transactions/external-transfer`** — External/Interbank Transfer
- Same flow but adds **ISO 8583 clearing simulation** before debiting
- Uses debit/credit endpoints instead of execute-transfer
- Simulates VISA/Mastercard/SWIFT/CEFT payment networks

**`GET /api/transactions`** — Paginated Transaction History (with type/date filters)
**`GET /api/transactions/:id`** — Single Transaction Details
**`GET /api/transactions/:id/receipt`** — Formatted Receipt

#### [utils/fraudEngine.js](../services/transaction-service/src/utils/fraudEngine.js) — Fraud Detection Engine

Three real-time rules:

| Rule | Condition | Risk Score |
|------|-----------|------------|
| `RULE_1_HIGH_AMOUNT` | Amount > 500,000 LKR | 40 |
| `RULE_2_HIGH_VELOCITY` | > 3 transfers in 10 minutes from same account | 35 |
| `RULE_3_NEW_RECIPIENT_LARGE_AMOUNT` | Amount > 100,000 LKR to never-before-used recipient | 25 |

If ANY rule triggers, the transaction is marked as `FLAGGED` (but still executes — it doesn't block the transfer, just flags it for admin review).

> [!NOTE]
> The fraud engine fails safe: if a database query errors during rule evaluation, it returns `isFlagged: false` rather than blocking the transaction.

#### [utils/iso8583.js](../services/transaction-service/src/utils/iso8583.js) — ISO 8583 Clearing Simulator
- Simulates the real-world financial message format used by VISA/Mastercard
- Generates MTI codes (0200 request / 0210 response), STAN, RRN, Auth Codes
- 99.9% success rate (0.1% simulated decline for realism)
- Response codes: `00` (approved), `05` (do not honor), `91` (issuer switch inoperative)

#### [utils/notifier.js](../services/transaction-service/src/utils/notifier.js) — Async Notification Dispatcher
- Uses `setImmediate()` for **fire-and-forget** execution — the API response returns immediately while notifications are sent in the background
- Publishes two messages to RabbitMQ:
  1. `notify.send` to commands exchange (triggers email notification)
  2. `audit.log` to events exchange (triggers cryptographic audit record)

---

### 6.5 Notification Service (Port 3004)

**Purpose:** The notification hub — handles email delivery, in-app notifications, and the **cryptographic SHA-256 audit trail engine**. It's the only service that actively **consumes** RabbitMQ messages.

**File breakdown:**

#### [index.js](../services/notification-service/src/index.js) — Entry point
- After server starts, connects to RabbitMQ and starts 3 consumers:
  - `email_queue` → `handleEmailMessage`
  - `notify_queue` → `handleNotifyMessage`
  - `audit_queue` → `handleAuditMessage`

#### [consumers/index.js](../services/notification-service/src/consumers/index.js) — RabbitMQ Consumer Handlers
- Creates **mock Express req/res objects** to pass RabbitMQ message payloads into the existing Express controllers — this is a clever reuse pattern that avoids duplicating business logic

#### [controllers/notification.controller.js](../services/notification-service/src/controllers/notification.controller.js) — Notification Logic
- `POST /internal/notify` — Stores a `Notification` record in DB AND sends HTML email
- `POST /internal/email` — Direct email sending (used for OTP emails)
- `GET /api/notifications` — Paginated user notifications with unread count
- `PUT /api/notifications/:id/read` — Mark single notification as read
- `PUT /api/notifications/read-all` — Batch mark all as read

#### [controllers/audit.controller.js](../services/notification-service/src/controllers/audit.controller.js) — Audit Trail
- `POST /internal/audit` — Records an immutable audit log entry in the hash chain
- `GET /api/audit` — Searchable, filterable admin viewer for audit logs
- `GET /api/audit/verify-chain` — Mathematically verifies the entire hash chain integrity

#### [utils/auditEngine.js](../services/notification-service/src/utils/auditEngine.js) — Cryptographic Hash Chain Engine

This is one of the most interesting parts of the system. Here's how it works:

1. Every audit record has a `hash` and a `previousHash` field
2. The first record's `previousHash` is a genesis hash (`0000...0000`)
3. Each new record's hash = `SHA256(previousHash | timestamp | action | userId | details)`
4. This creates a **blockchain-like chain** where changing any historical record would break all subsequent hashes

**Verification algorithm:**
- Reads ALL audit logs in chronological order
- For each log, recalculates what its hash SHOULD be based on its data and previousHash
- If ANY calculated hash doesn't match the stored hash → the chain is broken (data was tampered with)

#### [utils/mailer.js](../services/notification-service/src/utils/mailer.js) — Email Sender
- Uses **Nodemailer** to send HTML emails via SMTP
- Configured for **Mailtrap** (email testing sandbox) by default
- In dev/sandbox mode, **simulates email delivery** instantly (logs the email content and returns success) — this ensures the flow never blocks even without a real SMTP server
- Includes branded HTML email templates for OTP codes and transaction alerts

---

### 6.6 Admin Service (Port 3005)

**Purpose:** Back-office administration — dashboard metrics aggregation, user governance, KYC verification, and fraud alert monitoring.

#### [controllers/admin.controller.js](../services/admin-service/src/controllers/admin.controller.js) — Admin Logic

> [!IMPORTANT]
> The Admin Service has a **special database setup**: its Prisma schema includes models from auth_db, acct_db, AND txn_db schemas. This lets it run cross-schema aggregation queries that individual services can't do alone.

**`GET /api/admin/dashboard`** — Real-time Platform Metrics
- Total registered users
- Users pending KYC
- Active bank accounts
- Today's transaction count
- Flagged transactions count
- Service uptime
- Asynchronously stores metric snapshots for historical tracking

**`GET /api/admin/users`** — User Management (with search/filter/pagination)
**`PUT /api/admin/users/:id/suspend`** — Lock a user account (records AdminAction)
**`PUT /api/admin/users/:id/verify`** — Approve KYC verification
**`PUT /api/admin/users/:id/unlock`** — Unlock a locked account (resets failed attempts)
**`GET /api/admin/fraud-alerts`** — Lists all flagged transactions

---

## 7. Frontend (Next.js Client)

**Purpose:** A server-rendered React application that provides the user interface for customers and admins.

#### [client/src/lib/api.ts](../client/src/lib/api.ts) — API Client (The Heart of Frontend Communication)

This is the most important frontend file. It creates an **Axios instance** with two interceptors:

1. **Request interceptor:** Automatically attaches the JWT access token from cookies/localStorage to every request's `Authorization` header
2. **Response interceptor:** If a 401 is received (token expired):
   - Queues all pending requests
   - Attempts to refresh the token using the refresh token
   - If refresh succeeds, retries all queued requests with the new token
   - If refresh fails, clears tokens and redirects to `/login`

This implements the **silent token refresh pattern** — the user never sees an error when their 15-minute access token expires.

**API wrapper methods** provide clean function calls:
```typescript
authApi.login({email, password})     // POST /api/auth/login
accountApi.getAccounts()             // GET /api/accounts
txnApi.getTransactions()             // GET /api/transactions
adminApi.getDashboard()              // GET /api/admin/dashboard
```

#### [client/src/app/layout.tsx](../client/src/app/layout.tsx) — Root Layout
- Sets dark mode by default (`className="dark"`)
- Renders the `Navbar` component on every page
- Footer with "Cryptographic Audit Chain: ACTIVE" status indicator

#### [client/src/app/page.tsx](../client/src/app/page.tsx) — Landing Page
- Hero section with animated text using Framer Motion
- Three feature cards: Cryptographic Audit, ACID Transfers, Fraud Detection
- CTAs: Launch Dashboard, Customer Sign In, Open Account

#### Frontend Pages:
| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | Landing page with feature highlights |
| Login | `/login` | Email/password login form |
| Register | `/register` | New user registration form |
| Verify OTP | `/verify-otp` | 6-digit MFA code entry |
| Dashboard | `/dashboard` | Customer account overview |
| Transfer | `/transfer` | Fund transfer form |
| Transactions | `/transactions` | Transaction history table |
| Payments | `/payments` | Utility bill payment form |
| Profile | `/profile` | User profile & KYC upload |
| Admin | `/admin` | Admin dashboard, user management, fraud alerts |

---

## 8. Docker & Container Orchestration

### [docker-compose.yml](../docker-compose.yml) — Full Stack Orchestration

This file defines **8 containers** that work together:

```mermaid
graph TB
    subgraph "Docker Network: aegisvault-network"
        PG["postgres<br/>:5432→5433"]
        REDIS["redis<br/>:6379"]
        RMQ["rabbitmq<br/>:5672, :15672"]
        
        AUTH["auth-service<br/>:3001"]
        ACCT["account-service<br/>:3002"]
        TXN["transaction-service<br/>:3003"]
        NOTIF["notification-service<br/>:3004"]
        ADMIN["admin-service<br/>:3005"]
        
        GW["api-gateway<br/>:3000"]
        CLI["client<br/>:8080→3000"]
    end

    PG -.->|"healthcheck"| AUTH
    PG -.->|"healthcheck"| ACCT
    PG -.->|"healthcheck"| TXN
    PG -.->|"healthcheck"| NOTIF
    PG -.->|"healthcheck"| ADMIN
    
    REDIS -.->|"healthcheck"| AUTH
    REDIS -.->|"healthcheck"| GW
    
    RMQ -.->|"healthcheck"| AUTH
    RMQ -.->|"healthcheck"| TXN
    RMQ -.->|"healthcheck"| NOTIF
    RMQ -.->|"healthcheck"| GW
```

**Startup order (via `depends_on` with `condition`):**
1. PostgreSQL, Redis, RabbitMQ start first (with health checks)
2. Auth, Account, Transaction, Notification, Admin services start once their dependencies are healthy
3. API Gateway starts once all backend services have started
4. Client starts once the API Gateway is running

**Health checks ensure services start in the correct order:**
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- RabbitMQ: `rabbitmq-diagnostics -q ping`

**Key configuration:**
- All containers are on the same Docker bridge network (`aegisvault-network`)
- PostgreSQL data is persisted via a Docker volume (`pgdata`)
- The init SQL script is mounted into the PostgreSQL container's init directory
- Client is exposed on port `8080` externally, mapped to `3000` internally

### Individual Dockerfiles

| Service | Key Details |
|---------|-------------|
| [API Gateway Dockerfile](../services/api-gateway/Dockerfile) | Single-stage, `--omit=dev` (no dev dependencies) |
| [Auth Service Dockerfile](../services/auth-service/Dockerfile) | Installs `openssl` (needed by Prisma), runs `prisma generate` |
| [Client Dockerfile](../client/Dockerfile) | Multi-stage: builder (npm build) → runner (npm start) |
| [Dockerfile.template](../Dockerfile.template) | Reference template with multi-stage build, non-root user |

---

## 9. CI/CD Pipeline (GitHub Actions)

### [ci.yml](../.github/workflows/ci.yml) — Continuous Integration

**Triggers:** Push or PR to `main`, `master`, or `develop` branches.

**3 parallel jobs:**

```mermaid
graph LR
    subgraph "CI Pipeline"
        UT["unit-tests<br/>Auth + Transaction Jest tests"]
        FC["frontend-check<br/>Next.js build verification"]
        DC["docker-compose-test<br/>Compose config + dry-run build"]
    end
    
    UT --> DC
    FC --> DC
```

1. **unit-tests** — Installs dependencies and runs `npm test` for auth-service and transaction-service
2. **frontend-check** — Installs dependencies and runs `npm run build` on the client
3. **docker-compose-test** — Runs after both above pass:
   - `docker compose config` — Validates the compose file syntax
   - `docker compose build --no-cache` — Dry-run build of 3 core services

### [cd.yml](../.github/workflows/cd.yml) — Continuous Deployment

**Triggers:** Push to `main` or `master` only.

**3-stage pipeline:**

```mermaid
graph LR
    DETECT["1. Detect Changes<br/>(paths-filter)"] --> BUILD["2. Build & Push<br/>(Docker → ACR)"] --> DEPLOY["3. Deploy<br/>(Azure Container Apps)"]
```

**Stage 1: Change Detection** (`dorny/paths-filter`)
- Detects which services actually changed in the commit
- Only modified services get rebuilt and redeployed (saves CI minutes!)
- Filters: `services/auth-service/**`, `services/account-service/**`, `client/**`, etc.

**Stage 2: Build & Push** (matrix strategy)
- Runs in parallel for each changed service
- Logs into Azure Container Registry (ACR)
- Builds Docker image with the service's Dockerfile
- Tags with both `sha-hash` and `latest`
- Pushes to ACR
- **Special handling:** For the `seed-job`, it dynamically generates a `Dockerfile.seed` that includes all Prisma schemas

**Stage 3: Deploy**
- Logs into Azure via service principal credentials
- Fetches the internal FQDN of each Container App (needed for service-to-service URLs)
- Updates only the modified Container Apps with:
  - New image tag
  - Updated environment variables (DATABASE_URL, service URLs, secrets)
- Deploys all modified services **in parallel** using background `&` and `wait`
- Finally, runs the **seed job** as a manual Container App Job to prepopulate demo data

**Required GitHub Secrets:**

| Secret | Purpose |
|--------|---------|
| `REGISTRY_LOGIN_SERVER` | ACR hostname (e.g., `aegisvaultacr.azurecr.io`) |
| `REGISTRY_USERNAME` | ACR admin username |
| `REGISTRY_PASSWORD` | ACR admin password |
| `AZURE_CREDENTIALS` | Azure service principal JSON |
| `JWT_SECRET` | JWT signing key |
| `DB_PASSWORD` | PostgreSQL password |
| `SMTP_USERNAME` | Mailtrap SMTP user |
| `SMTP_PASSWORD` | Mailtrap SMTP password |

---

## 10. Azure Cloud Deployment

### [infrastructure/provision.azcli](../infrastructure/provision.azcli) — Azure Infrastructure Setup

This is a one-time provisioning script that creates the Azure resources:

1. **Resource Group** (`aegisvault-rg`) — logical container for all resources
2. **Azure Container Registry** (Basic tier) — private Docker registry to store images
3. **Container Apps Environment** — shared infrastructure for all Container Apps
4. **7 Container Apps** (created with a placeholder image):
   - 5 internal services (no public internet access): auth, account, transaction, notification, admin
   - 2 external services (public): api-gateway, client
   - All start with `min-replicas: 0` (scale to zero when idle)

After provisioning, the script outputs the ACR credentials that need to be added to GitHub Secrets.

---

## 11. Key Data Flows (End-to-End)

### Flow 1: User Registration & MFA Login

```
1. User fills registration form on /register
2. Frontend POST /api/auth/register → Gateway → Auth Service
3. Auth Service: validate inputs, check duplicates, bcrypt hash password, create User
4. User fills login form on /login
5. Frontend POST /api/auth/login → Gateway → Auth Service
6. Auth Service: verify password, generate 6-digit OTP, store hash in Redis (5min TTL)
7. Auth Service → RabbitMQ (email.send) → Notification Service → Email with OTP
8. Frontend redirects to /verify-otp
9. User enters OTP code
10. Frontend POST /api/auth/verify-otp → Gateway → Auth Service
11. Auth Service: verify OTP hash, issue access token (15m) + refresh token (7d)
12. Frontend stores tokens in cookies + localStorage
13. Frontend redirects to /dashboard
```

### Flow 2: Fund Transfer with Fraud Check

```
1. User fills transfer form on /transfer (from account, to account, amount)
2. Frontend POST /api/transactions/transfer → Gateway (JWT verify) → Transaction Service
3. Transaction Service → GET Account Service /balance (pre-check)
4. Transaction Service → Fraud Engine (3 rules evaluated in real-time)
5. Transaction Service → POST Account Service /execute-transfer (ACID SQL transaction)
6. Transaction Service: save Transaction record + FraudAlert records
7. Transaction Service → RabbitMQ (notify.send + audit.log) [fire-and-forget]
8. Transaction Service → Client: 201 response with transaction + fraud info
9. [Background] RabbitMQ → Notification Service:
   a. Store Notification in DB
   b. Send HTML alert email
   c. Record SHA-256 audit log entry
```

### Flow 3: Admin Dashboard & Governance

```
1. Admin logs in via MFA flow (same as customer)
2. Frontend GET /api/admin/dashboard → Gateway → Admin Service
3. Admin Service: parallel aggregate queries across auth_db + acct_db + txn_db schemas
4. Returns: total users, pending KYC, active accounts, today's transactions, flagged count
5. Admin clicks "Suspend User" on a user
6. Frontend PUT /api/admin/users/:id/suspend → Gateway → Admin Service
7. Admin Service: set isLocked=true on user, create AdminAction audit record
```

---

## 12. Scripts & Tooling

### [scripts/seed-demo.js](../scripts/seed-demo.js) — Database Seeder

Prepopulates the database with demo data for testing:
1. **Schema sync** — Runs `prisma db push` for all 5 services
2. **Admin user** — `admin@aegisvault.com` / `AdminSecure2026!`
3. **Customer 1** — `customer1@aegisvault.com` / `CustomerSecure2026!` → Account `810000000001` (LKR 1,500,000)
4. **Customer 2** — `customer2@aegisvault.com` / `CustomerSecure2026!` → Account `810000000002` (LKR 750,000)
5. **Sample transactions** — 1 normal transfer, 1 fraud-flagged transaction (650,000 LKR)
6. **Audit trail genesis** — Initial SHA-256 hash chain entry

### [scripts/smoke-test.js](../scripts/smoke-test.js) — E2E Smoke Test

A 7-step automated test that validates the entire platform is operational:
1. Health check (`/health`)
2. Admin login request (MFA step 1)
3. Admin OTP verification (using demo code `123456`)
4. SHA-256 audit trail query
5. Customer login + OTP verification
6. Customer account listing
7. Customer transaction history

Run with: `npm run test:e2e` or `node scripts/smoke-test.js`

### [scripts/init-schemas.sql](../scripts/init-schemas.sql) — DB Initialization
Creates the 5 PostgreSQL schemas and grants permissions to the `aegis_admin` role.

### [package.json](../package.json) — Root Monorepo

```json
"workspaces": ["services/*", "client"]   // npm workspace configuration
"scripts": {
  "docker:up": "docker compose up --build",
  "docker:down": "docker compose down",
  "docker:clean": "docker compose down -v",  // removes volumes too
  "seed:demo": "node scripts/seed-demo.js",
  "test:e2e": "node scripts/smoke-test.js"
}
```

---

## 13. Security Architecture

| Feature | Implementation | Location |
|---------|---------------|----------|
| **Password Hashing** | bcrypt with cost factor 12 | Auth Service |
| **JWT Authentication** | HS256, 15min access / 7d refresh | Auth Service + Gateway |
| **MFA (Multi-Factor Auth)** | 6-digit OTP via email, 5-min TTL | Auth Service + Redis |
| **Rate Limiting** | 20 req/min public, 100 req/min authenticated | API Gateway + Redis |
| **Input Validation** | Zod schemas on every endpoint | All services |
| **OTP Security** | SHA-256 hash storage, constant-time comparison | Auth Service |
| **Account Lockout** | 5 failed attempts → permanent lock | Auth Service |
| **CORS Protection** | Configurable allowed origins | All services (Helmet) |
| **Security Headers** | X-Frame-Options, CSP, HSTS, etc. | Helmet middleware |
| **Audit Trail** | SHA-256 cryptographic hash chain | Notification Service |
| **Fraud Detection** | 3 real-time rules (amount, velocity, new recipient) | Transaction Service |
| **Non-root Containers** | `expressuser` UID 1001 | Dockerfile.template |
| **Secret Management** | GitHub Secrets → env vars at deploy time | CD Pipeline |

---

## 14. Complete File-by-File Reference

### Root Level

| File | Purpose |
|------|---------|
| [docker-compose.yml](../docker-compose.yml) | Defines all 8 containers, networks, volumes, health checks, and dependency order |
| [package.json](../package.json) | Monorepo root with npm workspaces, dev dependencies, and convenience scripts |
| [.env.example](../.env.example) | Template for all environment variables (copy to `.env` before running) |
| [Dockerfile.template](../Dockerfile.template) | Reference multi-stage Dockerfile with non-root user for production |
| [.gitignore](../.gitignore) | Git ignore rules (node_modules, .env, generated Prisma, etc.) |
| [.dockerignore](../.dockerignore) | Docker build context exclusions |

---

### API Gateway (`services/api-gateway/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/api-gateway/src/index.js) | Express app entry point — assembles the middleware pipeline |
| [src/middleware/jwtAuth.js](../services/api-gateway/src/middleware/jwtAuth.js) | JWT verification, public route whitelist, user identity header injection |
| [src/middleware/proxy.js](../services/api-gateway/src/middleware/proxy.js) | HTTP reverse proxy routing to 5 backend microservices |
| [src/middleware/rateLimiter.js](../services/api-gateway/src/middleware/rateLimiter.js) | Redis-backed rate limiting (20/min public, 100/min authenticated) |
| [src/config/redis.js](../services/api-gateway/src/config/redis.js) | Redis client for rate limiter backing store |
| [src/config/logger.js](../services/api-gateway/src/config/logger.js) | Winston structured JSON logger + HTTP request logging middleware |
| [Dockerfile](../services/api-gateway/Dockerfile) | Single-stage Node.js 20 Alpine container |
| [package.json](../services/api-gateway/package.json) | Dependencies: express, cors, helmet, ioredis, jsonwebtoken, http-proxy-middleware, express-rate-limit, rate-limit-redis, winston |

---

### Auth Service (`services/auth-service/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/auth-service/src/index.js) | Express app + auto schema sync + demo user seeding on startup |
| [src/controllers/auth.controller.js](../services/auth-service/src/controllers/auth.controller.js) | Register, MFA login, OTP verify, token refresh |
| [src/controllers/user.controller.js](../services/auth-service/src/controllers/user.controller.js) | Get/update profile, KYC upload |
| [src/routes/auth.routes.js](../services/auth-service/src/routes/auth.routes.js) | POST /register, /login, /verify-otp, /refresh |
| [src/routes/user.routes.js](../services/auth-service/src/routes/user.routes.js) | GET/PUT /profile, POST /kyc |
| [src/utils/otp.js](../services/auth-service/src/utils/otp.js) | OTP generation, SHA-256 hashing, constant-time verification, email dispatch |
| [src/utils/rabbitmq.js](../services/auth-service/src/utils/rabbitmq.js) | RabbitMQ connection manager, exchange setup, publish methods |
| [src/utils/validation.js](../services/auth-service/src/utils/validation.js) | Zod schemas + validation middleware factory |
| [prisma/schema.prisma](../services/auth-service/prisma/schema.prisma) | User, RefreshToken, OtpRecord models (auth_db schema) |

---

### Account Service (`services/account-service/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/account-service/src/index.js) | Express app mounting accounts, payments, and loan routes |
| [src/controllers/account.controller.js](../services/account-service/src/controllers/account.controller.js) | Create account, list accounts, balance check, ACID execute-transfer, bill payment, debit/credit |
| [src/controllers/loan.controller.js](../services/account-service/src/controllers/loan.controller.js) | Apply loan, list loans, loan details, amortization calculator |
| [prisma/schema.prisma](../services/account-service/prisma/schema.prisma) | Account, Loan, UtilityReceipt models (acct_db schema) |

---

### Transaction Service (`services/transaction-service/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/transaction-service/src/index.js) | Express app mounting transaction routes |
| [src/controllers/transaction.controller.js](../services/transaction-service/src/controllers/transaction.controller.js) | Internal transfer orchestrator, external transfer (ISO 8583), history, receipts |
| [src/utils/fraudEngine.js](../services/transaction-service/src/utils/fraudEngine.js) | 3-rule real-time fraud detection engine |
| [src/utils/iso8583.js](../services/transaction-service/src/utils/iso8583.js) | ISO 8583 interbank clearing message simulator |
| [src/utils/notifier.js](../services/transaction-service/src/utils/notifier.js) | Fire-and-forget async notification + audit dispatch via RabbitMQ |
| [src/utils/rabbitmq.js](../services/transaction-service/src/utils/rabbitmq.js) | RabbitMQ connection + publish methods (same class as auth-service) |
| [prisma/schema.prisma](../services/transaction-service/prisma/schema.prisma) | Transaction, FraudAlert models (txn_db schema) |

---

### Notification Service (`services/notification-service/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/notification-service/src/index.js) | Express app + RabbitMQ consumer startup |
| [src/consumers/index.js](../services/notification-service/src/consumers/index.js) | RabbitMQ message handlers (email, notify, audit) using mock req/res adapters |
| [src/controllers/notification.controller.js](../services/notification-service/src/controllers/notification.controller.js) | Internal notify/email, list notifications, mark read |
| [src/controllers/audit.controller.js](../services/notification-service/src/controllers/audit.controller.js) | Internal audit record, list audit logs, verify hash chain |
| [src/utils/auditEngine.js](../services/notification-service/src/utils/auditEngine.js) | SHA-256 cryptographic hash chain — record events + verify chain integrity |
| [src/utils/mailer.js](../services/notification-service/src/utils/mailer.js) | Nodemailer SMTP sender with mock fallback + branded HTML email templates |
| [src/utils/rabbitmq.js](../services/notification-service/src/utils/rabbitmq.js) | RabbitMQ connection + consume method |

---

### Admin Service (`services/admin-service/`)

| File | Purpose |
|------|---------|
| [src/index.js](../services/admin-service/src/index.js) | Express app mounting admin routes |
| [src/controllers/admin.controller.js](../services/admin-service/src/controllers/admin.controller.js) | Dashboard aggregation, user CRUD, suspend/unlock/verify KYC, fraud alerts |
| [src/routes/admin.routes.js](../services/admin-service/src/routes/admin.routes.js) | Route definitions for all admin endpoints |

---

### Frontend (`client/`)

| File | Purpose |
|------|---------|
| [src/lib/api.ts](../client/src/lib/api.ts) | Axios HTTP client with JWT auto-inject + silent token refresh + API wrapper methods |
| [src/components/Navbar.tsx](../client/src/components/Navbar.tsx) | Global navigation bar with role-based menu items |
| [src/app/layout.tsx](../client/src/app/layout.tsx) | Root layout with dark theme, Navbar, footer |
| [src/app/page.tsx](../client/src/app/page.tsx) | Landing page with animated hero + feature cards |
| [src/app/globals.css](../client/src/app/globals.css) | Global CSS with design tokens (colors, glass effects, animations) |
| [Dockerfile](../client/Dockerfile) | Multi-stage build: npm build → production runner |
| [tailwind.config.ts](../client/tailwind.config.ts) | Custom Tailwind theme with AegisVault design system colors |

---

### CI/CD & Infrastructure

| File | Purpose |
|------|---------|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | CI pipeline: unit tests + frontend build + Docker compose validation |
| [.github/workflows/cd.yml](../.github/workflows/cd.yml) | CD pipeline: change detection → Docker build/push ACR → Azure Container Apps deploy |
| [infrastructure/provision.azcli](../infrastructure/provision.azcli) | One-time Azure resource provisioning (Resource Group, ACR, Container Apps Environment) |

---

### Scripts

| File | Purpose |
|------|---------|
| [scripts/init-schemas.sql](../scripts/init-schemas.sql) | Creates 5 PostgreSQL schemas on database initialization |
| [scripts/seed-demo.js](../scripts/seed-demo.js) | Prepopulates demo users, accounts, transactions, fraud flags, audit trail |
| [scripts/smoke-test.js](../scripts/smoke-test.js) | 7-step E2E API smoke test through the API Gateway |

---

> [!TIP]
> **Quick Start:**
> 1. Copy `.env.example` to `.env`
> 2. Run `npm run docker:up` (or `docker compose up --build`)
> 3. Wait for all containers to pass health checks (~30-60 seconds)
> 4. Open `http://localhost:8080` (frontend) or `http://localhost:3000` (API)
> 5. Login with `customer1@aegisvault.com` / `CustomerSecure2026!` (OTP: `123456`)
> 6. Admin login: `admin@aegisvault.com` / `AdminSecure2026!` (OTP: `123456`)
