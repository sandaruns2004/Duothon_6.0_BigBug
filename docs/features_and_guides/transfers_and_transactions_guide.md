# 💸 AegisVault Transfers & Transactions — Complete Technical Blueprint & Operational Guide

This document provides a comprehensive end-to-end architectural guide for **transfers and transactions** in the AegisVault 5-microservice platform. It details the technologies, security layers, codebase files, database schema architecture, Azure Container Apps deployment, testing verification steps, and key areas for improvement.

---

## 🏗️ 1. Technologies & Architecture Summary

| Layer | Technology | Role in Transfers & Transactions |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (React 18, TypeScript, Tailwind CSS, shadcn/ui) | Client UI for initiating transfers (`/transfer`), viewing transaction history (`/transactions`), and downloading PDF receipts. |
| **API Gateway** | Node.js, Express.js, `http-proxy-middleware` | Reverse proxy routing, JWT authentication (`jwtAuth.js`), identity header injection (`x-user-id`, `x-user-role`, `x-user-email`), and rate-limiting. |
| **Caching & Rate Limit** | Redis 7 | Backs API Gateway rate limiters (**100 req/min** for authenticated routes) and caches user sessions/OTPs. |
| **Transaction Orchestrator** | Node.js, Express.js (`transaction-service` on port `3003`) | Coordinates balance pre-checks, fraud evaluation, ACID transfer calls, transaction persistence, and async notifications. |
| **Account & Ledger Engine** | Node.js, Express.js (`account-service` on port `3002`) | Owns `acct_db` schema; executes atomic SQL debit/credit operations via Prisma `$transaction`. |
| **Database** | PostgreSQL 16 (Schema-per-service) | Isolated schemas (`txn_db.transactions`, `acct_db.accounts`, `notif_db.audit_logs`, etc.) ensuring strict microservice boundary isolation. |
| **Message Broker** | RabbitMQ 3 | Asynchronously publishes `notify.send` (email alerts) and `audit.log` events without blocking API responses. |
| **Audit & Compliance** | Node.js (`notification-service` on port `3004`) | Consumes `audit.log` events and builds an immutable **SHA-256 Cryptographic Hash Chain** (`notif_db.audit_logs`). |

---

## 🔄 2. Complete Transfer & Transaction Workflow

### End-to-End Orchestration Flow (`POST /api/transactions/transfer`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer (Next.js UI)
    participant GW as API Gateway (:3000)
    participant TS as Transaction Service (:3003)
    participant AS as Account Service (:3002)
    participant PG as PostgreSQL 16 (DB)
    participant RMQ as RabbitMQ 3
    participant NS as Notification / Audit (:3004)

    User->>GW: POST /api/transactions/transfer (JWT Token)
    Note over GW: 1. Validate JWT<br/>2. Check Redis Rate Limit (100 req/min)<br/>3. Inject x-user-id header
    GW->>TS: Proxy Request to Transaction Service
    Note over TS: Validate schema (amount > 0, accounts differ)
    TS->>AS: HTTP GET /api/accounts/{fromId}/balance
    AS->>PG: Query acct_db.accounts
    AS-->>TS: Return { balance, status: ACTIVE }
    Note over TS: Check balance >= amount<br/>Run Fraud Detection Engine (3 Rules)
    TS->>AS: HTTP POST /api/accounts/execute-transfer
    Note over AS: Atomic SQL Transaction (BEGIN)
    AS->>PG: Lock sender -> Debit amount
    AS->>PG: Lock receiver -> Credit amount
    Note over AS: COMMIT Transaction (Rollback on failure)
    AS-->>TS: Return updated balances
    TS->>PG: Create txn_db.transactions record
    opt Fraud Rules Triggered
        TS->>PG: Create txn_db.fraud_alerts record(s)
    end
    TS-)RMQ: Publish 'notify.send' (Email alert)
    TS-)RMQ: Publish 'audit.log' (SHA-256 Audit Event)
    TS-->>GW: Return 201 Created (Transaction & Fraud Status)
    GW-->>User: Transfer confirmed & receipt ready
    
    Note over NS: Async Consumer (Background)
    RMQ-)NS: Consume 'audit.log'
    NS->>PG: Get last audit record hash (prevHash)
    Note over NS: SHA256(prevHash + timestamp + action + userId + details)
    NS->>PG: Insert immutable record in notif_db.audit_logs
