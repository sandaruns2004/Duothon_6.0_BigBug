# AegisVault CI/CD Pipeline (GitHub Actions)

This document outlines the Continuous Integration and Continuous Deployment strategy for the AegisVault microservices architecture.

## CI/CD Platform Decision
We are utilizing **GitHub Actions** as our CI/CD platform because:
1. It provides a seamless, unified developer experience natively within our GitHub repository.
2. It offers rapid execution suitable for quick iteration in a hackathon setting.
3. It eliminates the overhead of provisioning and managing third-party CI/CD servers.

---

## 1. Continuous Integration (`.github/workflows/ci.yml`)

The CI pipeline serves as our primary quality gate, ensuring that no broken code is merged into our main codebase.

- **Trigger:** Automatically runs on every Pull Request targeting the `main` branch.
- **Purpose:** Automated Quality Control and Testing.
- **Jobs:**
  1. **Linting:** Runs ESLint and Prettier checks across the codebase to enforce code style and catch syntax errors early.
  2. **Unit Testing:** Executes Jest unit tests for each individual microservice.
  3. **Integration Testing:** Executes Supertest API integration tests to ensure inter-service contracts are maintained.

**PR Guardrail:** This pipeline must pass completely; otherwise, the Pull Request will be blocked from merging.

---

## 2. Continuous Deployment (`.github/workflows/cd.yml`)

The CD pipeline automates the delivery of our tested code directly to our Azure hosting environment.

- **Trigger:** Automatically runs on every push to the `main` branch (which typically happens when a validated PR is merged).
- **Purpose:** Zero-downtime automated deployment to Azure Container Apps.
- **Jobs:**
  1. **Build Phase:** Compiles Next.js for the frontend and builds the Docker images for all 5 backend microservices (`auth`, `account`, `transaction`, `notification`, `admin`), the API Gateway, and the PostgreSQL database. It also prepares the `seed-job` image.
  2. **Push Phase:** Pushes the freshly built Docker images to our private Azure Container Registry (ACR).
  3. **Deploy Phase:** Triggers an update across all relevant Azure Container Apps, prompting them to pull the latest images from ACR and perform a rolling restart to achieve zero-downtime deployments.
  4. **Database Seeding:** Deploys and runs an Azure Container App Job (`seed-job`) to apply Prisma database schemas and seed the initial production records.

---

## 3. Secrets Management (GitHub Secrets)

To ensure maximum security, **no API keys, database passwords, or connection strings will be hardcoded** in the codebase. 

Instead, we will use **GitHub Actions Secrets** to manage our environment variables.

During the deployment pipeline, GitHub Actions will securely inject these secrets into the Azure Container Apps environment. The necessary secrets will include:
- `AZURE_CREDENTIALS` (For the pipeline to authenticate with Azure)
- `REGISTRY_LOGIN_SERVER`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` (For ACR access)
- Application secrets like `JWT_SECRET`, `DB_PASSWORD`, and SMTP keys (which will be passed directly as secure environment variables to the running containers).
