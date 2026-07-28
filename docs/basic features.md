# 🏦 AegisVault — Phase 2 Complete Implementation Blueprint

> [!IMPORTANT]
> **Mission:** Build a working, secure digital banking web application using **real microservices architecture** in 5 days.
> **Deadline:** July 31, 2026 · **Team:** 3 Developers

---

## 📐 1. The Big Picture — How Everything Connects

This is the complete system. Every box is a real, running piece of software. Every arrow is a real network connection.

```mermaid
graph TB
    subgraph BROWSER["🌍 USER'S BROWSER"]
        USER["👤 Customer / Admin"]
    end

    subgraph FRONTEND["🎨 FRONTEND CONTAINER — Port 8080"]
        NEXTJS["Next.js 14 App Router<br/><i>React 18 · TypeScript · SSR</i>"]
        SHADCN["shadcn/ui Components<br/><i>Radix UI Primitives</i>"]
        RHF["React Hook Form + Zod<br/><i>Client-Side Validation</i>"]
        RECHARTS["Recharts<br/><i>Admin Dashboard Charts</i>"]
        TANSTACK["TanStack Query<br/><i>Server State · Caching · Refetch</i>"]
    end

    subgraph GATEWAY["🛡️ API GATEWAY CONTAINER — Port 3000"]
        PROXY["http-proxy-middleware<br/><i>Reverse Proxy to Services</i>"]
        JWTMW["JWT Validation Middleware<br/><i>jsonwebtoken · Public Routes Whitelist</i>"]
        RATELIMIT["Rate Limiter<br/><i>express-rate-limit + Redis Store</i>"]
        LOGGER["Request Logger<br/><i>Winston · Structured JSON</i>"]
        HELMET["Security Headers<br/><i>Helmet.js · CORS</i>"]
    end

    subgraph MICROSERVICES["⚙️ 5 INDEPENDENT MICROSERVICE CONTAINERS"]
        AUTH["🔐 Auth Service :3001<br/><i>Express.js</i>"]
        ACCT["🏦 Account Service :3002<br/><i>Express.js</i>"]
        TXN["💰 Transaction Service :3003<br/><i>Express.js</i>"]
        NOTIF["🔔 Notification Service :3004<br/><i>Express.js</i>"]
        ADMIN["📊 Admin Service :3005<br/><i>Express.js</i>"]
    end

    subgraph DATABASES["🗄️ DATA LAYER CONTAINERS"]
        PG["🐘 PostgreSQL 16<br/><i>5 Isolated Schemas</i><br/>auth_db · acct_db · txn_db<br/>notif_db · admin_db"]
        REDIS["⚡ Redis 7<br/><i>Sessions · Rate Limits<br/>OTP TTL · Cache</i>"]
    end

    subgraph EXTERNAL["🌐 EXTERNAL SERVICES"]
        SMTP["📧 SMTP Server<br/><i>Gmail / Mailtrap</i><br/>OTP Emails · Alerts"]
    end

    USER ==>|"HTTPS"| NEXTJS
    NEXTJS -->|"fetch() API calls"| PROXY
    PROXY --> JWTMW --> RATELIMIT --> LOGGER

    LOGGER -->|"/api/auth/*"| AUTH
    LOGGER -->|"/api/accounts/*<br/>/api/payments/*<br/>/api/loans/*"| ACCT
    LOGGER -->|"/api/transactions/*"| TXN
    LOGGER -->|"/api/notifications/*<br/>/api/audit/*"| NOTIF
    LOGGER -->|"/api/admin/*"| ADMIN

    AUTH -->|"Prisma ORM"| PG
    ACCT -->|"Prisma ORM"| PG
    TXN -->|"Prisma ORM"| PG
    NOTIF -->|"Prisma ORM"| PG
    ADMIN -->|"Prisma ORM"| PG

    AUTH -->|"Session Store<br/>OTP TTL"| REDIS
    RATELIMIT -->|"Rate Count Store"| REDIS

    TXN -.->|"HTTP: Check Balance"| ACCT
    TXN -.->|"HTTP: Send Alert"| NOTIF
    AUTH -.->|"HTTP: Send OTP Email"| NOTIF
    NOTIF -->|"Nodemailer"| SMTP

    style BROWSER fill:#1e293b,stroke:#334155,color:#f8fafc
    style FRONTEND fill:#1e40af,stroke:#1d4ed8,color:#fff
    style GATEWAY fill:#b45309,stroke:#92400e,color:#fff
    style MICROSERVICES fill:#047857,stroke:#065f46,color:#fff
    style DATABASES fill:#6d28d9,stroke:#5b21b6,color:#fff
    style EXTERNAL fill:#991b1b,stroke:#7f1d1d,color:#fff
```

---

## 🔧 2. Complete Tech Stack — What Does What & How It Connects

### Technology Connection Map

```mermaid
graph LR
    subgraph FE["🎨 FRONTEND STACK"]
        NJS["Next.js 14"] --> REACT["React 18"]
        NJS --> TS["TypeScript"]
        REACT --> SUI["shadcn/ui"]
        SUI --> RADIX["Radix UI"]
        REACT --> RHF2["React Hook Form"]
        RHF2 --> ZOD_FE["Zod (Validation)"]
        REACT --> TQ["TanStack Query"]
        REACT --> RC["Recharts"]
    end

    subgraph BE["⚙️ BACKEND STACK"]
        EXP["Express.js"] --> NODEJS["Node.js 20"]
        EXP --> PRISMA["Prisma ORM"]
        EXP --> JWT["jsonwebtoken"]
        EXP --> BCRYPT["bcrypt"]
        EXP --> ZOD_BE["Zod (Validation)"]
        EXP --> WINSTON["Winston Logger"]
        EXP --> NODEM["Nodemailer"]
        EXP --> HPXY["http-proxy-middleware"]
    end

    subgraph INFRA["🏗️ INFRASTRUCTURE"]
        DOCKER["Docker"] --> DCOMP["Docker Compose"]
        DCOMP --> PGDB["PostgreSQL 16"]
        DCOMP --> REDISDB["Redis 7"]
        GHA["GitHub Actions"] --> JEST["Jest + Supertest"]
        GHA --> ESLINT["ESLint + Prettier"]
    end

    TQ -->|"fetch JSON"| HPXY
    HPXY -->|"proxy"| EXP
    PRISMA -->|"SQL queries"| PGDB
    JWT -->|"session check"| REDISDB

    style FE fill:#1e40af,stroke:#1d4ed8,color:#fff
    style BE fill:#047857,stroke:#065f46,color:#fff
    style INFRA fill:#6d28d9,stroke:#5b21b6,color:#fff
```

