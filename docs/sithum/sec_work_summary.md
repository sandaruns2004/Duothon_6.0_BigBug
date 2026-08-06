# Security Fixes & DevOps Enhancements Summary

This document summarizes the progress we've made so far to secure the AegisVault application for Duothon 6.0 Phase 03. We've tackled the most critical vulnerabilities that were identified in the security audit report.

Here is a simple breakdown of each issue and how we fixed it:

---

## 1. Prevented Privilege Escalation on Registration
**The Issue:** 
When a new user signed up, the API was accepting a `role` field directly from the user's request. A malicious user could intercept their registration request, add `"role": "ADMIN"`, and instantly gain full administrative privileges over the entire system.

**Our Solution:** 
We modified the user creation logic in `auth.controller.js` to completely ignore any role sent by the user. We hardcoded `role: 'CUSTOMER'` so that every new signup is strictly a customer by default.

## 2. Enforced Backend Role-Based Access Control (RBAC)
**The Issue:** 
While the frontend hid admin buttons from normal users, the backend `admin-service` itself had zero role checks. Any normal customer who knew the API URLs (like `/api/admin/dashboard` or `/api/admin/users/:id/suspend`) could execute them just by being logged in.

**Our Solution:** 
We created a new security middleware (`rbac.middleware.js`) that checks the `x-user-role` header (injected securely by the API gateway). We applied this middleware to all routes in `admin.routes.js`, ensuring that only users with the `ADMIN` or `OFFICER` roles can access these sensitive endpoints.

## 3. Fixed Insecure Direct Object Reference (IDOR) Vulnerabilities
**The Issue:** 
The application suffered from IDOR vulnerabilities in the `account-service` and `transaction-service`. A logged-in user could check the balance, view transaction details, or even execute a transfer from another person's account simply by changing the `accountId` in their request.

**Our Solution:** 
We added ownership checks across these endpoints. We extract the `x-user-id` header (the logged-in user's true identity) and compare it against the owner of the requested account or transaction. If they don't match (and the user isn't an `ADMIN`), we immediately block the request with a `403 Access Denied` error.

## 4. Secured API Gateway CORS Configuration
**The Issue:** 
Cross-Origin Resource Sharing (CORS) was set to `*`, meaning any website on the internet could make API requests to our backend. This is dangerous as it allows malicious websites to trick logged-in users' browsers into executing unwanted actions.

**Our Solution:** 
We updated the GitHub Actions deployment pipeline (`cd.yml`). During deployment, the pipeline now dynamically fetches the actual URL of our deployed frontend (`CLIENT_URL`) and securely passes it to the API gateway as the `CORS_ORIGIN` environment variable. Now, only our official frontend can talk to our API.

## 5. Eliminated SQL Injection Risks
**The Issue:** 
In `loan.controller.js`, the code used Prisma's `$queryRawUnsafe` function. While the developer attempted to parameterize it, using the `Unsafe` variant is highly discouraged and is a red flag for security scanners and competition judges as it can lead to SQL injection attacks.

**Our Solution:** 
We replaced `$queryRawUnsafe` with Prisma's standard `$queryRaw` tagged template literal (`await prisma.$queryRaw\`SELECT ... \``). This is the industry-standard, secure way to run raw SQL in Prisma, as it guarantees safe parameterization.

## 6. Enforced Encrypted Database Connections
**The Issue:** 
In the Continuous Deployment (`cd.yml`) pipeline, the PostgreSQL database connection strings were explicitly set to `sslmode=disable`. This means sensitive database traffic (including passwords and financial data) was being transmitted without encryption.

**Our Solution:** 
We updated all database connection strings in the `cd.yml` file to use `sslmode=require`. This ensures that all communication between our containerized microservices and the PostgreSQL database is fully encrypted in transit.

## 7. Added Vulnerability Scanning to CI Pipeline
**The Issue:** 
The automated GitHub Actions CI pipeline installed dependencies without checking for known security vulnerabilities (using the `--no-audit` flag). This meant we could unknowingly deploy code with compromised or vulnerable packages.

**Our Solution:** 
We added a dedicated `npm audit --audit-level=high` step to the CI pipeline (`ci.yml`). If any high-severity vulnerabilities are found in our Node.js dependencies during a build, the pipeline will log them, allowing developers to catch supply chain attacks early.

## 8. Implemented Request Correlation IDs for Distributed Tracing
**The Issue:** 
In a microservices architecture, debugging errors is difficult because a single user request often travels across multiple services (e.g., Gateway -> Transaction Service -> Account Service). Without a unique identifier, it's impossible to trace a single request's journey through the logs.

**Our Solution:** 
We updated the API Gateway (`index.js`) to generate a unique `x-request-id` (UUID) for every incoming request. This ID is attached to the request headers and passed downstream to all other microservices, making log correlation and debugging seamless.

## 9. Added OTP Brute-Force Rate Limiting
**The Issue:** 
The MFA (OTP) verification endpoint didn't limit the number of attempts a user could make. A malicious actor could repeatedly guess the 6-digit OTP until they got it right, bypassing the Multi-Factor Authentication.

**Our Solution:** 
We implemented a strict 5-attempt limit in `auth.controller.js`. We use Redis to track failed attempts using a `mfa_attempts` key. Once 5 incorrect attempts are made, the OTP is completely destroyed from Redis, and the user must request a new one, stopping brute-force attacks in their tracks.

## 10. Restricted Internal Endpoints at the API Gateway
**The Issue:** 
Several microservices had internal-only endpoints (like `/api/loans/internal/pending`) designed to be called only by other microservices. However, the API Gateway was blindly proxying *all* requests, meaning an external user could access these internal endpoints if they knew the URL.

**Our Solution:** 
We added a security middleware in the API Gateway (`index.js`) that intercepts all requests. If the requested path contains `/internal`, the Gateway immediately blocks it with a `403 Forbidden` error, ensuring these endpoints are strictly reserved for inter-service communication.

## 11. Enforced Strict Zod Input Validation on Financial Endpoints
**The Issue:** 
While some endpoints used proper Zod validation schemas, critical financial endpoints (like account debit and credit) relied on weak, ad-hoc checks (like `isNaN`). This could lead to edge-case exploitation if a user sent unexpected JSON structures.

**Our Solution:** 
We created robust Zod validation schemas (e.g., `debitCreditSchema`) in the account service's `validation.js` and applied them as middleware in `account.routes.js`. This guarantees that all incoming requests strictly adhere to the expected format and types before any business logic is executed.
