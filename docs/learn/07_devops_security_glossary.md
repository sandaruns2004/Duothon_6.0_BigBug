# 07 — DevOps & Cybersecurity Glossary

> An encyclopedic reference of every technical term, acronym, and keyword encountered across the AegisVault project. Organized by domain with AegisVault-specific context.

---

## How to Use This Glossary

Each entry follows this format:
- **Full Name** — What the acronym stands for
- **Definition** — What it is and why it matters
- **In AegisVault** — How or where it appears in your project

---

## CI/CD & DevOps

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **CI** | Continuous Integration | Automatically building and testing every code change on push/PR. Catches bugs before they reach production. | `ci.yml` runs Jest tests, frontend build check, and Docker Compose validation. |
| **CD** | Continuous Deployment | Automatically deploying validated code to production after CI passes. | `cd.yml` builds Docker images, pushes to ACR, and updates Azure Container Apps. |
| **Pipeline** | CI/CD Pipeline | A sequence of automated stages (build → test → deploy) triggered by code changes. | Two pipelines: CI (test/build) and CD (deploy). |
| **Runner** | GitHub Actions Runner | A virtual machine that executes workflow jobs. Destroyed after the job completes. | `runs-on: ubuntu-latest` provisions a fresh Ubuntu VM for each job. |
| **Workflow** | GitHub Actions Workflow | An automated process defined in a `.yml` file triggered by events. | `ci.yml` and `cd.yml` are your two workflows. |
| **Job** | Workflow Job | A set of steps running on a single runner. Jobs run in parallel by default. | `unit-tests`, `frontend-check`, `docker-compose-test` are CI jobs. |
| **Step** | Workflow Step | A single task within a job: either a shell command or reusable action. | Each `- name:` block in a workflow is a step. |
| **Action** | GitHub Action | A reusable, versioned step available on GitHub Marketplace. | `actions/checkout@v4`, `docker/build-push-action@v5`. |
| **Matrix** | Matrix Strategy | Runs the same job with different configurations in parallel. | `matrix: node-version: [20.x]` in CI. |
| **Secrets** | GitHub Encrypted Secrets | Encrypted key-value pairs stored in GitHub Settings, injected at runtime as env vars. | `AZURE_CREDENTIALS`, `JWT_SECRET`, `DB_PASSWORD`, etc. |
| **Artifact** | Build Artifact | A file produced during a build (e.g., compiled code, test reports) stored for later stages. | Not explicitly used; Docker images serve as your deployment artifacts. |
| **`fail-fast`** | Matrix Fail-Fast | When true, one failing matrix job cancels all others. When false, they continue independently. | Set to `false` in CD so one service failure doesn't block others. |
| **`needs`** | Job Dependency | Specifies that a job waits for another to complete before starting. | `docker-compose-test` needs `[unit-tests, frontend-check]`. |
| **SHA** | Secure Hash Algorithm | A cryptographic hash function. In DevOps, commonly refers to the git commit hash. | Docker images are tagged with `${{ github.sha }}` for traceability. |
| **GitOps** | Git Operations | Using Git as the single source of truth for declarative infrastructure and deployment. | Not fully implemented. Would require Terraform + ArgoCD. |
| **Rollback** | Deployment Rollback | Reverting to a previously known-good version after a bad deployment. | Not implemented. Would use `az containerapp revision activate`. |

---