### Every Technology Explained

#### 🎨 Frontend Layer

| Technology | Role | Connects To | Why We Use It |
|:---|:---|:---|:---|
| **Next.js 14** | Web framework (App Router + SSR) | Express API Gateway via `fetch()` | Server-side rendering for fast page loads; file-based routing saves time |
| **TypeScript** | Type-safe JavaScript | Everything in `/client` | Catches bugs at compile time; essential for financial data handling |
| **shadcn/ui** | UI component library | Radix UI primitives underneath | Pre-built buttons, forms, tables, dialogs — copy-paste into our project |
| **Radix UI** | Accessible UI primitives | Used by shadcn/ui internally | Keyboard navigation, screen reader support (WCAG 2.1 compliance) |
| **React Hook Form** | Form state management | Zod for validation rules | Handles complex banking forms (transfers, registration) efficiently |
| **Zod** | Schema validation | React Hook Form + Express routes | Same validation rules on frontend AND backend — single source of truth |
| **TanStack Query** | Server state manager | API Gateway via fetch | Auto-caching, refetching, loading/error states for API data |
| **Recharts** | Chart library | Admin Dashboard page | Line charts (transaction volume), bar charts (daily stats), pie charts |

#### ⚙️ Backend Layer

| Technology | Role | Connects To | Why We Use It |
|:---|:---|:---|:---|
| **Express.js** | HTTP server framework | PostgreSQL (via Prisma), Redis, other services (via HTTP) | Lightweight, minimal, perfect for microservices |
| **Node.js 20** | JavaScript runtime | Runs Express servers | Async I/O handles many concurrent banking requests |
| **Prisma ORM** | Database access layer | PostgreSQL | Type-safe queries, auto migrations, prevents SQL injection |
| **jsonwebtoken (JWT)** | Auth token library | Redis (blacklist check), API Gateway (validation) | Stateless authentication — no session DB lookup needed per request |
| **bcrypt** | Password hashing | PostgreSQL (stores hashed passwords) | Industry-standard, salted hashing with cost factor 12 |
| **Zod** | Request body validation | Express route handlers | Validates and sanitizes every incoming API request |
| **Winston** | Structured logging | Console + log files | JSON-formatted logs for debugging and audit compliance |
| **Nodemailer** | Email sending | Gmail SMTP / Mailtrap | Sends OTP codes and transaction alert emails |
| **http-proxy-middleware** | Reverse proxy | Routes requests to microservices | API Gateway forwards `/api/auth/*` → Auth Service, etc. |
| **express-rate-limit** | Rate limiting | Redis (stores request counts) | Prevents brute-force attacks (100 req/min authenticated, 20 unauthenticated) |
| **Helmet.js** | Security headers | Express response headers | Sets CSP, X-Frame-Options, HSTS — blocks common web attacks |
| **CORS** | Cross-origin policy | Express middleware | Allows Next.js frontend (port 8080) to call API Gateway (port 3000) |

#### 🏗️ Infrastructure Layer

| Technology | Role | Connects To | Why We Use It |
|:---|:---|:---|:---|
| **Docker** | Containerization | Wraps each service in an isolated container | True microservice isolation — each service is independently deployable |
| **Docker Compose** | Multi-container orchestrator | Manages all 8 containers (5 services + gateway + PostgreSQL + Redis) | Single `docker compose up` starts the entire platform |
| **PostgreSQL 16** | Relational database | All 5 microservices (via Prisma) | ACID compliance mandatory for financial transactions |
| **Redis 7** | In-memory cache/store | Auth Service (sessions), API Gateway (rate limits), OTP TTL storage | Sub-millisecond reads; auto-expires OTPs after 5 minutes |
| **GitHub Actions** | CI/CD pipeline | Runs Jest tests, ESLint, Docker build on every push | Automated quality gates — code doesn't merge if tests fail |
| **Jest + Supertest** | Testing framework | Express services | Unit tests (business logic) + API integration tests (HTTP endpoints) |
| **ESLint + Prettier** | Code quality | All JavaScript/TypeScript files | Consistent code style across 3 developers |

---

## 🔐 3. Authentication System — Full Flow

