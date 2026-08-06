# Deep Analysis: Login Failure

> **Date**: 2026-08-06
> **Status**: 🔴 BROKEN
> **Component**: Authentication Service & Database Initialization

## 1. Description of the Flaw
When a user attempts to sign in via the AegisVault login page, the system responds with a generic `500 Internal Server Error` and displays the message:
`An error occurred during authentication. Please try again later.`

This error completely blocks all users (including demo accounts like `customer1@aegisvault.com` and `admin@aegisvault.com`) from accessing the system. 

## 2. Root Cause Analysis

### The Primary Cause: Prisma TLS Handshake Failure
By querying the Azure Container Apps console logs for the `auth-service`, the following fatal error is logged during the login attempt:

```
PrismaClientInitializationError: 
Invalid `prisma.user.findUnique()` invocation in
/app/src/controllers/auth.controller.js:102:36

Error opening a TLS connection: error performing TLS handshake: server does not support TLS
```

1. **Configuration Mismatch:** In the CI/CD deployment workflow (`.github/workflows/cd.yml`), the `DATABASE_URL` environment variable for all microservices is configured with the parameter `?sslmode=require`:
   ```bash
   DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=require"
   ```
2. **Server Capability:** The internal PostgreSQL database is provisioned in Azure via `infrastructure/provision-dbs.azcli` using a basic `postgres:16-alpine` Docker image. By default, this image is **not** configured to support SSL/TLS connections over the internal network.
3. **The Result:** When Prisma attempts to query the database using `prisma.user.findUnique()`, it strictly enforces a TLS connection due to `sslmode=require`. The Postgres server rejects the handshake, causing a `PrismaClientInitializationError` which is caught by the `login` function's `catch` block, returning the generic 500 error to the client.

### The Secondary Cause: Silent Failure of the Database Seeding Job
A secondary issue caused by this TLS configuration is that the database is completely empty. 
1. The database initialization job (`db-seed-job`) uses the exact same `DATABASE_URL` with `sslmode=require`. 
2. When the `seed-demo.js` script runs, the Prisma `db push` operations and user creation queries all fail with the exact same TLS handshake error.
3. However, the `seed-demo.js` script wraps these operations in `try/catch` blocks and **does not throw or exit with a non-zero code** when the database connection fails. 
4. This causes the Azure Container App Job to incorrectly report a `Succeeded` execution status, hiding the fact that the demo users (e.g., `customer1@aegisvault.com`) and schemas were never created.

## 3. Review of Other Claimed Flaws

### Rate Limiting Middleware Flaw
The documentation (`docs/ranuja/todo/rate_limiting_flaw_details.md`) describes an issue where the authenticated rate limiter is placed *before* the JWT middleware in the API Gateway. 
**Status: Fixed.** A review of `services/api-gateway/src/index.js` confirms that the `jwtAuthMiddleware` is now correctly placed before the `authenticatedRateLimiter`.

### Resend OTP Button Non-Functional
The documentation (`docs/ranuja/resendbutton.md`) states that the "Resend Code" button on the frontend lacks an API call and that the backend lacks a `/resend-otp` endpoint.
**Status: Fixed.** A review of the codebase confirms that:
- The backend `auth-service` has the `resendOtp` endpoint fully implemented in `auth.controller.js` and wired in `auth.routes.js`.
- The frontend `verify-otp/page.tsx` correctly invokes the asynchronous `authApi.resendOtp()` method.

## 4. Remediation Plan

To restore login functionality and proper database seeding, the connection string in the GitHub Actions workflow must be corrected.

1. **Modify `.github/workflows/cd.yml`**:
   Change the `sslmode` parameter in the `DB_BASE` variable from `require` to `disable` (or omit it, as Prisma defaults to preferring but not requiring SSL unless explicitly told).
   ```bash
   # From:
   DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=require"
   
   # To:
   DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=disable"
   ```
2. **Re-trigger the CI/CD Pipeline**:
   Push the changes to trigger a re-deployment. This will update the environment variables for all microservices.
3. **Re-run the Seed Job**:
   Once the connection string is corrected, the `db-seed-job` will successfully connect to Postgres, push the schemas, and create the demo users.
