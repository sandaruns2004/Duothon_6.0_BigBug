# AegisVault Cybersecurity & Architecture Core Concepts Guide

This guide provides an in-depth breakdown of the **17 technical concepts and security findings** from the AegisVault Security Audit Report. Each concept is explained with:

1. **What it does / Core Definition**
2. **Cybersecurity & Operational Impact** (How it achieves or fails security)
3. **Specific Implementation Details in AegisVault** (Code locations & architectural context)

---

## 1. Account Lockout & Admin Unlock Mechanism

### What It Is

Account Lockout is a defensive mechanism that automatically disables a user account after a specified number of consecutive failed authentication attempts (e.g., incorrect passwords).

### Cybersecurity Impact

- **Achieves Security:** Prevents **Online Brute-Force** and **Credential Stuffing** attacks. Without lockout, automated botnets can attempt millions of common passwords against an account until guessing the correct one.
- **Risk (Denial of Service):** If lockout parameters are too strict or lack CAPTCHA, attackers can intentionally trigger lockouts on targeted victim accounts (Account Denial of Service).

### AegisVault Implementation

- **Lockout Logic:** Handled in Auth Service ([auth.controller.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/auth-service/src/controllers/auth.controller.js#L118-L142)). Upon 5 consecutive failed logins, `isLocked` is set to `true` in PostgreSQL.
- **Can Admin Unlock in Current Version?** **YES.**
  - **API Endpoint:** `PUT /api/admin/users/:id/unlock` implemented in Admin Service ([admin.controller.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/admin-service/src/controllers/admin.controller.js#L277-L320)).
  - **Frontend Control:** In the Next.js Admin Dashboard ([admin/page.tsx](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/client/src/app/admin/page.tsx#L609)), administrators can click the **Unlock** button next to any locked user.
  - **Action:** The controller updates `isLocked: false` and `failedAttempts: 0` in the database via Prisma, and logs an immutable audit event in the `AdminAction` table.

---

## 2. Silent Token Refresh

### What It Is

Silent Token Refresh is an authentication pattern where the client application transparently requests a new short-lived JWT Access Token in the background using a long-lived Refresh Token stored in a secure cookie, without requiring the user to re-enter credentials or refreshing the page.

### Cybersecurity Impact

- **Achieves Security:** Solves the security vs. usability tradeoff:
  1. **Short Access Token Lifespan (e.g., 15 minutes):** If an access token is stolen or leaked in client memory, its utility window for an attacker is minimal.
  2. **HttpOnly Cookies for Refresh Tokens:** Refresh tokens are stored in `HttpOnly`, `Secure`, `SameSite` cookies, rendering them invisible to client-side JavaScript and immune to XSS theft.
- **Mechanism:** When the Access Token expires or is about to expire, an Axios/Fetch interceptor hits `POST /api/auth/refresh-token`, receives a fresh Access Token in memory, and resumes pending requests seamlessly.

---

## 3. Authenticated User Scoping

### What It Is

Authenticated User Scoping is the practice of constraining database queries and business logic strictly to the identity extracted from the verified authentication context (`req.user.id` from JWT), rather than trusting user-supplied request body or URL route parameters.

### Cybersecurity Impact

- **Achieves Security:** Guarantees **Multi-Tenant Data Isolation**. Ensures that even if an attacker tampers with API payloads or URLs (e.g., changing `userId=usr-100` to `userId=usr-101`), the backend query forces `WHERE userId = authenticated_user_id`.
- **Fails Security If Omitted:** Failing to scope queries leads directly to Horizontal Privilege Escalation vulnerabilities (BOLA/IDOR).

---

## 4. BOLA and IDOR Vulnerabilities

### What They Are

- **IDOR (Insecure Direct Object Reference):** A flaw where an application exposes a direct identifier to an internal database object (e.g., `/api/accounts/acc-9981`) without performing an authorization check to verify if the requesting user owns that object.
- **BOLA (Broken Object Level Authorization):** The modern, expanded OWASP API Security Top-10 designation for IDOR. It occurs when an API fails to validate that the authenticated user has permission to access or mutate the specific requested object instance.

### Cybersecurity Impact

- **Fails Security:** Allows unauthorized users to view, modify, or delete resources belonging to other users simply by changing database IDs in requests (e.g., enumeration attacks).
- **Remediation:** Enforce object-level ownership authorization middleware on every endpoint that accepts record IDs.

---

## 5. Role Controllable from Registration

### What It Is

A vulnerability where the public user registration endpoint (`POST /api/auth/register`) accepts a user-supplied `role` field in the JSON request payload (e.g., `{"email": "attacker@evil.com", "password": "...", "role": "ADMIN"}`).

### Cybersecurity Impact

- **Fails Security (Critical Flaw):** Enables **Vertical Privilege Escalation**. Any unauthenticated attacker can self-assign elevated permissions (e.g., `ADMIN`, `COMPLIANCE_OFFICER`) during registration and gain complete control over system administration capabilities.
- **Fix in AegisVault:** Sanitize input during registration to strictly hardcode `role: 'CUSTOMER'`. Creation of internal administrative accounts must occur exclusively through secure seed scripts or restricted admin management systems.

---

## 6. Parameterized Queries

### What It Is

Parameterized Queries (also known as Prepared Statements) separate SQL code execution from user input parameters. Instead of concatenating input strings directly into SQL statements, query placeholders (`?` or `$1`) are used, and parameters are passed separately to the database engine.

```sql
-- Vulnerable Concatenation:
SELECT * FROM users WHERE email = ' + userInput + ';

-- Secure Parameterized Query:
SELECT * FROM users WHERE email = $1; -- Parameters: [userInput]
```

### Cybersecurity Impact

- **Achieves Security:** Completely eliminates **SQL Injection (SQLi)** attacks. Because the database engine compiles the query structure _before_ combining parameters, malicious user input (such as `' OR '1'='1`) is treated purely as literal string data rather than executable SQL logic.
- **In AegisVault:** Prisma ORM handles parameterization automatically across all services.

---

## 7. Security Headers & Helmet.js

### What It Is

HTTP Security Headers are response headers sent by the web server instructing client browsers to enable built-in security protections. `helmet.js` is a standard Node.js Express middleware that sets these headers automatically.

### Cybersecurity Impact (Key Headers Handled by Helmet)

| Security Header                    | Purpose / Security Achievement                                                                               |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy (CSP)`    | Restricts sources from which scripts, styles, and media can load, mitigating **Cross-Site Scripting (XSS)**. |
| `X-Frame-Options: DENY`            | Prevents the page from being rendered inside an `<iframe>`, preventing **Clickjacking** attacks.             |
| `X-Content-Type-Options: nosniff`  | Blocks browsers from MIME-sniffing response content types, enforcing strict content header execution.        |
| `Strict-Transport-Security (HSTS)` | Forces browsers to interact with the domain exclusively over **encrypted HTTPS** connections.                |

---

## 8. CORS (Cross-Origin Resource Sharing) & Wildcard Origin Risks

### What It Is

CORS is a browser-enforced security mechanism that prevents web applications hosted on one origin (domain/protocol/port) from reading API responses from a different origin unless explicit permission is granted by the server via `Access-Control-Allow-Origin` headers.

### Cybersecurity Impact

- **Wildcard Flaw (`origin: '*'`):** If configured with `origin: '*'`, ANY malicious website opened in a user's browser can issue background HTTP requests to your API. If API endpoints rely on IP whitelisting or ambient authentication, sensitive data can be exfiltrated by rogue third-party sites.
- **Secure Setup:** Explicitly whitelist trusted frontend origins (e.g., `origin: 'https://app.aegisvault.com'`) and enable `credentials: true`.

---

## 9. SSL/TLS & `cookie: { secure: false }` / `Proxy secure: false`

### What They Are

- **SSL/TLS (Secure Sockets Layer / Transport Layer Security):** Protocols that encrypt data transmitted over networks (HTTPS), ensuring confidentiality, data integrity, and server authentication.
- **`secure: false` Cookie / Proxy Setting:** A flag in web servers or session cookie configurations determining whether cookies should be transmitted over unencrypted HTTP connections.

### Cybersecurity Impact

- **Fails Security:** Setting `secure: false` allows session or JWT cookies to be transmitted over plain HTTP. Attackers on open Wi-Fi networks can execute **Eavesdropping / Man-in-the-Middle (MitM)** attacks to intercept session tokens and hijack user sessions.
- **Secure Configuration:** Set `secure: true` in production so browsers enforce cookie transmission exclusively over HTTPS.

---

## 10. Committed `.env` vs `.env.example`

### What It Is

- **`.env` File:** Contains operational environment variables, including sensitive production credentials, private keys, database connection strings, and API tokens.
- **`.env.example` File:** A version-controlled template containing variable names with dummy placeholder values (e.g., `DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"`).

### Cybersecurity Impact

- **Fails Security (High Risk):** Committing real `.env` files to source code repositories exposes private secrets to everyone with repository access (or publicly if pushed to GitHub). Attackers can use exposed database passwords or JWT secrets to compromise infrastructure.
- **Remediation:** `.env` files MUST be added to `.gitignore`. Developers copy `.env.example` to `.env` locally and populate it with local non-production secrets.

---

## 11. Azure Key Vault Integration

### What It Is

Azure Key Vault is a cloud-managed Key Management Service (KMS) designed to securely store, manage, and tightly control access to tokens, passwords, certificates, API keys, and cryptographic keys using Hardware Security Modules (HSMs).

### Cybersecurity Impact

- **Achieves Security:** Eliminates hardcoded plain-text secrets in source code, configuration files, and container environment variables.
- **Key Advantages:**
  1. **Centralized Secret Management & Audit Trail:** Every secret access attempt is logged with identity and timestamp.
  2. **Automated Secret Rotation:** Secret keys can be rotated automatically without requiring application code redeployments.
  3. **Role-Based Access Control (RBAC):** Microservices authenticate using Azure Managed Identity to fetch only the specific secrets they are authorized to consume.

---

## 12. SMTP with TLS (Port 465)

### What It Is

SMTP (Simple Mail Transfer Protocol) is the protocol used for transmitting email. Port 465 utilizes **Implicit TLS**, establishing an encrypted SSL/TLS session immediately upon connection before any SMTP commands are exchanged.

### Cybersecurity Impact

- **Achieves Security:** Protects sensitive outbound email communications (such as password reset tokens, OTP verification codes, and financial alerts) from eavesdropping and tampering during transit across external network routers.

---

## 13. Azure Container Apps HTTPS Ingress

### What It Is

Ingress acts as the entry gateway for external HTTP/HTTPS traffic entering microservices deployed inside Azure Container Apps (ACA).

### Cybersecurity Impact

- **Achieves Security:**
  1. **TLS Termination at Cloud Edge:** Encrypts incoming public traffic automatically and handles SSL certificate management.
  2. **Internal Network Isolation:** ACA allows configuring ingress as internal or external. Microservices can communicate privately inside a virtual network (VNet), hiding non-public services (like database or processing nodes) from public internet exposure.

---

## 14. ISO 8583 Clearing Simulation & `iso8583.js`

### What It Is

ISO 8583 is the international standard for financial transaction card-originated messages. It defines message formats for credit card clearing, debit authorizations, and interbank transaction settlements (SWIFT/VISA/MasterCard networks).

### AegisVault Code Location

- **File Location:** `services/transaction-service/src/utils/iso8583.js` ([iso8583.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/transaction-service/src/utils/iso8583.js))
- **Invoked By:** Transaction Service Controller ([transaction.controller.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/transaction-service/src/controllers/transaction.controller.js#L449))

### Operational & Security Role

Simulates interbank network clearing message formatting. It generates message type identifiers (MTI), bitmap encodings, Retrieval Reference Numbers (RRN), and mock response codes to mimic real-world banking infrastructure without transmitting real funds across external clearinghouses.

---

## 15. Idempotency Keys (`X-Idempotency-Key`)

### What It Is

An Idempotency Key is a unique identifier (typically a UUID v4) generated by the client and sent in an HTTP request header (e.g., `X-Idempotency-Key`) when executing payment or transaction requests (`POST /api/transactions`).

### Cybersecurity & Financial Integrity Impact

- **Achieves Financial Security:** Prevents **Double-Spending** and duplicate processing caused by network retries, browser page refreshes, or malicious request replay attacks.
- **Mechanism:** The backend records processed idempotency keys in Redis or PostgreSQL. If a second request arrives with the exact same key, the server immediately returns the previously cached response without re-executing the financial transaction.

---

## 16. Security Monitoring in Admin Service

### How to Monitor Security Issues in Admin Service

Security issues and administrative actions in AegisVault can be monitored using **four complementary mechanisms**:

1. **Structured Winston JSON Logs:**
   - Handled by [logger.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/admin-service/src/config/logger.js). Every HTTP request, warning, error, and security alert (e.g., `🚨 User account suspended by admin`) is output as structured JSON.
   - Can be ingested directly into centralized logging tools (Azure Log Analytics, Datadog, ELK Stack).
2. **Database Audit Logs (`AdminAction` Table):**
   - Every administrative action (suspending users, unlocking accounts, verifying/rejecting KYC, approving loans) writes an immutable record to the `AdminAction` table containing `adminUserId`, `action`, `targetUserId`, `reason`, and timestamp.
3. **Fraud Alerts Monitoring Dashboard:**
   - Admin Service exposes `GET /api/admin/fraud-alerts` ([admin.controller.js](file:///c:/Users/sithu/MyWorks/My%20Softwares/Competitions/Duothon_26_devops/Duothon_6.0_BigBug/services/admin-service/src/controllers/admin.controller.js#L323)), allowing compliance officers to view transactions flagged by the automated fraud detection engine.
4. **Unhandled Exception Tracking:**
   - Process-level exception handling catches unhandled promise rejections and logs complete stack traces to prevent silent server failures.

---

## 17. Database Connection Pooling

### What It Is

Database Connection Pooling is a system that maintains a pool of active, reusable database connections managed by a connection manager (e.g., Prisma Client, pg-pool), rather than opening and closing a new TCP/TLS connection for every single incoming HTTP request.

### Cybersecurity & Performance Impact

- **Achieves Security (DoS Protection):** Opening database connections consumes significant database CPU, memory, and cryptographic resources. Connection pooling limits the maximum concurrent connections (`connection_limit`), preventing sudden traffic spikes or malicious Denial of Service (DoS) attempts from crashing the PostgreSQL database server.
- **Performance:** Eliminates the latency penalty of establishing new database handshakes on every request.

---

_Document created automatically for AegisVault project security documentation._
