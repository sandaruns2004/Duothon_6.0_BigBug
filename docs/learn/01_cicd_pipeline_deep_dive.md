# 01 — CI/CD Pipeline Deep Dive

> A line-by-line walkthrough of your GitHub Actions CI and CD pipelines, with the theory behind every keyword and concept.

---

## Table of Contents

1. [What is CI/CD? (The Big Picture)](#1-what-is-cicd-the-big-picture)
2. [GitHub Actions Fundamentals](#2-github-actions-fundamentals)
3. [Your CI Pipeline — Line by Line](#3-your-ci-pipeline--line-by-line)
4. [Your CD Pipeline — Line by Line](#4-your-cd-pipeline--line-by-line)
5. [How CI and CD Work Together](#5-how-ci-and-cd-work-together)
6. [Limitations of Your Current Pipelines](#6-limitations-of-your-current-pipelines)
7. [Key Terms Glossary](#7-key-terms-glossary)

---

## 1. What is CI/CD? (The Big Picture)

### CI — Continuous Integration

**CI (Continuous Integration)** is the practice of automatically building and testing every code change as soon as it's pushed to a shared repository. The goal: catch bugs **before** they reach production.

Without CI, you'd push code, hope it works, and find out it broke something when a user reports it. With CI, every push triggers automated checks — tests, linting, build verification — and blocks the merge if anything fails.

### CD — Continuous Deployment

**CD (Continuous Deployment)** takes CI further: once code passes all automated checks, it's **automatically deployed to production** without manual intervention.

> [!NOTE]
> There's a subtle difference between **Continuous Delivery** and **Continuous Deployment**. In Continuous Delivery, the code is automatically built and tested but requires a manual approval step to deploy. In Continuous Deployment, it goes all the way to production automatically. Your system uses **Continuous Deployment** — a push to `main` triggers deployment without approval.

### How They Fit Together in Your System

```mermaid
flowchart LR
    A["👨‍💻 Developer pushes code"] --> B["🔄 CI Pipeline triggers"]
    B --> C{"All tests pass?"}
    C -->|❌ No| D["🚫 Build fails\nDeveloper fixes code"]
    C -->|✅ Yes| E["📦 CD Pipeline triggers"]
    E --> F["🐳 Build Docker images"]
    F --> G["📤 Push to Azure Container Registry"]
    G --> H["🚀 Deploy to Azure Container Apps"]
    H --> I["🌐 Live in Production"]
    D --> A
```

### Your Two Pipeline Files

| File | Purpose | Triggers On |
|------|---------|-------------|
| [ci.yml](../../.github/workflows/ci.yml) | Tests, lint, build verification | Push or PR to `main`, `master`, `develop` |
| [cd.yml](../../.github/workflows/cd.yml) | Build Docker images, push to registry, deploy to Azure | Push to `main`, `master` only |

---

## 2. GitHub Actions Fundamentals

Before diving into the code, let's understand the building blocks of GitHub Actions. Every term here appears in your pipelines.

### Workflow

A **workflow** is an automated process defined in a YAML file inside `.github/workflows/`. Each `.yml` file = one workflow. You have two: `ci.yml` and `cd.yml`.

### Event / Trigger

An **event** is what starts a workflow. Common triggers:

```yaml
on:
  push:           # When someone pushes commits
    branches: [main]
  pull_request:   # When someone opens/updates a PR
    branches: [main]
  workflow_dispatch: {}  # Manual trigger button in GitHub UI
```

### Job

A **job** is a set of steps that run on the same machine (runner). Jobs in a workflow run **in parallel** by default, unless you specify dependencies with `needs`.

### Step

A **step** is a single task within a job. It can be:
- A shell command (`run: npm test`)
- A reusable action (`uses: actions/checkout@v4`)

### Runner

A **runner** is the virtual machine that executes your job. `runs-on: ubuntu-latest` means GitHub provisions a fresh Ubuntu VM for that job. When the job finishes, the VM is destroyed.

### Action

An **action** is a reusable, pre-built step. For example, `actions/checkout@v4` clones your repo. The `@v4` is a version tag — you should always pin versions to avoid breaking changes.

### Matrix Strategy

A **matrix** lets you run the same job multiple times with different configurations. For example, testing on Node.js 18, 20, and 22 simultaneously.

### Secrets

**Secrets** are encrypted environment variables stored in GitHub (Settings → Secrets). They're injected at runtime via `${{ secrets.SECRET_NAME }}` and never printed in logs.

```mermaid
graph TB
    subgraph "GitHub Actions Anatomy"
        W["📋 Workflow (.yml file)"]
        W --> E["⚡ Event Trigger (push, PR)"]
        W --> J1["🔧 Job 1 (runs on Runner)"]
        W --> J2["🔧 Job 2 (runs on Runner)"]
        J1 --> S1["📌 Step 1: Checkout code"]
        J1 --> S2["📌 Step 2: Setup Node.js"]
        J1 --> S3["📌 Step 3: Run tests"]
        J2 --> S4["📌 Step 1: Build Docker"]
        J2 --> S5["📌 Step 2: Push image"]
    end
```

---

## 3. Your CI Pipeline — Line by Line

> File: [ci.yml](../../.github/workflows/ci.yml)

Let's walk through every line of your CI pipeline.

### 3.1 — Workflow Name & Trigger

```yaml
name: AegisVault Digital Banking Platform CI Pipeline

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]
```

**What this does:**
- **`name:`** — A human-readable label shown in the GitHub Actions UI tab. This is what you see in the "Actions" tab of your repo.
- **`on: push:`** — Triggers this workflow whenever someone pushes commits to `main`, `master`, or `develop`.
- **`on: pull_request:`** — Also triggers when someone opens or updates a Pull Request targeting those branches.

> [!TIP]
> Having CI run on both `push` and `pull_request` is best practice. PRs get checked **before** merging, and pushes catch anything that slips through (like direct pushes to `main`).

### 3.2 — Job 1: Unit & Integration Tests

```yaml
jobs:
  unit-tests:
    name: Microservice Unit & Integration Tests (Jest + Supertest)
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]
```

**What this does:**
- **`jobs:`** — The top-level key that contains all jobs in this workflow.
- **`unit-tests:`** — The internal ID of this job. Used to reference it from other jobs (e.g., `needs: [unit-tests]`).
- **`name:`** — Display name in the GitHub Actions UI.
- **`runs-on: ubuntu-latest`** — This job runs on a fresh Ubuntu virtual machine provisioned by GitHub. "Latest" currently means Ubuntu 22.04. The VM has Docker, Node.js, Python, and common tools pre-installed.
- **`strategy: matrix:`** — Defines a matrix of configurations. Here, it's just `[20.x]` (Node.js 20). If you added `[18.x, 20.x, 22.x]`, it would run the same tests three times — once for each Node.js version — in parallel.

> [!NOTE]
> **Why `20.x` and not `20.11.1`?** The `.x` is a semver wildcard. It means "the latest patch version of Node.js 20." This ensures you always test with the latest security patches without manually updating the version.

#### Steps — Checkout & Setup

```yaml
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
```

**What this does:**
- **`actions/checkout@v4`** — Clones your repository into the runner's filesystem. Without this, the runner has an empty workspace. The `@v4` means version 4 of this action.
- **`actions/setup-node@v4`** — Installs the specified Node.js version on the runner. `${{ matrix.node-version }}` dynamically resolves to `20.x`.
- **`cache: 'npm'`** — Caches the `node_modules` folder between runs. If `package-lock.json` hasn't changed, it skips `npm install` entirely. This can cut build times from 2 minutes to 30 seconds.

> [!TIP]
> **`${{ }}`** is GitHub Actions' expression syntax. It evaluates variables, secrets, and context objects at runtime. Think of it like template literals in JavaScript: `` `Node ${version}` ``.

#### Steps — Auth Service Tests

```yaml
      - name: Install Dependencies & Run Tests - Auth Service
        working-directory: ./services/auth-service
        env:
          JWT_SECRET: aegisvault-super-secret-jwt-key-2026
          NODE_ENV: test
        run: |
          npm install --no-fund
          npm audit --audit-level=high || true
          npm test
```

**What this does:**
- **`working-directory: ./services/auth-service`** — Changes the working directory for this step. All commands run inside `services/auth-service/` instead of the repo root. This is crucial because each microservice has its own `package.json`.
- **`env:`** — Sets environment variables for this step only.
  - `JWT_SECRET` — The auth service needs this to sign/verify tokens during tests.
  - `NODE_ENV: test` — Tells the app it's running in test mode (disables production-only behaviors).
- **`run: |`** — The pipe `|` means "multi-line string." Everything indented below is a shell script.
- **`npm install --no-fund`** — Installs dependencies. `--no-fund` suppresses the "X packages are looking for funding" messages to keep logs clean.
- **`npm audit --audit-level=high || true`** — Runs a **supply chain vulnerability scan** on all dependencies.
  - `--audit-level=high` means only report HIGH and CRITICAL severity vulnerabilities.
  - `|| true` means "don't fail the build even if vulnerabilities are found." This is a **soft check** — it reports issues but doesn't block the pipeline. In a stricter setup, you'd remove `|| true` to fail the build on any high-severity CVE.
- **`npm test`** — Runs the test suite defined in `package.json` (Jest + Supertest for HTTP endpoint testing).

> [!WARNING]
> **Security Issue:** The JWT secret is hardcoded in `ci.yml` line 29. While this is a test-only secret, it's the **same value** as the production fallback in [jwtAuth.js L9](../../services/api-gateway/src/middleware/jwtAuth.js#L9). An attacker reading your CI config knows the production JWT secret if the env var is ever missing.

#### Steps — Transaction Service Tests

```yaml
      - name: Install Dependencies & Run Tests - Transaction Service
        working-directory: ./services/transaction-service
        env:
          NODE_ENV: test
        run: |
          npm install --no-fund
          npm audit --audit-level=high || true
          npm test
```

Identical pattern to the auth service tests, but for the Transaction Service. Note it doesn't need `JWT_SECRET` because the transaction service doesn't sign tokens — it receives pre-validated requests from the API Gateway.

### 3.3 — Job 2: Frontend Build Check

```yaml
  frontend-check:
    name: Next.js 14 Frontend Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20.x

      - name: Install Frontend Dependencies & Check Build
        working-directory: ./client
        run: |
          npm install --no-fund
          npm audit --audit-level=high || true
          npm run build
```

**What this does:**
- This job verifies the **Next.js frontend** compiles successfully.
- **`npm run build`** runs the Next.js production build, which:
  - Type-checks all TypeScript files
  - Compiles all pages and components
  - Optimizes assets
  - Reports any compilation errors
- If any TypeScript type error or import issue exists, this step fails and blocks the pipeline.

> [!NOTE]
> **Why is this a separate job from `unit-tests`?** Jobs run in parallel by default. Having `unit-tests` and `frontend-check` as separate jobs means they run simultaneously on different runners, cutting total CI time in half. If they were in the same job, they'd run sequentially.

### 3.4 — Job 3: Docker Compose Validation

```yaml
  docker-compose-test:
    name: Docker Compose Service Orchestration Check
    runs-on: ubuntu-latest
    needs: [unit-tests, frontend-check]
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Validate Docker Compose Configuration
        run: docker compose config

      - name: Dry-Run Docker Compose Build
        run: docker compose build --no-cache api-gateway auth-service transaction-service
```

**What this does:**
- **`needs: [unit-tests, frontend-check]`** — This is the critical keyword. It means this job **only runs after both `unit-tests` and `frontend-check` succeed**. If either fails, this job is skipped entirely. This creates a dependency chain:

```mermaid
flowchart LR
    A["unit-tests"] --> C["docker-compose-test"]
    B["frontend-check"] --> C
    style A fill:#4CAF50,color:white
    style B fill:#4CAF50,color:white
    style C fill:#2196F3,color:white
```

- **`docker compose config`** — Validates the `docker-compose.yml` syntax. Checks that all service names, port mappings, volume mounts, and environment variables are valid YAML and valid Compose syntax. Catches typos before they reach production.
- **`docker compose build --no-cache api-gateway auth-service transaction-service`** — Performs a **dry-run build** of three key services. `--no-cache` forces a fresh build from scratch (ignoring cached layers) to ensure the Dockerfiles work from a clean state. It builds the images but doesn't push or run them.

### Complete CI Pipeline Flow

```mermaid
flowchart TB
    subgraph "Trigger"
        T["Push to main/master/develop\nor PR opened"]
    end
    
    subgraph "Parallel Jobs"
        direction LR
        J1["🧪 unit-tests\n━━━━━━━━━━━━━\n1. Checkout code\n2. Setup Node 20\n3. Auth: install → audit → test\n4. Txn: install → audit → test"]
        J2["🏗️ frontend-check\n━━━━━━━━━━━━━\n1. Checkout code\n2. Setup Node 20\n3. Client: install → audit → build"]
    end
    
    subgraph "Sequential Job"
        J3["🐳 docker-compose-test\n━━━━━━━━━━━━━\n1. Checkout code\n2. Validate compose config\n3. Dry-run build (3 services)"]
    end
    
    T --> J1
    T --> J2
    J1 -->|"needs"| J3
    J2 -->|"needs"| J3
    
    style J1 fill:#4CAF50,color:white
    style J2 fill:#FF9800,color:white
    style J3 fill:#2196F3,color:white
```

---

## 4. Your CD Pipeline — Line by Line

> File: [cd.yml](../../.github/workflows/cd.yml)

The CD pipeline is significantly more complex. It has 3 jobs with 247 lines. Let's break it down.

### 4.1 — Workflow Name, Trigger & Global Environment

```yaml
name: Continuous Deployment

on:
  push:
    branches: [ main, master ]

env:
  REGISTRY_LOGIN_SERVER: ${{ secrets.REGISTRY_LOGIN_SERVER }}
  RESOURCE_GROUP: "aegisvault-rg"
  ENVIRONMENT_NAME: "aegisvault-env"
```

**What this does:**
- **Trigger:** Only fires on pushes to `main` or `master`. Not on PRs, not on `develop`. This means only merged/direct code reaches production.
- **`env:` (top-level)** — These are **workflow-level environment variables** available to ALL jobs and steps:
  - `REGISTRY_LOGIN_SERVER` — The URL of your Azure Container Registry (e.g., `aegisvaultacrrw5v9v.azurecr.io`). Pulled from GitHub Secrets.
  - `RESOURCE_GROUP` — The Azure Resource Group name. Hardcoded because it's not sensitive.
  - `ENVIRONMENT_NAME` — The Azure Container Apps Environment name.

> [!NOTE]
> **Resource Group** in Azure is like a folder — it groups all related resources (containers, registries, databases) together for billing, access control, and lifecycle management. Deleting a resource group deletes everything inside it.

### 4.2 — Job 1: Change Detection

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      modified: ${{ steps.filter.outputs.changes }}
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Detect Changed Paths
        uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            auth-service: 
              - 'services/auth-service/**'
              - '.github/workflows/cd.yml'
            account-service: 
              - 'services/account-service/**'
              - '.github/workflows/cd.yml'
            transaction-service: 
              - 'services/transaction-service/**'
              - '.github/workflows/cd.yml'
            notification-service: 
              - 'services/notification-service/**'
              - '.github/workflows/cd.yml'
            admin-service: 
              - 'services/admin-service/**'
              - '.github/workflows/cd.yml'
            api-gateway: 
              - 'services/api-gateway/**'
              - '.github/workflows/cd.yml'
            client: 
              - 'client/**'
              - '.github/workflows/cd.yml'
            postgres: 
              - 'databases/postgres/**'
              - 'scripts/init-schemas.sql'
              - '.github/workflows/cd.yml'
            seed-job:
              - '**'
```

**What this does — and why it's clever:**

This is a **change detection** system. Instead of rebuilding and redeploying ALL 9 services on every push, it figures out which files changed and only rebuilds the affected services.

- **`fetch-depth: 0`** — Fetches the **full git history** instead of the default shallow clone (last commit only). The paths-filter action needs the full history to compare the current commit against the previous one and determine what changed.
- **`dorny/paths-filter@v3`** — A third-party action that compares files changed in the push against glob patterns.
- **`id: filter`** — Gives this step an ID so other steps/jobs can reference its outputs via `steps.filter.outputs`.
- **`outputs: modified:`** — Exposes the result to other jobs. The output is a **JSON array** of service names that had changes, e.g., `["auth-service", "client"]`.

**The filter rules:**

Each service maps to its source directory. For example:

```yaml
auth-service: 
  - 'services/auth-service/**'    # Any file change inside auth-service/
  - '.github/workflows/cd.yml'    # OR any change to the CD pipeline itself
```

The `**` glob means "any file at any depth." If you edit `services/auth-service/src/controllers/auth.controller.js`, only `auth-service` appears in the output. The CD pipeline itself is included so that pipeline changes trigger a full rebuild.

**The `seed-job` has a special rule:**

```yaml
seed-job:
  - '**'   # Matches ANY file change
```

This means the database seed job rebuilds on every push. This ensures demo data is always re-seeded with the latest schema.

> [!TIP]
> **Why change detection matters:** Without it, every push would rebuild, push, and redeploy all 9 Docker images. Each image takes 2-3 minutes to build. That's 20+ minutes per deployment. With change detection, a small auth-service fix deploys in ~4 minutes.

### 4.3 — Job 2: Build & Push Docker Images

```yaml
  build-and-push:
    needs: changes
    if: ${{ needs.changes.outputs.modified != '[]' }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        service: ${{ fromJSON(needs.changes.outputs.modified) }}
```

**What this does:**
- **`needs: changes`** — Waits for the change detection job to finish.
- **`if:`** — Conditional execution. Only runs if the `modified` output is NOT an empty array `[]`. If no files changed (e.g., a README-only edit didn't match any filter), this entire job is skipped.
- **`fail-fast: false`** — Critical setting. In a matrix strategy, if one service fails to build, the others **keep going**. Default is `true` (one failure cancels all). For deployments, you want `false` — a broken auth-service build shouldn't prevent a working client fix from deploying.
- **`matrix: service:`** — Dynamically creates one parallel build job per changed service. If the changes job outputs `["auth-service", "client"]`, two runners spin up simultaneously.

> [!NOTE]
> **`fromJSON()`** is a GitHub Actions function that parses a JSON string into a native array. The `modified` output is a string like `'["auth-service","client"]'` — `fromJSON()` converts it so `matrix` can iterate over it.

#### Step: Docker Buildx Setup

```yaml
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
```

**What this does:**
- **Docker Buildx** is Docker's extended build tool. It supports advanced features like multi-platform builds (AMD64 + ARM64), build caching, and BuildKit optimizations. Even though you're only building for one platform, Buildx is faster than the legacy `docker build` because it uses BuildKit's parallelized layer building.

#### Step: Azure Container Registry Login

```yaml
      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.REGISTRY_LOGIN_SERVER }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
```

**What this does:**
- Authenticates the runner with your **Azure Container Registry (ACR)**. ACR is a private Docker image registry hosted on Azure — like Docker Hub but private to your organization.
- Three secrets are required:
  - `REGISTRY_LOGIN_SERVER` — The ACR URL (e.g., `aegisvaultacrrw5v9v.azurecr.io`)
  - `REGISTRY_USERNAME` — The ACR admin username
  - `REGISTRY_PASSWORD` — The ACR admin password
- After this step, `docker push` commands to this registry are authorized.

> [!NOTE]
> **What is a Container Registry?** It's a storage server for Docker images. When you `docker build`, you create an image locally. When you `docker push`, you upload it to a registry. When Azure needs to deploy your service, it `docker pull`s from this registry. Think of it like npm for Docker images.

#### Step: Define Build Context and Dockerfile

```yaml
      - name: Define Build Context and Dockerfile
        id: build-vars
        run: |
          if [ "${{ matrix.service }}" == "postgres" ]; then
            echo "context=." >> $GITHUB_OUTPUT
            echo "dockerfile=./databases/postgres/Dockerfile" >> $GITHUB_OUTPUT
          elif [ "${{ matrix.service }}" == "client" ]; then
            echo "context=./client" >> $GITHUB_OUTPUT
            echo "dockerfile=./client/Dockerfile" >> $GITHUB_OUTPUT
          elif [ "${{ matrix.service }}" == "seed-job" ]; then
            echo "context=." >> $GITHUB_OUTPUT
            echo 'FROM node:20-alpine' > Dockerfile.seed
            echo 'WORKDIR /app' >> Dockerfile.seed
            echo 'RUN apk add --no-cache openssl' >> Dockerfile.seed
            echo 'COPY package*.json ./ ' >> Dockerfile.seed
            echo 'RUN npm install --no-audit --no-fund --loglevel=error && npm install --no-audit --no-fund --loglevel=error prisma@5.11.0 @prisma/client@5.11.0 bcrypt@5.1.1' >> Dockerfile.seed
            echo 'COPY . .' >> Dockerfile.seed
            echo 'RUN npx prisma generate --schema=./services/auth-service/prisma/schema.prisma' >> Dockerfile.seed
            echo 'RUN npx prisma generate --schema=./services/account-service/prisma/schema.prisma' >> Dockerfile.seed
            echo 'RUN npx prisma generate --schema=./services/transaction-service/prisma/schema.prisma' >> Dockerfile.seed
            echo 'RUN npx prisma generate --schema=./services/notification-service/prisma/schema.prisma' >> Dockerfile.seed
            echo 'RUN npx prisma generate --schema=./services/admin-service/prisma/schema.prisma' >> Dockerfile.seed
            echo 'CMD ["node", "scripts/seed-demo.js"]' >> Dockerfile.seed
            echo "dockerfile=./Dockerfile.seed" >> $GITHUB_OUTPUT
          else
            echo "context=./services/${{ matrix.service }}" >> $GITHUB_OUTPUT
            echo "dockerfile=./services/${{ matrix.service }}/Dockerfile" >> $GITHUB_OUTPUT
          fi
```

**What this does — this is the most complex step:**

Different services have different build contexts and Dockerfiles. This step dynamically sets the correct ones based on which service is being built.

- **`$GITHUB_OUTPUT`** — A special file provided by GitHub Actions. Writing `key=value` to it creates step outputs accessible via `${{ steps.build-vars.outputs.key }}`.

**The routing logic:**

| Service | Build Context | Dockerfile |
|---------|--------------|------------|
| `postgres` | `.` (repo root) | `./databases/postgres/Dockerfile` |
| `client` | `./client` | `./client/Dockerfile` |
| `seed-job` | `.` (repo root) | Dynamically generated `./Dockerfile.seed` |
| Everything else | `./services/<name>` | `./services/<name>/Dockerfile` |

**The seed-job is special** — it doesn't have a pre-existing Dockerfile. The script **generates one on-the-fly** by echoing Dockerfile instructions line by line. This seed image:
1. Starts from `node:20-alpine`
2. Installs `openssl` (needed by Prisma)
3. Installs all dependencies + Prisma + bcrypt
4. Copies the entire repo (needs schemas from all services)
5. Generates Prisma clients for ALL 5 microservice schemas
6. Runs `scripts/seed-demo.js` to populate the database with demo data

> [!NOTE]
> **Build Context** is the directory Docker sends to the build daemon. Only files within the context can be accessed by `COPY` and `ADD` instructions. Setting context to `.` (repo root) for the seed job means it can access schemas from all services.

#### Step: Build and Push Docker Image

```yaml
      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: ${{ steps.build-vars.outputs.context }}
          file: ${{ steps.build-vars.outputs.dockerfile }}
          push: true
          tags: |
            ${{ env.REGISTRY_LOGIN_SERVER }}/${{ matrix.service }}:${{ github.sha }}
            ${{ env.REGISTRY_LOGIN_SERVER }}/${{ matrix.service }}:latest
```

**What this does:**
- **`docker/build-push-action@v5`** — A GitHub Action that builds a Docker image and pushes it to a registry in one step. Uses Buildx under the hood.
- **`context:`** and **`file:`** — Uses the values computed in the previous step.
- **`push: true`** — Pushes the built image to the registry immediately after building.
- **`tags:`** — Each image gets TWO tags:

| Tag | Example | Purpose |
|-----|---------|---------|
| `:${{ github.sha }}` | `aegisvaultacr.azurecr.io/auth-service:a1b2c3d4e5f6` | **Immutable tag** tied to the exact git commit. Used for traceability — you can always trace a running container back to the exact source code. |
| `:latest` | `aegisvaultacr.azurecr.io/auth-service:latest` | **Mutable tag** that always points to the newest build. Convenient for quick deployments but dangerous for rollbacks. |

> [!TIP]
> **Image tagging strategy matters for rollbacks.** If you deploy `auth-service:a1b2c3d` and it breaks, you can roll back to `auth-service:prev-sha`. If you only used `:latest`, the broken version overwrites the good one and you can't roll back.

### 4.4 — Job 3: Deploy to Azure

This is the most complex job. Let's break it into its three major steps.

#### Azure Login

```yaml
  deploy:
    needs: [changes, build-and-push]
    if: ${{ needs.changes.outputs.modified != '[]' }}
    runs-on: ubuntu-latest
    steps:
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
```

**What this does:**
- **`needs: [changes, build-and-push]`** — Waits for BOTH the change detection and build jobs to complete.
- **`azure/login@v2`** — Authenticates the runner with Azure using a **Service Principal** credential stored in GitHub Secrets.
- **`AZURE_CREDENTIALS`** — A JSON blob containing `clientId`, `clientSecret`, `subscriptionId`, and `tenantId`. This is like a machine-to-machine API key for Azure.

> [!NOTE]
> **Service Principal** in Azure is like a "robot account." Instead of using your personal Azure login in a pipeline (which would require interactive MFA), you create a Service Principal with limited permissions — it can only manage resources in the specified Resource Group.

#### Fetch Internal Service URLs

```yaml
      - name: Fetch Internal Service URLs
        run: |
          echo "🌐 Fetching Internal Service URLs..."
          PG_FQDN=$(az containerapp show -n postgres -g ${{ env.RESOURCE_GROUP }} --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r\n')
          REDIS_FQDN=$(az containerapp show -n redis -g ${{ env.RESOURCE_GROUP }} --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r\n')
          RABBITMQ_FQDN=$(az containerapp show -n rabbitmq -g ${{ env.RESOURCE_GROUP }} --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r\n')
          AUTH_URL="https://$(az containerapp show -n auth-service -g ${{ env.RESOURCE_GROUP }} --query properties.configuration.ingress.fqdn -o tsv | tr -d '\r\n')"
          # ... (similar for all services)
          
          echo "PG_FQDN=$PG_FQDN" >> $GITHUB_ENV
          # ... (similar for all variables)
```

**What this does:**

Azure Container Apps assigns each service a **FQDN (Fully Qualified Domain Name)** — a unique URL like `auth-service.internal.blueice-abc123.eastus.azurecontainerapps.io`. These URLs are dynamic and can change if you recreate a service. This step:

1. **Queries Azure** for each service's current FQDN using `az containerapp show`
2. **`--query properties.configuration.ingress.fqdn`** — JMESPath query to extract just the FQDN from the JSON response
3. **`-o tsv`** — Output as tab-separated value (plain text, no JSON wrapping)
4. **`tr -d '\r\n'`** — Removes any trailing newlines/carriage returns
5. **`>> $GITHUB_ENV`** — Writes the value as an environment variable available to ALL subsequent steps in this job

**Why this is needed:** Each microservice needs to know the URLs of other services it talks to. The auth-service needs the notification-service URL to send OTP emails. The API gateway needs all service URLs to proxy requests. These URLs are injected as environment variables during deployment.

```mermaid
flowchart LR
    subgraph "Azure Container Apps Environment"
        GW["🌐 api-gateway\n(external)"]
        CL["🖥️ client\n(external)"]
        AU["🔐 auth-service\n(internal)"]
        AC["💰 account-service\n(internal)"]
        TX["💸 transaction-service\n(internal)"]
        NO["📧 notification-service\n(internal)"]
        AD["👨‍💼 admin-service\n(internal)"]
        PG["🐘 postgres\n(internal)"]
        RD["⚡ redis\n(internal)"]
        RQ["🐰 rabbitmq\n(internal)"]
    end
    
    CL -->|"INTERNAL_API_URL"| GW
    GW -->|"AUTH_SERVICE_URL"| AU
    GW -->|"ACCOUNT_SERVICE_URL"| AC
    GW -->|"TRANSACTION_SERVICE_URL"| TX
    GW -->|"NOTIFICATION_SERVICE_URL"| NO
    GW -->|"ADMIN_SERVICE_URL"| AD
    AU --> PG
    AC --> PG
    TX --> PG
    NO --> PG
    AD --> PG
    AU --> RD
    AU --> RQ
    NO --> RQ
```

#### Parallel Deployments

```yaml
      - name: Parallel Deployments
        env:
          MODIFIED: ${{ needs.changes.outputs.modified }}
        run: |
          JWT_SECRET="${{ secrets.JWT_SECRET }}"
          DB_PASSWORD="${{ secrets.DB_PASSWORD }}"
          DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=disable"
          
          SMTP_HOST="${{ secrets.SMTP_HOST }}"
          SMTP_PORT="${{ secrets.SMTP_PORT }}"
          SMTP_FROM="${{ secrets.SMTP_FROM }}"
          SMTP_USERNAME="${{ secrets.SMTP_USERNAME }}"
          SMTP_PASSWORD="${{ secrets.SMTP_PASSWORD }}"

          REDIS_URL="redis://redis:6379"
          RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672"
```

**What this does:**
- Pulls ALL secrets needed by the services from GitHub Secrets.
- Constructs the **PostgreSQL connection string**: `postgresql://aegis_admin:<password>@postgres:5432/aegisvault?sslmode=disable`
  - `aegis_admin` — DB username
  - `@postgres:5432` — The hostname `postgres` resolves to the Postgres Container App's internal FQDN
  - `/aegisvault` — Database name
  - `?sslmode=disable` — **⚠️ Security issue** — disables SSL for database connections

```yaml
          echo "🔐 Setting registry credentials sequentially to avoid conflicts..."
          APPS=("postgres" "auth-service" "account-service" "transaction-service" "notification-service" "admin-service" "api-gateway" "client")
          for app in "${APPS[@]}"; do
            if [[ "$MODIFIED" == *"$app"* ]]; then
              az containerapp registry set --name $app --resource-group ${{ env.RESOURCE_GROUP }} --server ${{ env.REGISTRY_LOGIN_SERVER }} --username ${{ secrets.REGISTRY_USERNAME }} --password ${{ secrets.REGISTRY_PASSWORD }}
            fi
          done
```

**What this does:**
- Before deploying, each Container App must know which registry to pull images from.
- **`az containerapp registry set`** — Configures the Container App to authenticate with your ACR.
- This is done **sequentially** (in a loop) because parallel Azure CLI calls to the same resource group can cause race conditions.
- The `if [[ "$MODIFIED" == *"$app"* ]]` check ensures we only update registry creds for services that changed.

```yaml
          echo "🚀 Deploying modified services in parallel..."
          
          if [[ "$MODIFIED" == *"auth-service"* ]]; then
            az containerapp update --name auth-service --resource-group ${{ env.RESOURCE_GROUP }} \
              --image ${{ env.REGISTRY_LOGIN_SERVER }}/auth-service:${{ github.sha }} \
              --set-env-vars \
                DATABASE_URL="${DB_BASE}&schema=auth_db" \
                REDIS_URL="$REDIS_URL" \
                RABBITMQ_URL="$RABBITMQ_URL" \
                JWT_SECRET="$JWT_SECRET" \
                JWT_ACCESS_EXPIRES_IN="15m" \
                JWT_REFRESH_EXPIRES_IN="7d" \
                NOTIFICATION_SERVICE_URL="$NOTIF_URL" &
          fi
```

**What this does (for each service):**
- **`az containerapp update`** — Updates an existing Container App with a new image and environment variables.
- **`--image ...auth-service:${{ github.sha }}`** — Pulls the image tagged with this specific git commit SHA. This is the immutable tag from the build step.
- **`--set-env-vars`** — Injects environment variables into the container at runtime:
  - `DATABASE_URL` — PostgreSQL connection with **schema-specific** suffix (`&schema=auth_db`). Each service uses a different schema for data isolation.
  - `REDIS_URL`, `RABBITMQ_URL` — Connection strings for infrastructure services.
  - `JWT_SECRET` — For token signing/verification.
  - `NOTIFICATION_SERVICE_URL` — So the auth service can call the notification service for OTP emails.
- **`&` at the end** — The **ampersand** sends this command to the **background**. This is how parallel deployment works in bash — all `az containerapp update` commands run simultaneously.

```yaml
          # Wait for all background az containerapp updates to finish
          wait
          echo "✅ All Container Apps updated successfully."
```

- **`wait`** — A bash built-in that blocks until ALL backgrounded processes (`&`) complete. This ensures the deploy step doesn't finish until every service is actually updated.

> [!IMPORTANT]
> **The parallel deployment pattern:** Registry credentials are set sequentially (to avoid conflicts), but the actual deployments run in parallel (to save time). This is a smart optimization — deploying 8 services sequentially would take ~16 minutes; in parallel it takes ~3 minutes.

#### Deploy Seed Job

```yaml
      - name: Deploy Seed Job
        run: |
          DB_PASSWORD="${{ secrets.DB_PASSWORD }}"
          DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=disable"
          
          az containerapp job delete --name db-seed-job --resource-group ${{ env.RESOURCE_GROUP }} --yes || true
          az containerapp job create \
            --name db-seed-job \
            --resource-group ${{ env.RESOURCE_GROUP }} \
            --environment ${{ env.ENVIRONMENT_NAME }} \
            --trigger-type Manual \
            --replica-timeout 300 \
            --replica-retry-limit 0 \
            --env-vars "DATABASE_URL=${DB_BASE}" \
            --registry-server ${{ env.REGISTRY_LOGIN_SERVER }} \
            --registry-username ${{ secrets.REGISTRY_USERNAME }} \
            --registry-password ${{ secrets.REGISTRY_PASSWORD }} \
            --image ${{ env.REGISTRY_LOGIN_SERVER }}/seed-job:${{ github.sha }}
            
          az containerapp job start --name db-seed-job --resource-group ${{ env.RESOURCE_GROUP }}
```

**What this does:**
- **Container App Jobs** are different from Container Apps. A Container App runs continuously (like a web server). A Container App **Job** runs once and exits (like a cron job or a migration script).
- **`az containerapp job delete ... || true`** — Deletes the old seed job if it exists. `|| true` prevents failure if it doesn't exist.
- **`az containerapp job create`** — Creates a new job with:
  - `--trigger-type Manual` — Only runs when explicitly started (not on a schedule)
  - `--replica-timeout 300` — Kills the job if it runs longer than 5 minutes
  - `--replica-retry-limit 0` — Don't retry on failure
- **`az containerapp job start`** — Executes the job immediately. The seed script inserts demo users, accounts, and transactions into the database.

### Complete CD Pipeline Flow

```mermaid
flowchart TB
    subgraph "🔍 Job 1: Change Detection"
        CD1["Checkout with full history"]
        CD2["dorny/paths-filter"]
        CD3["Output: modified services list"]
        CD1 --> CD2 --> CD3
    end
    
    subgraph "🐳 Job 2: Build & Push (Parallel Matrix)"
        BP1["Login to ACR"]
        BP2["Determine Dockerfile per service"]
        BP3["Build image with Buildx"]
        BP4["Push image with :sha + :latest tags"]
        BP1 --> BP2 --> BP3 --> BP4
    end
    
    subgraph "🚀 Job 3: Deploy to Azure"
        D1["Azure Login (Service Principal)"]
        D2["Fetch internal service URLs"]
        D3["Set registry creds (sequential)"]
        D4["Deploy all modified services (parallel)"]
        D5["Run database seed job"]
        D1 --> D2 --> D3 --> D4 --> D5
    end
    
    CD3 -->|"needs: changes"| BP1
    BP4 -->|"needs: build-and-push"| D1
    
    style CD3 fill:#FF9800,color:white
    style BP4 fill:#4CAF50,color:white
    style D5 fill:#2196F3,color:white
```

---

## 5. How CI and CD Work Together

Your CI and CD pipelines are **separate workflows** — they don't have a `needs` dependency between them. Here's how they interact:

| Scenario | CI Runs? | CD Runs? |
|----------|----------|----------|
| Push to `develop` | ✅ | ❌ (CD only triggers on `main`/`master`) |
| PR to `main` | ✅ | ❌ (CD only triggers on `push`, not PR) |
| Push to `main` | ✅ | ✅ (both trigger independently) |

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant GH as GitHub
    participant CI as CI Pipeline
    participant CD as CD Pipeline
    participant ACR as Azure Container Registry
    participant ACA as Azure Container Apps
    
    Dev->>GH: git push to main
    
    par CI and CD run simultaneously
        GH->>CI: Trigger CI
        CI->>CI: Run tests (Jest + Supertest)
        CI->>CI: Build frontend (Next.js)
        CI->>CI: Validate Docker Compose
        CI-->>GH: ✅ CI passes
    and
        GH->>CD: Trigger CD
        CD->>CD: Detect changed services
        CD->>ACR: Build & push Docker images
        CD->>ACA: Deploy updated services
        CD->>ACA: Run seed job
        CD-->>GH: ✅ CD completes
    end
```

> [!WARNING]
> **The problem:** CI and CD run in parallel. It's possible for CD to deploy code that CI hasn't finished testing yet. If CI fails, the broken code is already in production. A safer setup would make CD depend on CI (e.g., using `workflow_run` trigger).

---

## 6. Limitations of Your Current Pipelines

| Limitation | Impact | How to Fix |
|-----------|--------|------------|
| **CI doesn't gate CD** | Broken code can deploy before tests finish | Use `workflow_run` trigger in CD: `on: workflow_run: workflows: ["CI Pipeline"] types: [completed]` |
| **No Docker image scanning** | CVEs in base images reach production | Add `trivy` scanning step after build, before push |
| **No branch protection** | Anyone can push directly to `main` | Enable GitHub branch protection rules: require PR reviews, require CI to pass |
| **No rollback mechanism** | Bad deploys require a manual fix-and-push | Add a rollback workflow that redeploys the previous `:sha` tag |
| **No staging environment** | Changes go directly from development to production | Create a second Container Apps Environment for staging |
| **Hardcoded JWT secret in CI** | Secret visible in source code | Use GitHub Secrets for all sensitive values, even in CI |
| **`sslmode=disable` on DB connections** | Database traffic is unencrypted | Change to `sslmode=require` in the CD pipeline |
| **No build cache in CD** | Every build starts from scratch | Add `cache-from` and `cache-to` options to `docker/build-push-action` |

---

## 7. Key Terms Glossary

| Term | Full Name | Explanation |
|------|-----------|-------------|
| **CI** | Continuous Integration | Automatically test and validate code on every push/PR |
| **CD** | Continuous Deployment | Automatically deploy validated code to production |
| **Runner** | GitHub Actions Runner | A virtual machine (Ubuntu, macOS, or Windows) that executes your workflow jobs |
| **Job** | Workflow Job | A set of steps that run on the same runner. Jobs run in parallel by default |
| **Step** | Workflow Step | A single task within a job — either a shell command or a reusable action |
| **Action** | GitHub Action | A reusable, versioned step (e.g., `actions/checkout@v4`). Found on the GitHub Marketplace |
| **Matrix** | Matrix Strategy | Runs the same job multiple times with different configurations (e.g., different Node.js versions) |
| **Secrets** | GitHub Encrypted Secrets | Encrypted environment variables stored in GitHub settings, injected at runtime |
| **ACR** | Azure Container Registry | Microsoft's private Docker image registry service |
| **SHA** | Secure Hash Algorithm | Here: the git commit hash (e.g., `a1b2c3d`) used to tag Docker images for traceability |
| **Buildx** | Docker Buildx | Extended Docker build tool using BuildKit for faster, more capable builds |
| **FQDN** | Fully Qualified Domain Name | Complete hostname like `auth-service.internal.blueice-abc123.eastus.azurecontainerapps.io` |
| **Service Principal** | Azure Service Principal | A machine-to-machine identity (like a robot account) used for automated Azure access |
| **JMESPath** | JMESPath Query Language | Query language used by Azure CLI's `--query` parameter to extract data from JSON responses |
| **`fail-fast`** | Matrix Fail-Fast | When `true`, one matrix job failing cancels all others. When `false`, they continue independently |
| **`needs`** | Job Dependency | Specifies that a job must wait for another job to complete before starting |
| **`$GITHUB_OUTPUT`** | Step Output File | Special file for passing data between steps within a job |
| **`$GITHUB_ENV`** | Environment File | Special file for setting environment variables available to all subsequent steps |
| **Build Context** | Docker Build Context | The directory sent to the Docker daemon. Only files in the context can be used by `COPY`/`ADD` |
| **Layer Caching** | Docker Layer Cache | Docker reuses unchanged layers from previous builds, skipping redundant work |
| **Supply Chain Attack** | Software Supply Chain Attack | Compromising a software dependency (npm package) to inject malicious code into downstream projects |
| **`npm audit`** | NPM Security Audit | Scans `node_modules` for known vulnerabilities (CVEs) reported in the npm advisory database |
| **CVE** | Common Vulnerabilities and Exposures | A standardized ID for publicly known security vulnerabilities (e.g., CVE-2024-12345) |

---

> **Next:** [02 — Docker & Containerization Deep Dive](./02_docker_and_containerization.md) — Understanding containers, images, multi-stage builds, and how Docker Compose orchestrates your microservices.
