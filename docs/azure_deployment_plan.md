# AegisVault Azure Deployment & CI/CD Implementation Plan

This is the finalized deployment strategy for the AegisVault microservices architecture, optimized for a Hackathon environment using the $200 Azure credit limit.



## 1. Project Constraints & Decisions
- **Environment:** Hackathon. Short-term lifespan, low concurrent user count.
- **Domain:** Default Azure subdomains (`*.azurecontainerapps.io`).
- **Database Architecture:** Strict microservices pattern. Each service gets its own isolated database schema.


---

## 2. Infrastructure Architecture (Azure Stack)

To protect the architecture while adhering to microservices principles and staying within the hackathon budget, we will build the following entirely within **Azure Container Apps (ACA)**:

### 1. Internal Services (Private VNet)
These services will be deployed with **no public IP access**, completely shielded from the internet:
- **Microservices:** The 5 core backend services (`auth`, `account`, `transaction`, `notification`, `admin`).
- **Databases:** **PostgreSQL** (configured with 5 distinct schemas for data isolation) and **Redis** (for rate limiting and sessions).

### 2. Public Services (Internet Facing)
These services will be exposed to the internet to serve users and route traffic:
- **Frontend (Next.js):** The `client` container will be a public Container App serving the UI.
- **API Gateway (Express.js):** Your custom `api-gateway` container will be a public Container App. It handles rate limiting, JWT validation, and proxies requests securely to the internal microservices.

*(Note: We are using your custom Node.js API Gateway instead of the paid Azure API Management service to save your credits while maintaining the exact same security architecture).*

### 3. Storage: Azure Container Registry (ACR)
- A private registry to store all the Docker images built by the CI/CD pipeline. The Container Apps will pull from here securely.



## 4. Implementation Status

The Azure deployment architecture has been fully implemented:

1. **GitHub Actions Workflows:** The `ci.yml` and `cd.yml` workflows automate testing, building, and deploying the application, including a `seed-job` to initialize the database in production.
2. **Infrastructure Scripts:** Azure CLI scripts (`provision.azcli`, `provision-dbs.azcli`) are available in the `infrastructure/` directory to instantly provision the entire Azure architecture (ACR, VNet, ACA, etc.) correctly.
3. **Database Seeding:** A dedicated Azure Container App Job (`seed-job`) handles Prisma migrations and seeding default demo data during CD deployments.