Authentication is worth **15% of the grade** and touches multiple services. Here's the complete flow:

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 User
    participant FE as 🎨 Next.js Client
    participant GW as 🛡️ API Gateway
    participant AUTH as 🔐 Auth Service
    participant NOTIF as 🔔 Notification Service
    participant DB as 🗄️ PostgreSQL
    participant RD as ⚡ Redis
    participant EMAIL as 📧 SMTP

    Note over U,EMAIL: ── REGISTRATION FLOW ──
    U->>FE: Fill registration form (email, phone, NIC, password)
    FE->>FE: Validate with React Hook Form + Zod
    FE->>GW: POST /api/auth/register
    GW->>GW: Rate limit check (no JWT needed — public route)
    GW->>AUTH: Forward request
    AUTH->>DB: Check if email/phone/NIC already exists
    DB-->>AUTH: No duplicate found ✅
    AUTH->>AUTH: Hash password with bcrypt (cost 12)
    AUTH->>DB: INSERT new user into auth_db.users
    AUTH-->>GW: 201 Created — { userId, message }
    GW-->>FE: Success response
    FE-->>U: Show "Registration successful! Please login."

    Note over U,EMAIL: ── LOGIN + MFA FLOW ──
    U->>FE: Enter email + password
    FE->>GW: POST /api/auth/login
    GW->>AUTH: Forward request
    AUTH->>DB: Find user by email
    AUTH->>AUTH: Compare password with bcrypt.compare()
    Note over AUTH: If wrong password → increment failedAttempts<br/>If failedAttempts >= 5 → lock account
    AUTH->>AUTH: Generate 6-digit OTP
    AUTH->>AUTH: Hash OTP with bcrypt, save to otp_records (TTL: 5 min)
    AUTH->>RD: Store OTP hash with 5-min expiry
    AUTH->>NOTIF: HTTP POST /internal/email { to, subject, otpCode }
    NOTIF->>EMAIL: Send OTP email via Nodemailer
    AUTH-->>GW: 200 OK — { message: "OTP sent", tempToken }
    GW-->>FE: Response with temp token
    FE-->>U: Redirect to OTP verification screen

    U->>FE: Enter 6-digit OTP code
    FE->>GW: POST /api/auth/verify-otp { otp, tempToken }
    GW->>AUTH: Forward request
    AUTH->>RD: Retrieve and verify OTP hash
    AUTH->>AUTH: Generate JWT access token (15 min) + refresh token (7 days)
    AUTH->>DB: Save refresh token hash to refresh_tokens table
    AUTH-->>GW: 200 OK — { accessToken, refreshToken, user }
    GW-->>FE: Set tokens in HTTP-only cookies / localStorage
    FE-->>U: Redirect to Dashboard 🎉

    Note over U,EMAIL: ── TOKEN REFRESH FLOW ──
    FE->>GW: POST /api/auth/refresh { refreshToken }
    GW->>AUTH: Forward request
    AUTH->>DB: Verify refresh token hash exists and not expired
    AUTH->>AUTH: Generate new access token (15 min)
    AUTH-->>GW: 200 OK — { newAccessToken }
    GW-->>FE: Update stored token
```

### JWT Token Structure

```mermaid
graph LR
    subgraph ACCESS["🔑 Access Token (15 min lifespan)"]
        A1["Header: { alg: HS256 }"]
        A2["Payload: {<br/>  sub: userId<br/>  email: user@email.com<br/>  role: CUSTOMER | ADMIN<br/>  iat: timestamp<br/>  exp: timestamp + 15min<br/>}"]
        A3["Signature: HMAC-SHA256(header.payload, SECRET)"]
    end

    subgraph REFRESH["🔄 Refresh Token (7 day lifespan)"]
        R1["Longer-lived token stored in DB"]
        R2["Used only to get new Access Tokens"]
        R3["Revoked on logout or password change"]
    end

    style ACCESS fill:#059669,stroke:#047857,color:#fff
    style REFRESH fill:#2563eb,stroke:#1d4ed8,color:#fff
```

---

## 💰 4. Core Banking — ACID Fund Transfer Flow

This is the most critical feature — it must be **atomically safe**. If any step fails, the entire transfer rolls back.

```mermaid
sequenceDiagram
    autonumber
    actor U as 👤 Customer
    participant FE as 🎨 Next.js
    participant GW as 🛡️ Gateway
    participant TXN as 💰 Transaction Svc
    participant ACCT as 🏦 Account Svc
    participant NOTIF as 🔔 Notification Svc
    participant DB as 🗄️ PostgreSQL

    U->>FE: Click "Send LKR 50,000 to Account 9876"
    FE->>FE: Validate amount (Zod: positive number, max 10M)
    FE->>GW: POST /api/transactions/transfer<br/>{ fromAccountId, toAccountId, amount }
    GW->>GW: ✅ JWT valid · ✅ Rate limit OK · 📝 Log request
    GW->>TXN: Forward transfer request

    Note over TXN: STEP 1: Verify sender account
    TXN->>ACCT: HTTP GET /api/accounts/{fromId}/balance
    ACCT->>DB: SELECT balance FROM acct_db.accounts WHERE id = fromId
    ACCT-->>TXN: { balance: 150000, status: ACTIVE }

    Note over TXN: STEP 2: Fraud detection (rule-based)
    TXN->>TXN: Check rules:<br/>• Amount > 500,000? → FLAG<br/>• > 3 transfers in 10 min? → FLAG<br/>• New recipient + amount > 100,000? → FLAG
    
    alt Fraud Detected 🚨
        TXN->>DB: INSERT fraud_alert (txn_db.fraud_alerts)
        TXN->>NOTIF: HTTP POST /internal/notify { type: SECURITY }
        TXN-->>GW: 403 — Transaction flagged for review
        GW-->>FE: Show fraud warning
    end

    Note over TXN,DB: STEP 3: ACID Transaction (ALL or NOTHING)
    TXN->>ACCT: HTTP POST /api/accounts/execute-transfer<br/>{ fromId, toId, amount }
    
    rect rgb(20, 83, 45)
        Note over ACCT,DB: BEGIN SQL TRANSACTION
        ACCT->>DB: UPDATE acct_db.accounts<br/>SET balance = balance - 50000<br/>WHERE id = fromId AND balance >= 50000
        Note over ACCT,DB: ↑ If balance insufficient → ROLLBACK
        ACCT->>DB: UPDATE acct_db.accounts<br/>SET balance = balance + 50000<br/>WHERE id = toId
        Note over ACCT,DB: COMMIT SQL TRANSACTION ✅
    end

    ACCT-->>TXN: Transfer executed ✅

    Note over TXN: STEP 4: Record and notify
    TXN->>DB: INSERT transaction record (txn_db.transactions)
    TXN-->>GW: 201 Created — { transactionId, referenceNumber, receipt }
    GW-->>FE: Show success confirmation

    par Asynchronous Post-Processing
        TXN--)NOTIF: HTTP POST /internal/notify<br/>{ userId: sender, message: "Sent LKR 50,000" }
        TXN--)NOTIF: HTTP POST /internal/notify<br/>{ userId: receiver, message: "Received LKR 50,000" }
        TXN--)NOTIF: HTTP POST /internal/audit<br/>{ action: TRANSFER, details: {...} }
    end

    NOTIF->>DB: INSERT notification (notif_db.notifications)
    NOTIF->>DB: INSERT audit_log with hash chain (notif_db.audit_logs)
