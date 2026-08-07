# 06 — Security Vulnerabilities & How to Fix Them

> A priority-ordered guide to every known vulnerability in AegisVault, with the theory behind each attack vector, the exact files/lines to fix, and before/after code snippets.

---

## Table of Contents

1. [Reading This Guide](#1-reading-this-guide)
2. [🔴 CRITICAL — Demo OTP Bypass](#2--critical--demo-otp-bypass)
3. [🔴 CRITICAL — Hardcoded JWT Secret Fallbacks](#3--critical--hardcoded-jwt-secret-fallbacks)
4. [🔴 CRITICAL — .env with Real Secrets in Git History](#4--critical--env-with-real-secrets-in-git-history)
5. [🟡 MEDIUM — Same JWT Secret for Access & Refresh Tokens](#5--medium--same-jwt-secret-for-access--refresh-tokens)
6. [🟡 MEDIUM — No XSS Sanitization](#6--medium--no-xss-sanitization)
7. [🟡 MEDIUM — No HTTPS Enforcement](#7--medium--no-https-enforcement)
8. [🟡 MEDIUM — Redis Without Authentication](#8--medium--redis-without-authentication)
9. [🟡 MEDIUM — RabbitMQ Default Credentials](#9--medium--rabbitmq-default-credentials)
10. [🟡 MEDIUM — No Docker Image Vulnerability Scanning](#10--medium--no-docker-image-vulnerability-scanning)
11. [🟡 MEDIUM — No Database Encryption at Rest](#11--medium--no-database-encryption-at-rest)
12. [🟡 MEDIUM — No Refresh Token Rotation](#12--medium--no-refresh-token-rotation)
13. [🟡 MEDIUM — Exposed Infrastructure Ports](#13--medium--exposed-infrastructure-ports)
14. [🟡 MEDIUM — No Resource Limits on Containers](#14--medium--no-resource-limits-on-containers)
15. [Vulnerability Summary Matrix](#15-vulnerability-summary-matrix)

---

## 1. Reading This Guide

Each vulnerability follows this structure:

| Section | Content |
|---------|---------|
| **What's the risk?** | The attack scenario and theoretical background |
| **Where's the problem?** | Exact file paths and line numbers |
| **How to fix it** | Before/after code diff |

> [!CAUTION]
> Vulnerabilities marked 🔴 CRITICAL are the ones most likely to be exploited. Address them first.

---

## 2. 🔴 CRITICAL — Demo OTP Bypass

### What's the risk?

A hardcoded OTP value (`123456`) always passes verification for demo accounts. If this runs in production, anyone who knows the demo email addresses can bypass MFA entirely.

**Attack scenario:**
1. Attacker discovers demo accounts: `admin@aegisvault.com`, `customer1@aegisvault.com`
2. Enters the email + any valid password
3. On the OTP screen, enters `123456`
4. Gets full access — no email needed

### Where's the problem?

> File: [auth.controller.js L266-L270](../../services/auth-service/src/controllers/auth.controller.js#L266-L270)

```javascript
// BEFORE (VULNERABLE)
const allowedDemoAccounts = ['admin@aegisvault.com', 'customer1@aegisvault.com', 'customer2@aegisvault.com'];
const isDemoBypass = allowedDemoAccounts.includes(user.email) && otp === '123456';
const isOtpValid = isDemoBypass || verifyOtpHash(otp, cachedHash);
```

### How to fix it

**Option A: Gate behind environment variable**
```javascript
// AFTER (SAFE)
const isDemoMode = process.env.NODE_ENV !== 'production';
const allowedDemoAccounts = ['admin@aegisvault.com', 'customer1@aegisvault.com', 'customer2@aegisvault.com'];
const isDemoBypass = isDemoMode && allowedDemoAccounts.includes(user.email) && otp === '123456';
const isOtpValid = isDemoBypass || verifyOtpHash(otp, cachedHash);
```

**Option B: Remove entirely (strongest)**
```javascript
// AFTER (SAFEST)
const isOtpValid = verifyOtpHash(otp, cachedHash);
```

---

## 3. 🔴 CRITICAL — Hardcoded JWT Secret Fallbacks

### What's the risk?

**JWT Secret** is the key used to sign all tokens. If an attacker knows it, they can **forge any JWT** — creating tokens for any user with any role, including ADMIN.

The secret `aegisvault-super-secret-jwt-key-2026` appears in your source code as a fallback. If the `JWT_SECRET` environment variable is ever missing (deployment misconfiguration, env var deleted), this predictable fallback is silently used.

**Attack scenario:**
1. Attacker reads your public GitHub repo (or a fork)
2. Finds the hardcoded secret in `jwtAuth.js`
3. Generates a JWT: `jwt.sign({ sub: 'any-id', role: 'ADMIN' }, 'aegisvault-super-secret-jwt-key-2026')`
4. Sends it to the API Gateway → gets ADMIN access

### Where's the problem?

Three locations:

| File | Line | Code |
|------|------|------|
| [jwtAuth.js L9](../../services/api-gateway/src/middleware/jwtAuth.js#L9) | 9 | `const JWT_SECRET = process.env.JWT_SECRET \|\| 'aegisvault-super-secret-jwt-key-2026';` |
| [auth.controller.js L17](../../services/auth-service/src/controllers/auth.controller.js#L17) | 17 | `const JWT_SECRET = process.env.JWT_SECRET \|\| 'aegisvault-super-secret-jwt-key-2026';` |
| [ci.yml L29](../../.github/workflows/ci.yml#L29) | 29 | `JWT_SECRET: aegisvault-super-secret-jwt-key-2026` |

### How to fix it

**For `jwtAuth.js` and `auth.controller.js`:**
```javascript
// BEFORE (VULNERABLE)
const JWT_SECRET = process.env.JWT_SECRET || 'aegisvault-super-secret-jwt-key-2026';

// AFTER (SAFE — Fail loudly if secret is missing)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
}
```

**For `ci.yml`:**
```yaml
# BEFORE (VULNERABLE)
env:
  JWT_SECRET: aegisvault-super-secret-jwt-key-2026

# AFTER (SAFE — Use GitHub Secrets)
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET_TEST }}
```

> [!IMPORTANT]
> **Secret Rotation:** Since this secret has been in your git history, you should generate a new one: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and store it in GitHub Secrets and Azure env vars.

---

## 4. 🔴 CRITICAL — .env with Real Secrets in Git History

### What's the risk?

Even though `.env` is in `.gitignore`, if it was **ever committed** (even once, then removed), the secrets are permanently in the git history. Anyone who clones the repo can extract them.

### Theory: Git Never Forgets

```bash
# Check if .env was ever committed
git log --all --full-history -- .env

# If results appear, secrets are in history
# An attacker can do:
git show <commit-sha>:.env
# → Reveals DB_PASSWORD, SMTP credentials, JWT secrets
```

### How to fix it

**Step 1: Rotate all secrets immediately.** Change the DB password, JWT secret, SMTP credentials, and ACR credentials in Azure and GitHub Secrets.

**Step 2: Scrub git history** (optional but thorough):
```bash
# Using git-filter-repo (recommended over filter-branch)
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push origin --force --all
```

> [!WARNING]
> `git push --force` rewrites history for all collaborators. Everyone must re-clone the repo.

---

## 5. 🟡 MEDIUM — Same JWT Secret for Access & Refresh Tokens

### What's the risk?

Both access tokens (15m) and refresh tokens (7d) are signed with the same `JWT_SECRET`. If an attacker intercepts an access token (from a network log, browser devtools, etc.), they could potentially use it as a refresh token to get new access tokens — extending their access from 15 minutes to 7 days.

Your code has a `type: 'refresh'` check (L451-L456 of auth.controller.js) that mitigates this, but using separate keys is the industry best practice.

### How to fix it

```javascript
// BEFORE
const JWT_SECRET = process.env.JWT_SECRET;
// Both tokens use JWT_SECRET

// AFTER
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Sign access token with access secret
jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });

// Sign refresh token with refresh secret
jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
```

---

## 6. 🟡 MEDIUM — No XSS Sanitization

### What's the risk?

**XSS (Cross-Site Scripting)** occurs when an attacker injects malicious JavaScript into your application that runs in other users' browsers.

**Three types of XSS:**

| Type | Mechanism | Example |
|------|-----------|---------|
| **Stored XSS** | Malicious script saved in the DB, served to all users | Transfer description: `<script>steal(cookies)</script>` |
| **Reflected XSS** | Malicious script in URL query params, reflected in response | `?search=<script>alert(1)</script>` |
| **DOM-based XSS** | Client-side JavaScript manipulates the DOM unsafely | `document.innerHTML = userInput` |

Your Next.js frontend is **partially protected** because React auto-escapes JSX output (e.g., `{user.name}` is rendered as text, not HTML). However, API-direct consumers (mobile apps, third-party integrations) receive raw unsanitized data.

### How to fix it

Install `xss` library and create a sanitization middleware:

```javascript
// New file: services/api-gateway/src/middleware/sanitizer.js
const xss = require('xss');

const sanitizeBody = (req, res, next) => {
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  next();
};

module.exports = { sanitizeBody };
```

---

## 7. 🟡 MEDIUM — No HTTPS Enforcement

### What's the risk?

If a user accidentally visits `http://` instead of `https://`, their traffic (including JWT tokens) is sent in plaintext. An attacker on the same network (coffee shop WiFi) can intercept it via a **Man-in-the-Middle (MitM) attack**.

Azure Container Apps handles **TLS termination** at the Envoy proxy, so external traffic is HTTPS by default. However, there's no explicit redirect from HTTP to HTTPS in your application code.

### Theory: TLS, SSL, HTTPS, mTLS

| Term | Full Name | What It Does |
|------|-----------|-------------|
| **SSL** | Secure Sockets Layer | Obsolete predecessor to TLS. Often used colloquially to mean TLS |
| **TLS** | Transport Layer Security | Encrypts data in transit between client and server |
| **HTTPS** | HTTP Secure | HTTP over TLS. The `s` means the connection is encrypted |
| **mTLS** | Mutual TLS | Both client AND server present certificates. Used for service-to-service auth |
| **TLS Termination** | - | Decrypting HTTPS at a proxy edge, forwarding plain HTTP to backend services |

### How to fix it

```javascript
// Add to api-gateway/src/index.js (before other middleware)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

---

## 8. 🟡 MEDIUM — Redis Without Authentication

### Where's the problem?

> File: [docker-compose.yml L63](../../docker-compose.yml#L63)

```yaml
REDIS_URL=redis://redis:6379   # No password
```

Redis is running without `requirepass`. Any container on the Docker network can read/write to Redis without authentication. If an attacker gains access to any container (through an RCE vulnerability), they can:
- Read all cached OTPs
- Modify rate limit counters
- Flush all data

### How to fix it

```yaml
# docker-compose.yml - Add password to Redis
redis:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD:-StrongRedisPass!2026}

# Update all service REDIS_URL env vars
REDIS_URL=redis://:${REDIS_PASSWORD:-StrongRedisPass!2026}@redis:6379
```

---

## 9. 🟡 MEDIUM — RabbitMQ Default Credentials

### Where's the problem?

> File: [infrastructure/provision.azcli L66](../../infrastructure/provision.azcli#L66)

```bash
--env-vars RABBITMQ_DEFAULT_USER=guest RABBITMQ_DEFAULT_PASS=guest
```

`guest:guest` is RabbitMQ's default credential. Any attacker who can reach port 5672 or the management UI (15672) has full control over the message broker.

### How to fix it

```bash
# infrastructure/provision.azcli
--env-vars RABBITMQ_DEFAULT_USER=aegis_mq_admin RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}

# Update all RABBITMQ_URL env vars
RABBITMQ_URL=amqp://aegis_mq_admin:${RABBITMQ_PASSWORD}@rabbitmq:5672
```

---

## 10. 🟡 MEDIUM — No Docker Image Vulnerability Scanning

### What's the risk?

Your Docker images are built from `node:20-alpine`. Alpine Linux and Node.js ship with hundreds of system libraries. Any of these could have known **CVEs (Common Vulnerabilities and Exposures)** — published security bugs.

### Theory: CVE and Supply Chain Attacks

- **CVE**: A standardized ID for a publicly known security vulnerability (e.g., `CVE-2024-21626` — a container escape vulnerability in runc).
- **Supply Chain Attack**: Compromising a dependency. The `npm audit` in your CI catches JavaScript package CVEs, but it doesn't scan the underlying OS libraries in the Docker image.

### How to fix it

Add a Trivy scanning step to your CI pipeline:

```yaml
# Add to ci.yml after the Docker build step
- name: Scan Docker Image for CVEs
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.REGISTRY_LOGIN_SERVER }}/${{ matrix.service }}:${{ github.sha }}'
    format: 'table'
    exit-code: '1'           # Fail the pipeline on HIGH/CRITICAL CVEs
    severity: 'HIGH,CRITICAL'
```

---

## 11. 🟡 MEDIUM — No Database Encryption at Rest

### What's the risk?

Your PostgreSQL container stores data on disk in plaintext. If someone gains access to the underlying storage (physical disk theft, cloud storage misconfiguration), they can read all data directly — bypassing application-level authentication entirely.

### Theory: Encryption at Rest vs In Transit

| Type | What It Protects | Example |
|------|-----------------|---------|
| **At Rest** | Data stored on disk | Database files, backups, logs |
| **In Transit** | Data moving over the network | API calls (HTTPS), database connections (TLS) |

### How to fix it

**Best fix:** Migrate from containerized PostgreSQL to **Azure Database for PostgreSQL Flexible Server**, which provides:
- Automatic encryption at rest (AES-256)
- Automatic backups with point-in-time recovery
- High availability (failover replicas)
- Connection pooling (PgBouncer built-in)

---

## 12. 🟡 MEDIUM — No Refresh Token Rotation

### What's the risk?

Currently, a refresh token is valid for its entire 7-day lifetime, even after being used. If an attacker steals a refresh token, they have 7 days of access.

With **token rotation**, each time a refresh token is used, a new one is issued and the old one is invalidated. If an attacker uses the stolen token, the legitimate user's next refresh fails (because their token was replaced), alerting them to the compromise.

### How to fix it

```javascript
// In auth.controller.js refreshToken()
// AFTER issuing new access token:

// 1. Delete the used refresh token
await prisma.refreshToken.delete({ where: { id: storedToken.id } });

// 2. Issue a new refresh token
const newRefreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
const newHash = hashOtp(newRefreshToken);
await prisma.refreshToken.create({
  data: { userId: user.id, tokenHash: newHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});

// 3. Return both tokens
return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
```

---

## 13. 🟡 MEDIUM — Exposed Infrastructure Ports

### Where's the problem?

> File: [docker-compose.yml](../../docker-compose.yml)

```yaml
postgres:
  ports:
    - "5433:5432"     # Accessible from host as localhost:5433
redis:
  ports:
    - "6379:6379"     # Accessible from host
rabbitmq:
  ports:
    - "5672:5672"     # AMQP accessible from host
    - "15672:15672"   # Management UI accessible from host
```

In production, these ports should NOT be mapped. They allow direct access from the host machine and, depending on firewall config, from the network.

### How to fix it

Remove the `ports:` sections from infrastructure services in the production compose file. Services within the Docker network can still reach them by container name (e.g., `postgres:5432`).

---

## 14. 🟡 MEDIUM — No Resource Limits on Containers

### What's the risk?

Without resource limits, a single misbehaving container (memory leak, CPU-bound loop, or an attacker triggering expensive operations) can consume all host resources, starving other services. This is a **Denial of Service (DoS)** vector.

### How to fix it

```yaml
# Add to each service in docker-compose.yml
services:
  auth-service:
    deploy:
      resources:
        limits:
          cpus: '0.50'      # Max 50% of one CPU core
          memory: 512M      # Max 512 MB RAM
        reservations:
          cpus: '0.25'
          memory: 256M
```

---

## 15. Vulnerability Summary Matrix

| # | Vulnerability | Severity | File(s) | Effort | Status |
|---|--------------|----------|---------|--------|--------|
| 1 | Demo OTP bypass (`123456`) | 🔴 CRITICAL | `auth.controller.js` L266 | 5 min | Fix needed |
| 2 | Hardcoded JWT secret fallback | 🔴 CRITICAL | `jwtAuth.js` L9, `auth.controller.js` L17 | 30 min | Fix needed |
| 3 | `.env` secrets in git history | 🔴 CRITICAL | `.env`, git history | 1 hour | Rotate secrets |
| 4 | Same JWT secret for access/refresh | 🟡 MEDIUM | `auth.controller.js` | 1 hour | Fix recommended |
| 5 | No XSS sanitization | 🟡 MEDIUM | All controllers | 1 hour | Fix recommended |
| 6 | No HTTPS enforcement | 🟡 MEDIUM | `api-gateway/index.js` | 15 min | Fix recommended |
| 7 | Redis without auth password | 🟡 MEDIUM | `docker-compose.yml` | 30 min | Fix recommended |
| 8 | RabbitMQ default credentials | 🟡 MEDIUM | `provision.azcli`, `docker-compose.yml` | 30 min | Fix recommended |
| 9 | No Docker image scanning | 🟡 MEDIUM | `ci.yml` | 1 hour | Add Trivy |
| 10 | No DB encryption at rest | 🟡 MEDIUM | Infrastructure | 2-3 hours | Migrate to managed DB |
| 11 | No refresh token rotation | 🟡 MEDIUM | `auth.controller.js` | 1 hour | Fix recommended |
| 12 | Exposed infrastructure ports | 🟡 MEDIUM | `docker-compose.yml` | 15 min | Remove port mappings |
| 13 | No container resource limits | 🟡 MEDIUM | `docker-compose.yml` | 30 min | Add limits |

---

> **Next:** [07 — DevOps & Security Glossary](./07_devops_security_glossary.md) — A comprehensive reference for every technical keyword and acronym in this project.
