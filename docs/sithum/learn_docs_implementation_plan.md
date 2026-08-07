# AegisVault Learning Documentation Suite — Implementation Plan

> **Goal**: Create a set of comprehensive, self-contained markdown files in `docs/learn/` that teach you DevOps and Cybersecurity by using your own AegisVault codebase as the primary teaching material. Every concept is explained with theory **and** mapped to actual files/lines in your repo.

---

## Scope & Philosophy

You said you want to **learn something valuable**, not just know "these things exist." Each document will follow this teaching pattern:

1. **Theory / Concept** — What it is, why it exists, the keywords/acronyms explained
2. **How YOUR code implements it** — File references, code snippets, screenshots
3. **What's missing / limitations** — Gaps in your current system
4. **How to fix or improve** — Concrete steps with file paths

---

## Proposed Documents (9 files)

### Phase 1 — CI/CD & Docker Foundations (3 files)

#### [NEW] `01_cicd_pipeline_deep_dive.md`
Line-by-line walkthrough of both CI and CD pipelines with theory:
- **GitHub Actions concepts**: workflows, jobs, steps, runners, matrix strategies, `needs` (job dependencies), `if` conditionals
- **CI pipeline** (`ci.yml`): unit tests with Jest/Supertest, frontend build checks, Docker Compose validation, `npm audit` for supply chain security
- **CD pipeline** (`cd.yml`): change detection with `dorny/paths-filter`, Docker Buildx, Azure Container Registry push, parallel deployments, seed jobs
- **Keywords explained**: CI, CD, pipeline, runner, artifact, job matrix, fail-fast, SHA tagging, image tagging strategy (`:latest` vs `:sha`), build cache, layer caching
- **Screenshots embedded**: `github actions pipeline checks.png`, `github actions workflow history.png`, `github secrets & variables.png`
- **Limitations**: No Docker image scanning (Trivy), no branch protection, no rollback mechanism, no staging environment

#### [NEW] `02_docker_and_containerization.md`
Everything about how Docker works in this project:
- **Core theory**: What are containers vs VMs, images vs containers, layers, Dockerfile instructions (`FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`, `USER`), multi-stage builds
- **Your Dockerfile.template**: Line-by-line analysis — why `node:20-alpine`, builder vs runner pattern, non-root user (`expressuser`), layer caching strategy
- **Docker Compose**: Services, networks, volumes, healthchecks, `depends_on` with conditions, environment variable injection, `.dockerignore`
- **Keywords explained**: OCI, container runtime, image registry, ACR, layer caching, multi-stage build, bridge network, named volume, healthcheck probe
- **Screenshots embedded**: `local docker containers.png`
- **Limitations**: No resource limits (`mem_limit`/`cpus`), exposed infrastructure ports, no container security scanning

#### [NEW] `03_azure_cloud_and_deployment.md`
How your project lives in Azure:
- **Azure fundamentals**: Resource Groups, Azure Container Registry (ACR), Azure Container Apps, Container Apps Environments, ingress (internal vs external)
- **Your provisioning scripts**: Line-by-line walkthrough of `provision.azcli` and `provision-dbs.azcli` — what each `az` command does and why
- **Azure Container Apps architecture**: How your microservices map to Container Apps, how internal FQDN resolution works, how TLS termination happens, how scaling (min/max replicas) works
- **Monitoring & Metrics**: How to view logs in Azure portal, how to use Azure Log Analytics, what Grafana dashboards show, how to set up alerts
- **Screenshots embedded**: `azure resource groups & containers.png`, `api gateway info azure.png`, `api gateway logs & query history.png`, `api gateway dashboards with graffana.png`, `auth service graffana dashboard metrics.png`
- **Keywords explained**: ACR, ACA, SKU, FQDN, TLS termination, ingress controller, Container Apps Environment, revision, replica, auto-scaling rules

---

### Phase 2 — Kubernetes & Terraform (1 file)