```

---

## 🔗 5. How Microservices Talk to Each Other

```mermaid
graph TB
    subgraph SYNC["⚡ SYNCHRONOUS CALLS (HTTP REST — Immediate Response Required)"]
        direction LR
        T1["TXN Service"] -->|"GET /api/accounts/:id/balance<br/><b>Purpose:</b> Check if sender has enough money"| A1["Account Service"]
        T2["TXN Service"] -->|"POST /api/accounts/execute-transfer<br/><b>Purpose:</b> Debit sender + credit receiver"| A2["Account Service"]
        AU1["Auth Service"] -->|"POST /internal/email<br/><b>Purpose:</b> Send OTP code via email"| N1["Notification Service"]
        AD1["Admin Service"] -->|"GET /api/auth/users (internal)<br/><b>Purpose:</b> Fetch user list for admin panel"| AU2["Auth Service"]
    end

    subgraph ASYNC["📨 FIRE-AND-FORGET CALLS (HTTP — Response Not Critical)"]
        direction LR
        T3["TXN Service"] -.->|"POST /internal/notify<br/><b>Purpose:</b> Alert user about transfer"| N2["Notification Service"]
        T4["TXN Service"] -.->|"POST /internal/audit<br/><b>Purpose:</b> Log transfer to audit trail"| N3["Notification Service"]
        AU3["Auth Service"] -.->|"POST /internal/audit<br/><b>Purpose:</b> Log login attempt"| N4["Notification Service"]
    end

    style SYNC fill:#0d9488,stroke:#0f766e,color:#fff
    style ASYNC fill:#7c3aed,stroke:#6d28d9,color:#fff
```

> [!NOTE]
> **Synchronous calls** are used when the caller NEEDS the response to continue (e.g., checking balance before transferring). **Fire-and-forget calls** are used when the caller doesn't need to wait (e.g., sending an email notification — the transfer already succeeded).

---

## 🐳 6. Docker Container Networking

Every service runs in its own isolated Docker container. Docker Compose creates a shared virtual network so containers can reach each other by **service name**.

```mermaid
graph TB
    subgraph DOCKER_NETWORK["🌐 Docker Network: aegisvault-network"]
        direction TB
        
        subgraph ROW1["Application Containers"]
            C1["📦 client<br/><i>:8080 → :3000</i><br/>Next.js"]
            C2["📦 api-gateway<br/><i>:3000 → :3000</i><br/>Express Proxy"]
        end

        subgraph ROW2["Microservice Containers"]
            C3["📦 auth-service<br/><i>:3001 → :3001</i>"]
            C4["📦 account-service<br/><i>:3002 → :3002</i>"]
            C5["📦 transaction-service<br/><i>:3003 → :3003</i>"]
            C6["📦 notification-service<br/><i>:3004 → :3004</i>"]
            C7["📦 admin-service<br/><i>:3005 → :3005</i>"]
        end

        subgraph ROW3["Data Containers"]
            C8["📦 postgres<br/><i>:5432 → :5432</i><br/>Persistent Volume"]
            C9["📦 redis<br/><i>:6379 → :6379</i>"]
        end

        C1 -->|"http://api-gateway:3000"| C2
        C2 --> C3 & C4 & C5 & C6 & C7
        C5 -->|"http://account-service:3002"| C4
        C5 -->|"http://notification-service:3004"| C6
        C3 -->|"http://notification-service:3004"| C6
        C3 & C4 & C5 & C6 & C7 --> C8
        C2 & C3 --> C9
    end

    HOST["💻 Host Machine (Your Laptop)"]
    HOST -->|"localhost:8080"| C1
    HOST -->|"localhost:3000"| C2
    HOST -->|"localhost:5432"| C8

    style DOCKER_NETWORK fill:#1e293b,stroke:#475569,color:#f1f5f9
    style HOST fill:#059669,stroke:#047857,color:#fff
```

### How Container Names Map to URLs

```javascript
// INSIDE Docker containers, use SERVICE NAMES:
fetch('http://account-service:3002/api/accounts/123/balance')
fetch('http://notification-service:3004/internal/notify')
fetch('http://auth-service:3001/api/auth/verify')

