# Security & DevOps Implementation Task List

This task list is based on the Priority Action Matrix from the `security_audit_report.md` and the requirements for Duothon 6.0 Phase 03.

## Phase 1 — Critical Fixes (High Impact, Fix Before Competition)

- [x] **1. Add RBAC middleware to all backend services** (Gateway + Service Level Validation)
- [x] **2. Hardcode `role: 'CUSTOMER'` on registration** (Prevent privilege escalation in `auth.controller.js`)
- [ ] **3. Add account ownership checks** (Block IDOR attacks in `account-service` and `transaction-service`)
- [ ] **4. Gate demo OTP bypass behind `NODE_ENV`** (Prevent bypass in prod in `auth.controller.js`)
- [ ] **5. Remove hardcoded secret fallbacks** (Remove JWT and DB password fallbacks in `cd.yml` and `jwtAuth.js`)
- [ ] **6. Set `CORS_ORIGIN` to actual domain** (API gateway env config)
- [ ] **7. Fix `$queryRawUnsafe` usage** (Remove SQL injection flag in `loan.controller.js`)
- [ ] **8. Enable `sslmode=require` on DB connections** (Update `cd.yml` env vars)

## Phase 2 — Strengthen (Medium Impact, Moderate Effort)

- [ ] **9. Add vulnerability scanning to CI** (Implement `npm audit` / `trivy` in GitHub Actions)
- [ ] **10. Integrate Azure Key Vault for secrets** (Since we have an active Azure Subscription)
- [ ] **11. Add request correlation IDs (`x-request-id`)** (For better observability across services)
- [ ] **12. Add OTP brute-force limiting** (Max 5 attempts before requiring a new OTP)
- [ ] **13. Restrict internal endpoints with middleware** (Block internal API abuse)
- [ ] **14. Add Zod validation to transaction/account services** (Ensure strict input validation)
- [ ] **15. Configure Azure Container Apps auto-scaling** (e.g., `--min-replicas 1 --max-replicas 5` in `provision.azcli`)
- [ ] **16. Add rollback mechanism** (In CD workflow)

## Phase 3 — Polish (Nice to Have)

- [ ] **17. Add Azure Application Insights for APM** (For centralized logging and tracing)
- [ ] **18. Implement refresh token rotation**
- [ ] **19. Add circuit breaker pattern (opossum)**
- [ ] **20. Configure database backup automation**
- [ ] **21. Add `SELECT FOR UPDATE` for stricter row locking**
- [ ] **22. Field-level PII encryption (AES-256)**
- [ ] **23. Run containers as non-root user**

---

_Note: Update this task list continuously as items are completed._