#### [NEW] `04_kubernetes_and_terraform.md`
Where K8s and Terraform would fit — and why your app works without them:
- **Kubernetes theory**: Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, Namespaces, HPA, liveness/readiness probes, rolling updates
- **How K8s maps to your system**: Your `docker-compose.yml` services → K8s Deployments, your Docker network → K8s Service discovery, your healthchecks → K8s probes, your `restart: always` → K8s restart policies
- **Sample K8s manifests**: Example YAML for deploying your `auth-service` as a K8s Deployment + Service (teaching by example)
- **Terraform theory**: IaC (Infrastructure as Code), providers, resources, state, plan, apply, modules, variables
- **How Terraform maps to your system**: Your `provision.azcli` shell scripts → Terraform `azurerm` resources, why IaC is better than imperative scripts
- **Sample Terraform config**: Example `.tf` file that would provision your Azure Container Apps Environment and ACR
- **Why your app still runs without them**: Azure Container Apps is a managed platform that abstracts away K8s — it IS Kubernetes under the hood (KEDA, Envoy, Dapr sidecar). Your `provision.azcli` scripts do what Terraform would do, but imperatively
- **Impact analysis**: What you gain (GitOps, reproducibility, self-healing, HPA, canary deployments) vs what you trade (complexity, learning curve)
- **Keywords explained**: IaC, HPA, KEDA, Envoy, Dapr, Pod, Deployment, Service, Ingress, ConfigMap, state file, drift detection, GitOps

---

### Phase 3 — Cybersecurity Deep Dives (3 files)

#### [NEW] `05_cybersecurity_features_implemented.md`
Every security feature in your system explained with theory AND code:
- **Authentication chain**: Bcrypt hashing → MFA OTP → JWT access/refresh tokens (full flow diagram)
  - Code: `auth.controller.js`, `otp.js`, `jwtAuth.js`
  - Theory: password hashing vs encryption, cost factors, timing attacks, CSPRNG, HMAC-SHA256, JWT structure (header.payload.signature)
- **API Gateway security layer**: Helmet.js headers, CORS, rate limiting, reverse proxy pattern
  - Code: `index.js`, `rateLimiter.js`, `proxy.js`
  - Theory: OWASP Top 10, CSP, HSTS, X-Frame-Options, Same-Origin Policy, CORS preflight
- **Financial security**: ACID transactions, fraud engine, cryptographic audit trail
  - Code: `account.controller.js`, `fraudEngine.js`, `auditEngine.js`
  - Theory: ACID properties, double-spend prevention, hash chains, tamper detection
- **Input validation**: Zod schemas, Prisma parameterized queries, body size limits
  - Code: `validation.js`, various controllers
  - Theory: SQL injection, XSS, NoSQL injection, parameterized queries, schema validation
- **Infrastructure security**: Internal vs external ingress, non-root containers, Docker network isolation
  - Code: `provision.azcli`, `Dockerfile.template`, `docker-compose.yml`
  - Theory: defense-in-depth, principle of least privilege, network segmentation

#### [NEW] `06_security_vulnerabilities_and_fixes.md`
Based on your security audit — every vulnerability explained with exact fix locations:
- **Critical issues**: Demo OTP bypass, hardcoded JWT secrets, `.env` with real secrets in git history, DB password fallbacks in CD
  - Exact files, line numbers, and fix code
  - Theory: secret rotation, defense against credential leakage, git history scrubbing
- **Medium issues**: No XSS sanitization, same JWT secret for access/refresh, proxy `secure: false`, no HTTPS redirection, Redis without auth, RabbitMQ default credentials
  - Theory: XSS types (stored, reflected, DOM), TLS/SSL, mTLS, token signing best practices
- **Infrastructure issues**: No resource limits, exposed ports, no database encryption at rest, no field-level PII encryption
  - Theory: AES-256, encryption at rest vs in transit, PII handling under GDPR/CCPA