// OUTSIDE Docker (your browser / Postman), use LOCALHOST:
fetch('http://localhost:3000/api/accounts/123/balance')  // Goes through API Gateway
fetch('http://localhost:8080')                            // Next.js frontend
```

---

## 🗄️ 7. Database Architecture — Schema-per-Service

Each microservice owns its database schema. No service can read another service's tables directly — they must go through HTTP APIs. This is the core microservices data isolation principle.

```mermaid
graph TB
    subgraph PG["🐘 PostgreSQL 16 — Single Instance, 5 Schemas"]
        subgraph AUTH_SCHEMA["📁 auth_schema"]
            U["users<br/><i>id · email · phone · nic<br/>passwordHash · role<br/>isVerified · isLocked<br/>failedAttempts · kycStatus</i>"]
            RT["refresh_tokens<br/><i>id · userId · tokenHash<br/>deviceInfo · expiresAt</i>"]
            OTP["otp_records<br/><i>id · userId · otpHash<br/>type · expiresAt · isUsed</i>"]
            U --> RT
            U --> OTP
        end

        subgraph ACCT_SCHEMA["📁 acct_schema"]
            ACC["accounts<br/><i>id · userId · accountNumber<br/>accountType · balance · currency<br/>status (ACTIVE/FROZEN/CLOSED)</i>"]
            LOAN["loans<br/><i>id · userId · accountId · amount<br/>interestRate · termMonths<br/>monthlyPayment · status</i>"]
            ACC --> LOAN
        end

        subgraph TXN_SCHEMA["📁 txn_schema"]
            TX["transactions<br/><i>id · fromAccountId · toAccountId<br/>amount · currency · type<br/>status · referenceNumber<br/>fraudFlag · description</i>"]
            FA["fraud_alerts<br/><i>id · transactionId<br/>ruleTriggered · riskScore<br/>status (FLAGGED/CLEARED)</i>"]
            TX --> FA
        end

        subgraph NOTIF_SCHEMA["📁 notif_schema"]
            NF["notifications<br/><i>id · userId · title · message<br/>type · channel · isRead</i>"]
            AL["audit_logs<br/><i>id · userId · action · resource<br/>ipAddress · details(JSON)<br/>hash · previousHash ← IMMUTABLE</i>"]
        end

        subgraph ADMIN_SCHEMA["📁 admin_schema"]
            SM["system_metrics<br/><i>id · metricName<br/>metricValue · recordedAt</i>"]
            AA["admin_actions<br/><i>id · adminUserId · action<br/>targetUserId · reason</i>"]
        end
    end

    AUTH_SVC["🔐 Auth Service"] --> AUTH_SCHEMA
    ACCT_SVC["🏦 Account Service"] --> ACCT_SCHEMA
    TXN_SVC["💰 Transaction Service"] --> TXN_SCHEMA
    NOTIF_SVC["🔔 Notification Service"] --> NOTIF_SCHEMA
    ADMIN_SVC["📊 Admin Service"] --> ADMIN_SCHEMA

    style AUTH_SCHEMA fill:#dc2626,stroke:#b91c1c,color:#fff
    style ACCT_SCHEMA fill:#2563eb,stroke:#1d4ed8,color:#fff
    style TXN_SCHEMA fill:#d97706,stroke:#b45309,color:#fff
    style NOTIF_SCHEMA fill:#7c3aed,stroke:#6d28d9,color:#fff
    style ADMIN_SCHEMA fill:#059669,stroke:#047857,color:#fff
```

### How Data Flows Between Services (No Direct DB Access!)

```mermaid
graph LR
    TXN_SVC["💰 Transaction Service<br/><i>Needs sender's balance</i>"]
    ACCT_SVC["🏦 Account Service<br/><i>Owns acct_schema</i>"]
    ACCT_DB["🗄️ acct_schema.accounts"]

    TXN_SVC -->|"1. HTTP GET /api/accounts/123/balance<br/>(NOT a direct SQL query!)"| ACCT_SVC
    ACCT_SVC -->|"2. SELECT balance FROM accounts<br/>WHERE id = 123"| ACCT_DB
    ACCT_DB -->|"3. { balance: 150000 }"| ACCT_SVC
    ACCT_SVC -->|"4. JSON response: { balance: 150000 }"| TXN_SVC

    style TXN_SVC fill:#d97706,stroke:#b45309,color:#fff
    style ACCT_SVC fill:#2563eb,stroke:#1d4ed8,color:#fff
    style ACCT_DB fill:#6d28d9,stroke:#5b21b6,color:#fff
```

> [!WARNING]
> **Transaction Service NEVER queries `acct_schema.accounts` directly.** It always goes through Account Service's HTTP API. This is the foundation of microservices — data ownership and isolation.

---

## 🛣️ 8. Complete API Endpoint Map

### 🔐 Auth Service (Port 3001)

```mermaid
graph LR
    subgraph AUTH_API["🔐 Auth Service API — Port 3001"]
        R1["POST /api/auth/register<br/><i>Create new user account</i>"]
        R2["POST /api/auth/login<br/><i>Validate credentials → Send OTP</i>"]
        R3["POST /api/auth/verify-otp<br/><i>Verify OTP → Return JWT tokens</i>"]
        R4["POST /api/auth/refresh<br/><i>Refresh expired access token</i>"]
        R5["POST /api/auth/forgot-password<br/><i>Send password reset OTP</i>"]
        R6["POST /api/auth/reset-password<br/><i>Reset password with OTP</i>"]
        R7["GET /api/users/profile<br/><i>Get current user profile</i>"]
        R8["PUT /api/users/profile<br/><i>Update profile info</i>"]
        R9["POST /api/users/kyc<br/><i>Upload KYC documents</i>"]
        R10["GET /health<br/><i>Service health check</i>"]
    end
    style AUTH_API fill:#dc2626,stroke:#b91c1c,color:#fff
```

### 🏦 Account Service (Port 3002)

```mermaid
graph LR
    subgraph ACCT_API["🏦 Account Service API — Port 3002"]
        A1["POST /api/accounts<br/><i>Create new bank account</i>"]
        A2["GET /api/accounts<br/><i>List user's accounts</i>"]
        A3["GET /api/accounts/:id/balance<br/><i>Get real-time balance</i>"]
        A4["POST /api/accounts/execute-transfer<br/><i>INTERNAL: ACID debit/credit</i>"]
        A5["POST /api/payments/bill<br/><i>Pay utility bill</i>"]
        A6["POST /api/loans/apply<br/><i>Submit loan application</i>"]
        A7["GET /api/loans<br/><i>List user's loans</i>"]
        A8["GET /api/loans/:id<br/><i>Get loan details + schedule</i>"]
        A9["GET /health"]
    end
    style ACCT_API fill:#2563eb,stroke:#1d4ed8,color:#fff
```

### 💰 Transaction Service (Port 3003)

```mermaid
graph LR
    subgraph TXN_API["💰 Transaction Service API — Port 3003"]
        T1["POST /api/transactions/transfer<br/><i>Initiate fund transfer (orchestrator)</i>"]
        T2["GET /api/transactions<br/><i>Transaction history + filters</i>"]
        T3["GET /api/transactions/:id<br/><i>Single transaction details</i>"]
        T4["GET /api/transactions/:id/receipt<br/><i>Download PDF receipt</i>"]
        T5["GET /health"]
    end
    style TXN_API fill:#d97706,stroke:#b45309,color:#fff
