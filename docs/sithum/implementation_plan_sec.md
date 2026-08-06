# Duothon 6.0 Phase 03 - Game Plan for Maximum Score

This plan outlines the required steps to secure the banking platform and fulfill all Phase 3 judging criteria, mapping directly to the 100% mark allocation detailed in the Phase 03 Booklet.

## User Review Required

> [!IMPORTANT]
> The plan includes critical changes to authorization logic and environment secrets. Review the proposed Key Vault implementation and RBAC enforcement to ensure they align with the team's testing procedures before proceeding.

## Open Questions

> [!WARNING]
>
> 1. Do we have an active Azure Subscription where we can provision Azure Key Vault and Application Insights for the final deployed link?
> 2. Do we want to implement a custom RBAC middleware across all services, or utilize an API Gateway-level RBAC check? (Plan currently proposes Gateway + Service level validation).

## Proposed Execution Phases

### Phase A: Critical Security Vulnerabilities (Blocks BOLA / IDOR)

**Impacts**: Security Practices (15%) + Environment Consistency (15%)
Judges will explicitly test for these vulnerabilities during the live evaluation.

- **Fix Role Escalation**: Hardcode `role: 'CUSTOMER'` during registration in `auth.controller.js` to prevent malicious payloads from self-assigning the 'ADMIN' role.
- **Implement Backend RBAC**: Add a `requireRole` middleware to Admin routes (e.g., `admin-service`).
- **Implement Ownership Checks**: Fix IDOR vulnerabilities in `account-service` and `transaction-service`. The API must verify `req.headers['x-user-id']` against the requested `accountId`.
- **Remove Demo OTP Bypass in Prod**: Gate `otp === '123456'` in `auth.controller.js` behind a strict `process.env.NODE_ENV !== 'production'` check.
- **Fix SQL Injection Flag**: Update `loan.controller.js` to use `prisma.$queryRaw` template literal instead of `$queryRawUnsafe`.

### Phase B: Secret Management & Configuration

**Impacts**: Automated Infrastructure (15%) + Security Practices (15%)

- **Remove Hardcoded Secrets**: Erase fallback secrets like `'aegisvault-super-secret-jwt-key-2026'` and DB passwords from `cd.yml` and `jwtAuth.js`.
- **Enforce SSL/TLS**: Change DB connection strings in `cd.yml` to `sslmode=require` and update API Gateway `CORS_ORIGIN` to explicitly list the frontend domain.
- **Azure Key Vault Integration (Optional but highly recommended)**: Modify the infrastructure scripts (`provision.azcli`) to deploy an Azure Key Vault, store secrets there, and map them to Container App environment variables.

### Phase C: Pipeline Hardening & Scalability

**Impacts**: Build & Release Automation (20%) + Scalability (10%)

- **Vulnerability Scanning**: Add a `trivy` or `npm audit` step in `.github/workflows/ci.yml`.
- **Auto-Scaling Configuration**: Modify `infrastructure/provision.azcli` to use `--min-replicas 1 --max-replicas 5` instead of `--max-replicas 1` for core services to demonstrate scaling under load.
- **Rollback Mechanism**: Document or script a redeployment command that fetches the `previous` image tag from Azure Container Registry.

### Phase D: Observability & System Health

**Impacts**: Operational Visibility (15%)

- **Distributed Tracing**: Generate an `x-request-id` in the API Gateway (`index.js`) and pass it to downstream services to allow end-to-end log correlation.

## Verification Plan

### Automated Tests

- Run `npm test` across all services to ensure no functionality breaks after RBAC/Ownership checks.
- Verify GitHub Actions CI triggers and passes successfully with new vulnerability scanning steps.

### Manual Verification

- Attempt to register as `ADMIN` via Postman (should be forced to `CUSTOMER`).
- Attempt to access `/api/accounts/:id/balance` of another user (should return 403 Forbidden).
- Verify Auto-scaling rules by inspecting Azure Container App configuration through Azure CLI.
