# AegisVault Documentation Index

Welcome to the AegisVault documentation repository. The documentation is organized into technical subdirectories based on topic and component focus.

---

## Directory Structure

```
docs/
├── architecture/
├── devops_and_security/
├── features_and_guides/
├── learn/
├── project_phases/
└── testing/
```

---

## Document Index

### 1. DevOps & Security Learning Suite (`docs/learn/`)
Comprehensive self-study modules built around the AegisVault codebase:
- [01 — CI/CD Pipeline Deep Dive](learn/01_cicd_pipeline_deep_dive.md) — Line-by-line breakdown of GitHub Actions CI/CD workflows (`ci.yml` and `cd.yml`).
- [02 — Docker & Containerization Deep Dive](learn/02_docker_and_containerization.md) — Multi-stage Dockerfiles, Docker Compose orchestration, networking, and volumes.
- [03 — Azure Cloud & Deployment Deep Dive](learn/03_azure_cloud_and_deployment.md) — Azure Container Apps (ACA), Container Registry (ACR), ingress, and TLS termination.
- [04 — Kubernetes & Terraform](learn/04_kubernetes_and_terraform.md) — Cloud-native infrastructure, K8s manifests, Terraform IaC, and KEDA/Envoy abstractions.
- [05 — Cybersecurity Features Implemented](learn/05_cybersecurity_features_implemented.md) — Auth chain, bcrypt, MFA/OTP, JWTs, ACID transfers, fraud engine, and cryptographic audit hash chain.
- [06 — Security Vulnerabilities & Fixes](learn/06_security_vulnerabilities_and_fixes.md) — Audit report vulnerabilities, attack scenarios, and code diff fixes.
- [07 — DevOps & Security Glossary](learn/07_devops_security_glossary.md) — 80+ technical terms and acronyms across 8 domains with AegisVault context.
- [08 — Monitoring & Production Operations](learn/08_monitoring_and_production_operations.md) — Observability pillars, Winston JSON logging, Log Analytics (KQL), Grafana dashboards, and incident response.
- [09 — Integration Testing Deep Dive](learn/09_integration_testing_deep_dive.md) — Supertest + Jest architecture, mock doubles, and microservice test suites.
- [Post-Competition DevOps Interview Guide](learn/post_competition_devops_interview_guide.md) — Interview prep and technical Q&A based on AegisVault.
- [Security Concepts Explained](learn/security_concepts_explained.md) — High-level security concepts breakdown.

### 2. Architecture (`docs/architecture/`)
- [System Architecture Guide](architecture/system_architecture_guide.md) — Technical overview of microservices, databases, state machines, and design patterns.
- [Azure Deployment Plan](architecture/azure_deployment_plan.md) — Production deployment strategy using Azure Container Apps (ACA).

### 3. Testing & Diagnostics (`docs/testing/`)
- [Manual Testing Guide](testing/manual_testing_guide.md) — Complete walkthrough for manual QA and testing API routes.
- [Defect Diagnosis](testing/defect_diagnosis.md) — Root-cause analysis and investigation notes for key system defects.
- [Testing Fixed Defects](testing/testing_fixed_defects.md) — Verification procedures and results for resolved issues.

### 4. Features & User Guides (`docs/features_and_guides/`)
- [Basic Features](features_and_guides/basic_features.md) — Breakdown of baseline features and web application functionality.
- [Loans & KYC Guide](features_and_guides/loans_and_kyc_guide.md) — Detailed workflow for User KYC verification and Loan application lifecycle.
- [Transfers & Transactions Guide](features_and_guides/transfers_and_transactions_guide.md) — Mechanics of fund transfers, rate limiting, and transaction histories.

### 5. DevOps & Security (`docs/devops_and_security/`)
- [CI/CD Guide](devops_and_security/ci_cd.md) — GitHub Actions CI/CD workflows and automated container deployment details.
- [Security Audit Report](devops_and_security/security_audit_report.md) — Audit report analyzing authentication, encryption, secrets management, and OWASP compliance.

### 6. Project Milestones (`docs/project_phases/`)
- [Phase 3 Booklet](project_phases/phase03-booklet.md) — Milestone submission reference and phase guidelines.