```

### 🔔 Notification Service (Port 3004)

```mermaid
graph LR
    subgraph NOTIF_API["🔔 Notification Service API — Port 3004"]
        N1["GET /api/notifications<br/><i>List user's notifications</i>"]
        N2["PUT /api/notifications/:id/read<br/><i>Mark single notification as read</i>"]
        N3["PUT /api/notifications/read-all<br/><i>Mark all as read</i>"]
        N4["POST /internal/notify<br/><i>INTERNAL: Create notification + email</i>"]
        N5["POST /internal/audit<br/><i>INTERNAL: Log to immutable audit trail</i>"]
        N6["POST /internal/email<br/><i>INTERNAL: Send email via Nodemailer</i>"]
        N7["GET /api/audit<br/><i>View audit trail (admin only)</i>"]
        N8["GET /health"]
    end
    style NOTIF_API fill:#7c3aed,stroke:#6d28d9,color:#fff
```

### 📊 Admin Service (Port 3005)

```mermaid
graph LR
    subgraph ADMIN_API["📊 Admin Service API — Port 3005"]
        AD1["GET /api/admin/dashboard<br/><i>KPI metrics: users, txns, volume, uptime</i>"]
        AD2["GET /api/admin/users<br/><i>All users with search + pagination</i>"]
        AD3["PUT /api/admin/users/:id/suspend<br/><i>Suspend a user account</i>"]
        AD4["PUT /api/admin/users/:id/verify<br/><i>Verify user's KYC</i>"]
        AD5["GET /api/admin/transactions<br/><i>All transactions (admin view)</i>"]
        AD6["GET /api/admin/reports/daily<br/><i>Daily summary stats</i>"]
        AD7["GET /api/admin/fraud-alerts<br/><i>Flagged transactions list</i>"]
        AD8["GET /health"]
    end
    style ADMIN_API fill:#059669,stroke:#047857,color:#fff