## Containerization & Docker

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **Docker** | Docker Engine | Platform for building, running, and distributing containerized applications. | All services run as Docker containers. |
| **Container** | Linux Container | A lightweight, isolated process with its own filesystem, built from an image. | 10 containers: 6 services + client + postgres + redis + rabbitmq. |
| **Image** | Container Image | A read-only template for creating containers. Built from a Dockerfile. | Each service has a Dockerfile that produces an image. |
| **Dockerfile** | Docker Build File | A text file with sequential instructions for building a Docker image. | `Dockerfile.template` is the standardized template. |
| **Layer** | Image Layer | Each Dockerfile instruction creates a cached, reusable layer. | `COPY package*.json` before `npm ci` optimizes layer caching. |
| **Multi-stage Build** | Multi-stage Dockerfile | Uses multiple `FROM` statements to separate build tools from runtime. | Builder stage installs dependencies; Runner stage copies only the result. |
| **Alpine** | Alpine Linux | A minimal (~5MB) Linux distribution used as Docker base image. | All images use Alpine variants (e.g., `node:20-alpine`). |
| **Compose** | Docker Compose | Tool for defining multi-container applications in a single YAML file. | `docker-compose.yml` defines all 10 services. |
| **Bridge Network** | Docker Bridge Network | Default isolated virtual network where containers communicate by name. | `aegisvault-network` connects all services. |
| **Named Volume** | Docker Named Volume | Docker-managed persistent storage that survives container restarts. | `pgdata` volume stores PostgreSQL data. |
| **Bind Mount** | Docker Bind Mount | Directly maps a host directory into a container. | `./scripts/init-schemas.sql` mounted into Postgres. |
| **Build Context** | Docker Build Context | The directory sent to the Docker daemon for building. Only these files are accessible. | Each service's directory is its build context. |
| **Registry** | Container Registry | A server that stores and distributes container images. | Azure Container Registry (ACR) stores your images. |
| **OCI** | Open Container Initiative | Industry standard for container image and runtime formats. | Docker images follow OCI specifications. |
| **Buildx** | Docker Buildx | Extended build tool using BuildKit for advanced features (multi-platform, caching). | Used in CD pipeline: `docker/setup-buildx-action@v3`. |
| **Healthcheck** | Container Health Check | A command Docker runs periodically to determine if a container is healthy. | `pg_isready`, `redis-cli ping`, `rabbitmq-diagnostics ping`. |
| **Ephemeral** | Temporary/Short-lived | Containers are ephemeral — data inside is lost when the container is destroyed. | All containers except those with volumes lose data on restart. |
| **cgroups** | Control Groups | Linux kernel feature that limits container CPU, memory, and I/O usage. | Not configured — no resource limits set. |
| **Namespaces** | Linux Namespaces | Linux kernel feature that isolates container processes, networks, and filesystems. | Automatically applied by Docker to every container. |

---

## Cloud & Azure

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **ACR** | Azure Container Registry | Microsoft's managed Docker image registry service. | `aegisvaultacrrw5v9v.azurecr.io` stores all service images. |
| **ACA** | Azure Container Apps | Serverless container platform built on Kubernetes, managed by Microsoft. | Hosts all production services. |
| **AKS** | Azure Kubernetes Service | Fully managed Kubernetes cluster service on Azure. ACA is built on top of it. | ACA uses AKS under the hood. |
| **FQDN** | Fully Qualified Domain Name | Complete hostname for a resource (e.g., `auth-service.internal.blueice.eastus.azurecontainerapps.io`). | Each Container App gets an FQDN for networking. |
| **SKU** | Stock Keeping Unit | Microsoft's pricing/feature tier designation (e.g., Basic, Standard, Premium). | ACR uses `Basic` SKU. |
| **Resource Group** | Azure Resource Group | A logical container that holds related Azure resources for management and billing. | `aegisvault-rg` groups all project resources. |
| **Service Principal** | Azure Service Principal | A machine-to-machine identity for automated Azure access (like a robot account). | Used in `AZURE_CREDENTIALS` secret for CD pipeline. |
| **TLS Termination** | TLS Termination | Decrypting HTTPS at the network edge (proxy) before forwarding plain HTTP to backends. | Azure's Envoy proxy handles TLS termination for all external services. |
| **Ingress** | Network Ingress | The entry point for network traffic into a containerized environment. | `external` (internet-accessible) vs `internal` (private). |
| **Scale to Zero** | Scale to Zero | A serverless feature where idle services spin down to 0 instances, costing nothing. | `--min-replicas 0` on most services. |
| **Cold Start** | Cold Start Latency | The 2-5 second delay when a request hits a service that was scaled to zero. | Expected on first request after idle period. |
| **Revision** | Container App Revision | An immutable snapshot of a Container App's configuration and image. Supports rollback. | Each `az containerapp update` creates a new revision. |
| **Log Analytics** | Azure Log Analytics | Centralized logging service where container stdout is automatically ingested. | Winston JSON logs are queryable via KQL. |

---

## Kubernetes

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **K8s** | Kubernetes | Open-source container orchestration platform. Manages container deployment, scaling, and networking. | ACA runs on Kubernetes invisibly. |
| **Pod** | Kubernetes Pod | Smallest deployable unit in K8s. Usually contains one container. | Each service would be a Pod in raw K8s. |
| **Deployment** | K8s Deployment | Manages identical Pod replicas and handles rolling updates. | Equivalent to your `restart: always` + container definition. |
| **Service** | K8s Service | Stable IP/DNS for load-balancing traffic across Pods. | Equivalent to Docker's DNS resolution by container name. |
| **Ingress** | K8s Ingress | Routes external HTTP/HTTPS traffic to internal Services. | Equivalent to Azure's external ingress + Envoy. |
| **ConfigMap** | K8s ConfigMap | Stores non-sensitive configuration as key-value pairs, injected as env vars. | Equivalent to `environment:` in docker-compose.yml. |
| **HPA** | Horizontal Pod Autoscaler | Automatically scales Pod count based on CPU/memory metrics. | Not used directly; KEDA provides this for ACA. |
| **KEDA** | Kubernetes Event-driven Autoscaling | Scales pods based on external events (HTTP requests, queue depth). | Powers ACA's `--min-replicas 0` scaling. |
| **Envoy** | Envoy Proxy | High-performance proxy used for routing, load balancing, and observability. | Powers ACA's ingress and TLS termination. |
| **Dapr** | Distributed Application Runtime | Portable APIs for microservice patterns (pub/sub, state, bindings). | Available in ACA but not explicitly enabled. |
| **Liveness Probe** | K8s Liveness Probe | Health check that restarts a container if it fails. | Your `/health` endpoints serve this purpose. |
| **Readiness Probe** | K8s Readiness Probe | Health check that removes a container from load balancing until it's ready. | Not configured in ACA provisioning. |