```

---

## 🛡️ 3. Existing Security Layers

AegisVault implements **6 distinct security layers** across the transfer and transaction lifecycle:

1. **Layer 1 — Transport & Headers (`api-gateway`)**:
   - `helmet` security headers protect against MIME-sniffing, clickjacking, and XSS.
   - CORS policy enforcement restricts unauthorized browser origins.

2. **Layer 2 — Identity & Rate Limiting (`api-gateway`)**:
   - **JWT Validation** (`jwtAuthMiddleware`): Verifies access token signature and expiration (`15m` TTL).
   - **Identity Header Injection**: Downstream microservices never trust client body IDs; they rely on `x-user-id`, `x-user-role`, and `x-user-email` headers injected by the Gateway.
   - **Redis Rate Limiting**: Caps requests at **100 req/min** per IP/User to prevent automated API abuse.

3. **Layer 3 — Rule-Based Fraud Detection Engine (`transaction-service`)**:
   - Evaluates every transfer against real-time rules in `fraudEngine.js`:
     - **Rule 1 (`RULE_1_HIGH_AMOUNT`)**: Flag if `amount > 500,000 LKR` (Risk score: `+40`).
     - **Rule 2 (`RULE_2_HIGH_VELOCITY`)**: Flag if sender has `>= 3 transfers` within the last 10 minutes (Risk score: `+35`).
     - **Rule 3 (`RULE_3_NEW_RECIPIENT_LARGE_AMOUNT`)**: Flag if `amount > 100,000 LKR` to a never-before-credited recipient (Risk score: `+25`).
   - Generates alerts in `txn_db.fraud_alerts` and triggers admin review dashboards.

4. **Layer 4 — ACID Database Transactions (`account-service`)**:
   - All fund transfers execute inside a **Prisma `$transaction`** block (`account.controller.js`).
   - Validates that both accounts exist and are `ACTIVE`.
   - Enforces strict balance sufficiency checks inside the transaction before debiting/crediting.
   - Automatically rolls back any partial mutations if an error occurs.

5. **Layer 5 — Cryptographic SHA-256 Hash-Chain Audit Trail (`notification-service`)**:
   - Every transaction logs an immutable audit event (`auditEngine.js`).
   - Calculates `hash = SHA256(previousHash + timestamp + action + userId + details)`.
   - Any tampering with historical database records breaks the cryptographic chain, verifiable via `GET /api/audit/verify-chain`.

6. **Layer 6 — Asynchronous Notification (`notification-service`)**:
   - Instant email alerts sent via RabbitMQ to notify customers of account debits or flagged transactions.

---

## 📁 4. Codebase Files Involved in Transfers & Transactions

### A. Frontend (`client/`)
- **`client/src/app/transfer/page.tsx`**: The Send Money UI screen. Collects recipient account number (12 digits), amount, and description. Displays the ACID confirmation modal with fee calculation (`0.50%` above 100k LKR) and a printable success receipt modal.
- **`client/src/app/transactions/page.tsx`**: The transaction history ledger screen. Supports tabs (`ALL`, `CREDIT`, `DEBIT`, `FLAGGED`), keyword search, and opens PDF print-ready receipts.
- **`client/src/lib/api.ts`**: API wrapper. Automatically attaches the JWT `Authorization: Bearer <token>` header to outgoing requests and defines API calls like `accountApi.executeTransfer` and `txnApi.getTransactions`.

### B. API Gateway (`services/api-gateway/`)
- **`services/api-gateway/src/index.js`**: Entry point for Port `3000`. Configures CORS, Helmet headers, Redis-backed rate limiters (100 req/min), JWT authentication, and reverse proxying.
- **`services/api-gateway/src/middleware/jwtAuth.js`**: Validates the JWT Access Token. Extracts the authenticated user's ID, role, and email, and injects them into downstream request headers (`x-user-id`, `x-user-role`, `x-user-email`).
- **`services/api-gateway/src/middleware/proxy.js`**: Proxies `/api/transactions/*` to `transaction-service:3003` and `/api/accounts/*` to `account-service:3002`.

### C. Transaction Service (`services/transaction-service/`)
- **`services/transaction-service/src/routes/transaction.routes.js`**: Maps HTTP routes: `POST /api/transactions/transfer`, `POST /api/transactions/external-transfer`, `GET /api/transactions`, `GET /api/transactions/:id`, and `GET /api/transactions/:id/receipt`.
- **`services/transaction-service/src/controllers/transaction.controller.js`**: The core transfer orchestrator:
  1. Checks sender balance via HTTP GET to `account-service`.
  2. Calls `evaluateFraudRules`.
  3. Calls HTTP POST `execute-transfer` on `account-service`.
  4. Inserts the transaction record in `txn_db.transactions` and any triggered alerts in `txn_db.fraud_alerts`.
  5. Dispatches async email alerts and SHA-256 audit logs via RabbitMQ.
- **`services/transaction-service/src/utils/fraudEngine.js`**: Implements the 3 real-time fraud rules (`RULE_1_HIGH_AMOUNT`, `RULE_2_HIGH_VELOCITY`, `RULE_3_NEW_RECIPIENT_LARGE_AMOUNT`).
- **`services/transaction-service/src/utils/notifier.js`**: Publishes `notify.send` (email alert) and `audit.log` (cryptographic audit event) to RabbitMQ without blocking API response times.

### D. Account Service (`services/account-service/`)
- **`services/account-service/src/controllers/account.controller.js`**: Contains `executeTransfer`, which runs an **atomic SQL transaction** (`prisma.$transaction`) on `acct_db.accounts` to verify sufficient funds, debit the sender, and credit the receiver atomically.

### E. Notification Service (`services/notification-service/`)
- **`services/notification-service/src/utils/auditEngine.js`**: Consumes RabbitMQ `audit.log` events and calculates `SHA256(prevHash + timestamp + action + userId + details)` to append an immutable record to `notif_db.audit_logs`.

---

## 🔑 5. Secrets, Environment Variables & Database Architecture

### A. Secrets & Keys
The platform is configured via environment variables (found in `.env.example` and injected via Azure Secrets):
- **`JWT_SECRET`**: Signed key for generating access and refresh tokens (default: `aegisvault-super-secret-jwt-key-2026`).
- **`DB_PASSWORD`**: Superuser password for PostgreSQL (`securep@ss123` / URL-encoded `securep%40ss123`).
- **`DATABASE_URL`**: Connection string with targeted schema parameters:
  - `postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?schema=txn_db`
  - `postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?schema=acct_db`
- **`REDIS_URL`**: `redis://redis:6379` (Session, OTP, and rate-limit cache).
- **`RABBITMQ_URL`**: `amqp://rabbitmq:5672` (Async message queue).
- **Internal Service URLs** (In Docker: `http://account-service:3002`; In Azure Container Apps: their internal `https://*.azurecontainerapps.io` FQDNs).

### B. Database Architecture (5 Isolated Schemas in PostgreSQL 16)
To enforce the **Schema-per-Service** microservice rule, `scripts/init-schemas.sql` creates 5 independent PostgreSQL schemas inside a single database (`aegisvault`):
1. **`auth_db`**: Users, refresh tokens, OTP codes.
2. **`acct_db`**: Bank accounts (`accounts`), loans (`loans`), utility bill receipts (`utility_receipts`).
3. **`txn_db`**: Transactions (`transactions`), fraud alerts (`fraud_alerts`).
4. **`notif_db`**: Notifications, immutable SHA-256 cryptographic audit logs (`audit_logs`).
5. **`admin_db`**: System KPIs and admin activity logs.

> [!IMPORTANT]
> **Data Isolation Rule:** `transaction-service` has no database access to `acct_db.accounts`. When a transfer occurs, it cannot run `UPDATE accounts SET balance...`. It **must** make an HTTP request to `account-service`, which owns `acct_db`.

---

## ☁️ 6. Azure Deployment & How to View Data

### A. How Azure Container Apps (ACA) Works Here
As defined in `.github/workflows/cd.yml` and `docs/azure_deployment_plan.md`:
- **Private VNet (No Public Internet Access)**:
  - `postgres`, `redis`, `auth-service`, `account-service`, `transaction-service`, `notification-service`, and `admin-service` are internal Azure Container Apps. They can only communicate with each other over internal Azure virtual network URLs.
- **Public Internet-Facing Apps**:
  - `client` (Next.js Frontend) and `api-gateway` (`:3000`) are public Container Apps exposed to users via `*.azurecontainerapps.io`.
- **CI/CD Pipeline (`cd.yml`)**:
  - On git push to `main`, GitHub Actions builds Docker images, pushes them to **Azure Container Registry (ACR)**, updates all container apps in parallel, and runs a manual **Azure Container App Job (`db-seed-job`)** to run database migrations and seed demo data.

### B. How to See Data in Azure
You have 4 ways to inspect database and transaction data when deployed on Azure:

1. **Via the Web Admin Dashboard (Easiest & Visual)**:
   - Log into the app (`client`) with `admin@aegisvault.com` / `AdminSecure2026!`.
   - Go to **`/admin`** to see live transaction volume graphs, flagged fraud alerts, and inspect the SHA-256 audit chain.
2. **Via Azure CLI Container Shell (`psql`)**:
   - Since PostgreSQL is in a private Azure VNet, open an interactive `psql` session inside the Azure `postgres` container app:
     ```bash
     az containerapp exec -n postgres -g aegisvault-rg --command "psql -U aegis_admin -d aegisvault"
     ```
   - Inside the shell, query the schemas directly:
     ```sql
     SELECT * FROM acct_db.accounts;
     SELECT * FROM txn_db.transactions;
     SELECT * FROM notif_db.audit_logs ORDER BY created_at DESC LIMIT 5;
     ```
3. **Via Azure Portal Logs (Log Analytics)**:
   - In the **Azure Portal** (`portal.azure.com`), navigate to Resource Group **`aegisvault-rg`** -> Container App (`transaction-service` or `postgres`) -> **Monitoring -> Logs** to see live JSON structured request logs.
4. **Via Azure CLI Live Streaming Logs**:
   - Stream live container console logs to your terminal:
     ```bash
     az containerapp logs show -n transaction-service -g aegisvault-rg --follow
     ```

---

## ✅ 7. Verification & Testing Guide

### Step 1: Start the Application (Local Testing)
Launch the complete stack using Docker Compose and seed the sandbox environment:
```bash
docker compose up --build -d
npm run seed:demo
```
*(This creates `customer1@aegisvault.com` with Savings Account `#810000000001` and `customer2@aegisvault.com` with Current Account `#810000000002`).*

### Step 2: Execute a Transfer via UI
1. Open `http://localhost:8080` (or your Azure Client URL).
2. Log in as Customer 1 (`customer1@aegisvault.com` / `CustomerSecure2026!`, OTP: `123456`).
3. Navigate to **Send Money (`/transfer`)**.
4. Enter recipient account `#810000000002`, amount `50000`, description `"Test transfer"`, and click **Execute Transfer**.
5. Go to **Transaction History (`/transactions`)** to verify the debit record and view the printable PDF receipt.

### Step 3: Test the Full Orchestrator & Fraud Engine via cURL / Postman
To test `/api/transactions/transfer` directly through the API Gateway:
```bash
# 1. Login to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@aegisvault.com","password":"CustomerSecure2026!"}' | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# 2. Execute Transfer (Amount > 500k LKR triggers Fraud Guard Rule 1!)
curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "810000000001",
    "toAccountId": "810000000002",
    "amount": 550000,
    "description": "High value transfer test"
  }'
```

### Step 4: Verify the Database Ledger & Cryptographic Chain
Run these PostgreSQL commands to confirm that the transfer, fraud alert, and audit trail were all recorded:
```bash
# 1. Verify balances changed in acct_db:
docker compose exec postgres psql -U aegis_admin -d aegisvault -c "SELECT account_number, balance FROM acct_db.accounts;"

# 2. Verify transaction and fraud flag in txn_db:
docker compose exec postgres psql -U aegis_admin -d aegisvault -c "SELECT reference_number, amount, status, fraud_flag FROM txn_db.transactions ORDER BY created_at DESC LIMIT 3;"

# 3. Verify SHA-256 hash chain in notif_db:
docker compose exec postgres psql -U aegis_admin -d aegisvault -c "SELECT action, hash, previous_hash FROM notif_db.audit_logs ORDER BY created_at DESC LIMIT 3;"
```

---

## 🔍 8. Key Findings & Areas for Improvement

Based on this analysis, here are the **5 key architectural improvement opportunities** for the transfers and transactions sector:

1. **✅ [RESOLVED] Critical Fix: Frontend API Wire-Up & Dynamic Account Binding**
   - **Resolution**: `client/src/lib/api.ts` and `transfer/page.tsx` now invoke `/api/transactions/transfer` with dynamic account binding so all security layers, SHA-256 audit logs, and fraud detection rules run cleanly against the logged-in user's account.
   - **Dynamic State Resolution**: Removed hardcoded fallback account numbers across `/dashboard`, `/transfer`, `/transactions`, `/payments`, and `/profile`.

2. **🛡️ Idempotency Keys (Duplicate Transfer Prevention)**
   - **Improvement**: Support an `X-Idempotency-Key` header stored in Redis/DB to prevent accidental duplicate debits if a user double-clicks or a network retry occurs.

3. **🔐 Step-Up Authentication (MFA / PIN for High-Value Transfers)**
   - **Improvement**: Require OTP verification or a Transaction PIN before executing transfers above a specific amount (e.g., `> 100,000 LKR`).

4. **⚖️ Configurable Fraud Enforcement (Block vs. Flag)**
   - **Improvement**: Currently, flagged transactions complete with status `'FLAGGED'`. We can introduce a threshold (e.g., Risk Score `>= 75`) to hold funds in escrow (`status = 'PENDING_REVIEW'`) until approved by an admin.

5. **🔒 Explicit Row Locking in Ledger (`SELECT ... FOR UPDATE`)**
   - **Improvement**: Strengthen PostgreSQL transaction concurrency by adding explicit row locking when fetching sender balance during `execute-transfer`.

---

## 🏦 9. Dynamic Account Resolution & Just-In-Time (JIT) Provisioning Architecture

AegisVault implements a **Just-In-Time (JIT) Account Provisioning Engine** to guarantee that every user—whether a seeded demo account or a newly registered customer—operates on an isolated, mathematically unique bank account in PostgreSQL (`acct_db.accounts`).

### A. JIT Auto-Provisioning (`account-service`)
- **Mechanism**: When an authenticated user calls `GET /api/accounts` (`listAccounts` in `account.controller.js`), the controller checks if `accounts.length === 0`.
- **Automatic Provisioning**: If `0` accounts exist, the service automatically calls `generateAccountNumber()` and creates a new **SAVINGS** bank account with:
  - **Account Number**: Unique 12-digit number (e.g., `810XXXXXXXXX`)
  - **Starting Balance**: `500,000.00 LKR`
  - **Status**: `ACTIVE`
- **Result**: No customer ever encounters empty states or drops into static fallback accounts.

### B. Quick Sandbox Evaluation Environments (`/login`)
The platform includes three pre-configured sandbox logins accessible directly from `/login` for rapid testing of transfers and ledger transactions:

| Demo Sandbox | Credentials | Default Bank Account | Starting Balance | Role / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Customer 1 Demo** | `customer1@aegisvault.com`<br/>`CustomerSecure2026!` | `810000000001` (Savings) | `1,500,000.00 LKR` | Primary sender account for high-value transfer testing |
| **Customer 2 Demo** | `customer2@aegisvault.com`<br/>`CustomerSecure2026!` | `810000000002` (Current) | `750,000.00 LKR` | Isolated receiver account for transfer verification |
| **Admin Demo** | `admin@aegisvault.com`<br/>`AdminSecure2026!` | N/A (System Admin) | N/A | Governance dashboard, fraud rule review & SHA-256 audit logs |

### C. Session State Hygiene Across Microservices
- When switching between sandbox users or logging out, `clearTokens()` (`client/src/lib/api.ts`) wipes all cached localStorage tokens (`aegisvault_selected_account_number`, `tempUserId`, `tempEmail`), ensuring zero cross-account state leakage.
- Transfers executed from `/transfer` instantly reflect on the recipient's `/dashboard` and `/transactions` ledger history.