```

---

## 🛡️ 9. Security Architecture

```mermaid
graph TB
    subgraph SECURITY["🔒 MULTI-LAYERED SECURITY"]
        L1["Layer 1: HTTPS / TLS<br/><i>All traffic encrypted in transit</i>"]
        L2["Layer 2: API Gateway<br/><i>Rate limiting · JWT validation<br/>Request logging · Security headers (Helmet)</i>"]
        L3["Layer 3: Authentication<br/><i>bcrypt password hashing (cost 12)<br/>JWT tokens (15 min access / 7 day refresh)<br/>MFA via email OTP</i>"]
        L4["Layer 4: Authorization<br/><i>Role-based access (CUSTOMER vs ADMIN)<br/>Resource ownership checks</i>"]
        L5["Layer 5: Input Validation<br/><i>Zod schema validation on every route<br/>Parameterized queries via Prisma (no SQL injection)</i>"]
        L6["Layer 6: Audit Trail<br/><i>Hash-chained immutable logs<br/>Every action logged with IP, timestamp, user</i>"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6

    style SECURITY fill:#1e293b,stroke:#334155,color:#f8fafc
```

### Hash-Chained Audit Trail (How It Works)

```mermaid
graph LR
    E1["📝 Log Entry 1<br/>action: USER_LOGIN<br/>hash: abc123<br/>prevHash: 000000"]
    E2["📝 Log Entry 2<br/>action: TRANSFER<br/>hash: def456<br/>prevHash: abc123"]
    E3["📝 Log Entry 3<br/>action: PAYMENT<br/>hash: ghi789<br/>prevHash: def456"]
    E4["📝 Log Entry 4<br/>action: ADMIN_SUSPEND<br/>hash: jkl012<br/>prevHash: ghi789"]

    E1 -->|"hash abc123"| E2
    E2 -->|"hash def456"| E3
    E3 -->|"hash ghi789"| E4

    style E1 fill:#059669,stroke:#047857,color:#fff
    style E2 fill:#059669,stroke:#047857,color:#fff
    style E3 fill:#059669,stroke:#047857,color:#fff
    style E4 fill:#059669,stroke:#047857,color:#fff
```

> Each new audit log entry's `hash` = `SHA256(previousHash + action + userId + timestamp + details)`. If anyone tampers with an older entry, **every subsequent hash breaks** — making tampering detectable. This is the "Blockchain Audit Trail" from our Phase 1 proposal, implemented simply.

---

## 🔄 10. CI/CD Pipeline Flow

```mermaid
graph LR
    DEV["💻 Developer<br/>Pushes code to GitHub"] 
    --> TRIGGER["⚡ GitHub Actions<br/>Triggered on push/PR"]
    --> LINT["🔍 ESLint + Prettier<br/>Code quality check"]
    --> TEST["🧪 Jest + Supertest<br/>Run all unit & API tests"]
    --> BUILD_CLIENT["🔨 Build Next.js<br/>npm run build"]
    --> BUILD_DOCKER["🐳 Build Docker Images<br/>docker compose build"]
    --> HEALTH["❤️ Health Check<br/>curl localhost:3000/health"]
    --> PASS["✅ ALL GREEN<br/>Safe to merge"]

    LINT -->|"❌ Fails"| BLOCK["🚫 PR Blocked"]
    TEST -->|"❌ Fails"| BLOCK
    BUILD_CLIENT -->|"❌ Fails"| BLOCK

    style DEV fill:#2563eb,stroke:#1d4ed8,color:#fff
    style PASS fill:#059669,stroke:#047857,color:#fff
    style BLOCK fill:#dc2626,stroke:#b91c1c,color:#fff
```

---

## 🖥️ 11. Frontend Screens & Navigation

```mermaid
graph TD
    LANDING["🏠 Landing Page<br/><i>Hero · Features · CTA</i>"]
    
    subgraph AUTH_PAGES["🔐 Authentication Flow"]
        LOGIN["Login Page<br/><i>Email + Password</i>"]
        REGISTER["Registration Page<br/><i>Email · Phone · NIC · Password</i>"]
        OTP["OTP Verification<br/><i>6-digit code input</i>"]
    end

    subgraph CUSTOMER_PAGES["👤 Customer Dashboard"]
        DASH["Dashboard<br/><i>Balance · Quick Actions<br/>Recent Transactions</i>"]
        TRANSFER["Send Money<br/><i>Recipient · Amount · Confirm</i>"]
        HISTORY["Transaction History<br/><i>Filter · Search · Paginate</i>"]
        BILLS["Bill Payments<br/><i>Utility · Amount · Pay</i>"]
        LOANS["Loans<br/><i>Apply · Track Status</i>"]
        NOTIFS["Notifications<br/><i>Alerts · Mark Read</i>"]
        PROFILE["Profile & Settings<br/><i>KYC · Preferences · Password</i>"]
    end

    subgraph ADMIN_PAGES["📊 Admin Panel (Web Only)"]
        ADMIN_DASH["Admin Dashboard<br/><i>KPIs · Charts · Alerts</i>"]
        ADMIN_USERS["User Management<br/><i>Search · Suspend · Verify KYC</i>"]
        ADMIN_FRAUD["Fraud Alerts<br/><i>Flagged Transactions · Review</i>"]
        ADMIN_AUDIT["Audit Logs<br/><i>Search · Filter · Drill Down</i>"]
    end

    LANDING --> LOGIN & REGISTER
    LOGIN --> OTP --> DASH
    REGISTER --> LOGIN
    
    DASH --> TRANSFER & HISTORY & BILLS & LOANS & NOTIFS & PROFILE
    DASH --> ADMIN_DASH
    ADMIN_DASH --> ADMIN_USERS & ADMIN_FRAUD & ADMIN_AUDIT

    style AUTH_PAGES fill:#dc2626,stroke:#b91c1c,color:#fff
    style CUSTOMER_PAGES fill:#2563eb,stroke:#1d4ed8,color:#fff
    style ADMIN_PAGES fill:#059669,stroke:#047857,color:#fff
```

---

## 📊 12. Evaluation Criteria — How Every Criteria is Covered

```mermaid
pie title Phase 2 Mark Allocation (100%)
    "Server-side handling (20%)" : 20
    "Authentication system (15%)" : 15
    "System Architecture (15%)" : 15
    "Quality Assurance (15%)" : 15
    "Solution functionality (15%)" : 15
    "Enterprise strategies (10%)" : 10
    "Client-side handling (10%)" : 10
```

| Criteria | Weight | What We Build | Confidence |
|:---|:---:|:---|:---:|
| **Server-side handling** | **20%** | 5 Express microservices with Prisma ORM, ACID fund transfers, inter-service HTTP, Zod validation, error handling middleware, structured request/response patterns | 🟢 |
| **Authentication system** | **15%** | JWT (access 15min + refresh 7d), bcrypt cost-12 hashing, email OTP MFA, account lockout after 5 failures, session management via Redis, role-based authorization | 🟢 |
| **System Architecture** | **15%** | 5 real Docker containers (genuinely independent), API Gateway, schema-per-service DB isolation, inter-service REST, reverse proxy routing, health checks | 🟢 |
| **Quality Assurance** | **15%** | Jest unit tests per service, Supertest API integration tests, React Testing Library frontend tests, GitHub Actions CI pipeline (lint + test + build) | 🟢 |
| **Solution functionality** | **15%** | Auth, MFA, dashboard, fund transfers, bill payments, loan applications, transaction history, notifications, admin panel, fraud alerts | 🟢 |
| **Enterprise strategies** | **10%** | Docker Compose orchestration, Winston structured JSON logging, health check endpoints, rate limiting with Redis, immutable hash-chained audit trail, Swagger API docs, Helmet security headers | 🟢 |
| **Client-side handling** | **10%** | Next.js 14 SSR, shadcn/ui accessible components, React Hook Form + Zod client validation, TanStack Query (caching + loading states), responsive layout, error boundaries, loading skeletons | 🟢 |

---

## 📅 13. 5-Day Visual Roadmap

```mermaid
gantt
    title 🏗️ AegisVault 5-Day Build Schedule
    dateFormat YYYY-MM-DD
    axisFormat %a %b %d
    todayMarker off

    section 🟢 Day 1 — Foundation
    Docker Compose + PostgreSQL + Redis     :d1a, 2026-07-27, 1d
    API Gateway (proxy + JWT + rate limit)  :d1b, 2026-07-27, 1d
    Auth Service (register/login/OTP/JWT)   :d1c, 2026-07-27, 1d
    Next.js Setup + Auth UI Pages           :d1d, 2026-07-27, 1d

    section 🟡 Day 2 — Core Banking
    Account Service (CRUD + balance)        :d2a, 2026-07-28, 1d
    Transaction Service (ACID + fraud)      :d2b, 2026-07-28, 1d
    Notification Service (email + audit)    :d2c, 2026-07-28, 1d
    Dashboard + Transfer + History UI       :d2d, 2026-07-28, 1d

    section 🟠 Day 3 — Full Features
    Bill Payment + Loan APIs                :d3a, 2026-07-29, 1d
    Profile + KYC + Password Reset APIs     :d3b, 2026-07-29, 1d
    Admin Service (metrics + user mgmt)     :d3c, 2026-07-29, 1d
    Bills + Loans + Profile + Notifs UI     :d3d, 2026-07-29, 1d

    section 🟣 Day 4 — QA + Admin UI
    Admin Dashboard UI (charts + tables)    :d4a, 2026-07-30, 1d
    Unit Tests (Jest + Supertest)           :d4b, 2026-07-30, 1d
    GitHub Actions CI/CD Pipeline           :d4c, 2026-07-30, 1d
    Swagger API Documentation               :d4d, 2026-07-30, 1d

    section 🔴 Day 5 — Polish + Submit
    Bug Fixes + UI Polish                   :d5a, 2026-07-31, 1d
    Seed Demo Data                          :d5b, 2026-07-31, 1d
    USER_GUIDE.md + README.md               :d5c, 2026-07-31, 1d
    Final Docker Test + Submit ZIP          :crit, d5d, 2026-07-31, 1d
```

---

## ⚡ 14. Quick Reference — Express.js Patterns

> [!TIP]
> Every Express microservice follows the exact same structure. Learn it once, use it 5 times.

```javascript
// ═══════════════════════════════════════════
// PATTERN 1: Service Entry Point (index.js)
// ═══════════════════════════════════════════
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();

app.use(cors());           // Allow cross-origin requests
app.use(helmet());         // Security headers
app.use(express.json());   // Parse JSON request bodies

// Mount domain routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));

// Health check (required for Docker + Kubernetes)
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'auth-service' }));