---

## Infrastructure as Code

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **IaC** | Infrastructure as Code | Managing cloud resources through code files instead of manual UI clicks. | `provision.azcli` is imperative IaC; Terraform would be declarative. |
| **Terraform** | HashiCorp Terraform | Declarative IaC tool that manages cloud resources across providers. | Not used. Recommended replacement for `.azcli` scripts. |
| **Bicep** | Azure Bicep | Microsoft's declarative IaC language for Azure (alternative to Terraform). | Not used. |
| **State File** | Terraform State | JSON file mapping real cloud resources to Terraform configuration. | Would be `terraform.tfstate` if Terraform were adopted. |
| **Drift** | Configuration Drift | When actual infrastructure differs from what's defined in code. | Risk with `.azcli` scripts — no drift detection. |
| **Provider** | Terraform Provider | Plugin that interfaces Terraform with a cloud platform (e.g., `azurerm`). | Would use the `azurerm` provider for Azure. |
| **HCL** | HashiCorp Configuration Language | The declarative language used to write Terraform files (`.tf`). | Not currently used. |

---

## Cryptography & Security

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **JWT** | JSON Web Token | Self-contained signed token for stateless authentication (header.payload.signature). | Access tokens (15m) and refresh tokens (7d). |
| **HMAC** | Hash-based Message Authentication Code | A method for computing a message authentication code using a hash function and a secret key. | JWT uses HMAC-SHA256 (`HS256`) for signing. |
| **SHA-256** | Secure Hash Algorithm 256-bit | A one-way cryptographic hash function producing a 256-bit (64-char hex) digest. | OTP hashing, refresh token hashing, audit trail hashing. |
| **Bcrypt** | Blowfish Crypt | An adaptive password hashing function with built-in salt and configurable cost factor. | Password storage with cost factor 12. |
| **Salt** | Cryptographic Salt | Random data added to input before hashing to prevent rainbow table attacks. | Bcrypt generates a unique salt per password automatically. |
| **CSPRNG** | Cryptographically Secure PRNG | A random number generator suitable for cryptographic use (unpredictable output). | `crypto.randomInt()` for OTP generation. |
| **PRNG** | Pseudo-Random Number Generator | A deterministic algorithm that produces numbers that appear random but are predictable. | `Math.random()` — NOT used for security in AegisVault (correctly avoided). |
| **AES-256** | Advanced Encryption Standard | Symmetric encryption algorithm with 256-bit key. Industry standard for data encryption. | Not implemented. Recommended for PII field-level encryption. |
| **TLS** | Transport Layer Security | Cryptographic protocol for secure communication over networks. | Azure provides TLS for external ingress. |
| **SSL** | Secure Sockets Layer | Obsolete predecessor to TLS. Often used colloquially to mean TLS. | Referenced in `sslmode` database connection parameter. |
| **mTLS** | Mutual TLS | TLS where both client and server present certificates for authentication. | Not implemented. Would strengthen inter-service communication. |
| **Hash Chain** | Cryptographic Hash Chain | A sequence of hashes where each includes the previous hash, enabling tamper detection. | `auditEngine.js` implements a SHA-256 hash chain. |
| **Timing Attack** | Side-Channel Timing Attack | Exploiting variations in response time to leak information about secret comparisons. | Mitigated by `crypto.timingSafeEqual()` in OTP verification. |
| **MFA** | Multi-Factor Authentication | Requiring two or more independent authentication factors (password + OTP). | 6-digit email OTP required after password. |
| **OTP** | One-Time Password | A temporary, single-use code for authentication. | 6-digit codes with 5-minute TTL, stored as SHA-256 hashes. |

---