- **Priority-ordered fix guide**: Each fix with the file to change, the function to modify, and a before/after code snippet

#### [NEW] `07_devops_security_glossary.md`
A comprehensive glossary of every technical keyword/acronym encountered in this project:
- Organized by domain: CI/CD, Containerization, Cloud, Networking, Cryptography, Web Security, Infrastructure
- Each entry: Full name, one-paragraph explanation, how it relates to AegisVault
- ~80+ terms covering: ACR, ACID, AES, AMQP, APM, BOLA, CORS, CSPRNG, CSP, CVE, FQDN, GitOps, HMAC, HPA, HSTS, IaC, IDOR, JWT, KEDA, mTLS, OWASP, RBAC, SHA, SKU, TLS, XSS, etc.

---

### Phase 4 — Production Operations (1 file)

#### [NEW] `08_monitoring_and_production_operations.md`
How to monitor, debug, and operate this system in production:
- **Observability pillars**: Logs, Metrics, Traces — what each gives you
- **Your logging setup**: Winston structured JSON logging, request logging middleware, log levels
  - Code: `logger.js` in each service
- **Azure monitoring**: How to access Container Apps logs, Azure Monitor, Log Analytics queries (KQL basics)
- **Grafana dashboards**: What the screenshots show, how to read them, what metrics matter (request rate, error rate, latency percentiles, memory usage)
  - Screenshots embedded: `api gateway dashboards with graffana.png`, `auth service graffana dashboard metrics.png`
- **Health checks**: How your `/health` endpoints work, what Azure probes do, liveness vs readiness vs startup probes
- **Incident response**: What to do when a service goes down, how to read logs, how to roll back, circuit breaker patterns
- **Missing pieces**: No centralized log aggregation, no distributed tracing (correlation IDs partially implemented), no APM, no alerting on security events
- **Keywords explained**: APM, KQL, SLI, SLO, SLA, MTTR, MTTF, P50/P95/P99, golden signals, RED method, USE method

---

### Phase 5 — Testing Deep Dives (1 file)

#### [NEW] `09_integration_testing_deep_dive.md`
Detailed explanation of how integration tests are implemented across your microservices:
- **Testing theory**: Unit vs. Integration vs. E2E testing, test doubles (mocks/stubs), test-driven development (TDD), Supertest + Jest architecture
- **Auth Service tests** (`auth.test.js`): How you mock Prisma and Redis to test authentication flows, JWT generation, and bcrypt hashing without hitting real DBs.
- **Transaction & Account Service tests**: Mocking HTTP calls (Axios) to other services (like Account calling Transaction), RabbitMQ publisher mocking, and verifying `$transaction` logic.
- **Notification & Admin tests**: Testing cross-service workflows like the Fraud Engine and Admin unlock endpoints.
- **Keywords explained**: Mocking, stubbing, assertion, Supertest, Jest, test suite, test coverage, CI test execution, test isolation.
- **Limitations**: Tests are heavily mocked (pure unit/narrow integration) rather than using a real test DB (like Testcontainers), which might miss actual database constraint errors.

---

## Verification Plan

### Manual Verification
- Each file compiles valid markdown with working relative links to source files
- All screenshots referenced actually exist in `public/screenshots/`
- Code snippets match the actual current codebase
- Mermaid diagrams render correctly

> [!IMPORTANT]
> This will produce **9 comprehensive markdown files** totaling approximately **2,500–3,500 lines** of learning content. Each file is standalone but they build on each other in sequence. The existing files in `docs/learn/` (`security_concepts_explained.md` and `post_competition_devops_interview_guide.md`) will be preserved — the new files complement rather than replace them.

> [!NOTE]
> The numbering (01–09) creates a natural reading order: foundations → cloud → advanced infrastructure → security → operations → testing. You can read them in any order, but the numbered sequence is recommended for first-time learning.