// Global error handler (MUST be last middleware)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({ success: false, error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Auth Service running on port ${PORT}`));
```

```javascript
// ═══════════════════════════════════════════
// PATTERN 2: Route File (routes/auth.routes.js)
// ═══════════════════════════════════════════
const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/verify-otp', ctrl.verifyOtp);
router.post('/refresh', ctrl.refreshToken);

module.exports = router;
```

```javascript
// ═══════════════════════════════════════════
// PATTERN 3: Controller (controllers/auth.controller.js)
// ═══════════════════════════════════════════
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');  // Shared Prisma client instance

exports.register = async (req, res, next) => {
  try {
    const { email, phone, nic, password, firstName, lastName } = req.body;

    // 1. Check duplicates
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }, { nic }] }
    });
    if (exists) return res.status(409).json({ error: 'User already exists' });

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Create user
    const user = await prisma.user.create({
      data: { email, phone, nic, passwordHash, firstName, lastName }
    });

    res.status(201).json({ success: true, userId: user.id });
  } catch (err) {
    next(err);  // → Global error handler
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isLocked) return res.status(423).json({ error: 'Account locked' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedAttempts: { increment: 1 },
          isLocked: user.failedAttempts >= 4  // Lock on 5th failure
        }
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0 }
    });

    // Generate and send OTP (calls notification service)
    // ... OTP logic here ...

    res.json({ message: 'OTP sent to your email', tempToken: '...' });
  } catch (err) {
    next(err);
  }
};
```

```javascript
// ═══════════════════════════════════════════
// PATTERN 4: Calling Another Microservice
// ═══════════════════════════════════════════
// In transaction-service, calling account-service:
const checkBalance = async (accountId) => {
  const response = await fetch(
    `http://account-service:3002/api/accounts/${accountId}/balance`
  );
  if (!response.ok) throw new Error('Account service unavailable');
  return response.json();  // { balance: 150000, status: 'ACTIVE' }
};
```

---

## 🐳 15. Quick Reference — Docker

```dockerfile
# ═══════════════════════════════════════════
# Standard Dockerfile (reuse for all services)
# ═══════════════════════════════════════════
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "src/index.js"]
```

```yaml
# ═══════════════════════════════════════════
# docker-compose.yml (orchestrates everything)
# ═══════════════════════════════════════════
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aegisvault
      POSTGRES_USER: aegis_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD:-securep@ss123}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegis_admin"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api-gateway:
    build: ./services/api-gateway
    ports: ["3000:3000"]
    environment:
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-key}
      - REDIS_URL=redis://redis:6379
    depends_on: [redis, auth-service, account-service,
                 transaction-service, notification-service, admin-service]

  auth-service:
    build: ./services/auth-service
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=postgresql://aegis_admin:${DB_PASSWORD:-securep@ss123}@postgres:5432/aegisvault?schema=auth_db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET:-your-super-secret-key}
      - NOTIFICATION_SERVICE_URL=http://notification-service:3004
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }

  account-service:
    build: ./services/account-service
    ports: ["3002:3002"]
    environment:
      - DATABASE_URL=postgresql://aegis_admin:${DB_PASSWORD:-securep@ss123}@postgres:5432/aegisvault?schema=acct_db
    depends_on:
      postgres: { condition: service_healthy }

  transaction-service:
    build: ./services/transaction-service
    ports: ["3003:3003"]
    environment:
      - DATABASE_URL=postgresql://aegis_admin:${DB_PASSWORD:-securep@ss123}@postgres:5432/aegisvault?schema=txn_db
      - ACCOUNT_SERVICE_URL=http://account-service:3002
      - NOTIFICATION_SERVICE_URL=http://notification-service:3004
    depends_on:
      postgres: { condition: service_healthy }

  notification-service:
    build: ./services/notification-service
    ports: ["3004:3004"]
    environment:
      - DATABASE_URL=postgresql://aegis_admin:${DB_PASSWORD:-securep@ss123}@postgres:5432/aegisvault?schema=notif_db
      - SMTP_HOST=${SMTP_HOST:-smtp.gmail.com}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
    depends_on:
      postgres: { condition: service_healthy }

  admin-service:
    build: ./services/admin-service
    ports: ["3005:3005"]
    environment:
      - DATABASE_URL=postgresql://aegis_admin:${DB_PASSWORD:-securep@ss123}@postgres:5432/aegisvault?schema=admin_db
      - AUTH_SERVICE_URL=http://auth-service:3001
    depends_on:
      postgres: { condition: service_healthy }

  client:
    build: ./client
    ports: ["8080:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    depends_on: [api-gateway]

volumes:
  pgdata:
```

### Essential Commands

| Command | What It Does |
|:---|:---|
| `docker compose up --build` | Build all images and start all 8 containers |
| `docker compose up -d` | Start in background (detached) mode |
| `docker compose down` | Stop and remove all containers |
| `docker compose down -v` | Stop + delete database volume (fresh start) |
| `docker compose logs -f transaction-service` | Live tail logs of one service |
| `docker compose ps` | List running containers and their ports |
| `docker compose restart auth-service` | Restart just one service |

---

## 🚀 Ready?

> [!IMPORTANT]
> **This plan covers every piece of the system — how it connects, why each technology exists, and what data flows where.** Once you approve, I'll generate the actual project code scaffold so you can start building immediately.