## Web Security

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **OWASP** | Open Web Application Security Project | Non-profit organization that publishes the industry-standard Top 10 web security risks. | Multiple OWASP risks addressed (injection, broken auth, etc.). |
| **XSS** | Cross-Site Scripting | Injecting malicious JavaScript into web pages viewed by other users. | Partially mitigated by React's auto-escaping. No server-side sanitization. |
| **CORS** | Cross-Origin Resource Sharing | Server-side mechanism allowing/denying API access from different origins (domains). | Configured in `api-gateway/index.js` with `credentials: true`. |
| **CSP** | Content Security Policy | HTTP header controlling which scripts, styles, and resources a page can load. | Set by Helmet.js in the API Gateway. |
| **HSTS** | HTTP Strict Transport Security | Header telling browsers to only use HTTPS for future requests (prevents downgrade attacks). | Set by Helmet.js: `Strict-Transport-Security: max-age=15552000`. |
| **CSRF** | Cross-Site Request Forgery | Tricking a logged-in user's browser into making unwanted requests. | Partially mitigated by CORS + Bearer token auth (not cookie-based). |
| **RBAC** | Role-Based Access Control | Restricting access based on user roles (CUSTOMER, ADMIN, OFFICER). | Implemented in backend services via `x-user-role` header. |
| **IDOR** | Insecure Direct Object Reference | Accessing resources by manipulating IDs in URLs (e.g., `/accounts/123` → `/accounts/456`). | Protected by ownership checks (`sender.userId !== userId`). |
| **BOLA** | Broken Object-Level Authorization | OWASP API Security term for IDOR — failing to verify object ownership. | Protected in transfer logic; admin bypasses ownership checks. |
| **SQL Injection** | SQL Injection | Inserting malicious SQL via user input to manipulate database queries. | Prevented by Prisma ORM parameterized queries. |
| **CVE** | Common Vulnerabilities and Exposures | Standardized IDs for publicly known security vulnerabilities. | `npm audit` scans for CVEs in dependencies. |
| **DDoS** | Distributed Denial of Service | Overwhelming a server with traffic from many sources to make it unavailable. | Mitigated by Redis-backed rate limiting (20/100 req/min tiers). |
| **Credential Stuffing** | Credential Stuffing | Automated use of stolen username/password pairs from data breaches against login endpoints. | Mitigated by account lockout (5 attempts) and rate limiting. |

---

## Networking

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **AMQP** | Advanced Message Queuing Protocol | Open standard protocol for message brokers (like HTTP for message queues). | RabbitMQ uses AMQP on port 5672. |
| **DNS** | Domain Name System | Translates hostnames to IP addresses. | Docker's embedded DNS resolves container names. |
| **Reverse Proxy** | Reverse Proxy | A server that sits in front of backend services, forwarding client requests. | API Gateway uses `http-proxy-middleware` as a reverse proxy. |
| **Load Balancer** | Load Balancer | Distributes incoming traffic across multiple service instances. | Azure Container Apps provides built-in load balancing. |
| **VNet** | Virtual Network | An isolated network in Azure for secure communication between resources. | ACA Environment creates a managed VNet. |
| **TTL** | Time To Live | How long a value persists before expiration. | OTP: 300s TTL in Redis. Rate limit: 60s window. |

---

## Observability

| Term | Full Name | Definition | In AegisVault |
|------|-----------|------------|---------------|
| **APM** | Application Performance Monitoring | Tools that track application speed, errors, and resource usage. | Not implemented. Azure Application Insights would provide this. |
| **KQL** | Kusto Query Language | Microsoft's query language for Azure Log Analytics and Application Insights. | Used to query container logs in Azure Portal. |
| **SLI** | Service Level Indicator | A metric measuring service quality (e.g., error rate, latency). | Request duration logged in `logger.js`. |
| **SLO** | Service Level Objective | A target value for an SLI (e.g., "99.9% of requests under 500ms"). | Not formally defined for AegisVault. |
| **SLA** | Service Level Agreement | A contractual guarantee around SLOs, with penalties for violations. | Not applicable (competition project). |
| **MTTR** | Mean Time To Recover | Average time to restore service after a failure. | No formal measurement or playbooks. |
| **MTTF** | Mean Time To Failure | Average time between failures. | No formal measurement. |
| **P50 / P95 / P99** | Percentile Latency | The latency below which X% of requests complete. P99 = 99th percentile. | Visible in Grafana dashboards but not formally configured. |
| **Golden Signals** | Four Golden Signals | Google SRE's four key metrics: Latency, Traffic, Errors, Saturation. | Partially tracked via Winston logs. |
| **RED Method** | Rate, Errors, Duration | A monitoring methodology focused on request Rate, Error count, and Duration. | Partially implemented in `requestLogger` middleware. |

---

> **Next:** [08 — Monitoring & Production Operations](./08_monitoring_and_production_operations.md) — How to monitor, debug, and operate AegisVault in production.
