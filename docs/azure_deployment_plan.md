# AegisVault Azure Deployment & CI/CD Implementation Plan

This is the finalized deployment strategy for the AegisVault microservices architecture, optimized for a Hackathon environment using the $200 Azure credit limit.

## User Review Required

> [!WARNING]
> This plan is now finalized based on your feedback. Please click **Proceed** if you are ready for me to begin writing the GitHub Actions workflows and the Azure infrastructure scripts.

---

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



## 4. Execution Plan (Next Steps)

Once you approve this plan, I will perform the following actions:

1. **Create GitHub Actions Workflows:** Write the `ci.yml` and `cd.yml` files.
2. **Create Infrastructure Scripts:** Write the Azure CLI (`.azcli` or shell scripts) that you can run to instantly provision the entire Azure architecture (ACR, VNet, ACA, etc.) correctly.
3. **No automatic deployments:** I will only provide the configuration files and scripts. You will remain in control of when to run the scripts to use your Azure credits.
