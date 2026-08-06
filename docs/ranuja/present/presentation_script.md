# Presentation Script

"Hi judges, welcome to AegisVault! 

For Phase 3, we successfully moved our banking platform out of our local setup and into a live production environment. Our main goal was making sure the system is highly resilient and recovers from failure automatically.

To do that, we focused on a few key approaches:
1. **Microservices & RabbitMQ:** Instead of one big app, we split the system into specific services (Auth, Accounts, Transactions). They communicate via RabbitMQ, so if one service crashes, the rest of the bank stays online.
2. **Environment Consistency:** Everything is containerized with Docker and Docker Compose.
3. **Security & Visibility:** Sensitive data is isolated, and we have automated health-checks running constantly to ensure system health.

That's the high-level view of our architecture. What would you like to see first?"

---

### Build & Release Automation (20% of Marks)

*(When they ask about your deployment or CI/CD, use this script:)*

"To guarantee safe and repeatable releases, we built a fully automated GitHub Actions pipeline. There is absolutely no manual intervention required. 

Here is how it works:
First, our **CI** pipeline automatically runs Jest unit tests for our microservices and does a dry-run build of our Docker Compose setup. This catches any code or infrastructure errors early before they ever reach the cloud.

Once the CI passes, our **CD** takes over to securely push the updates to Azure Container Apps. 

Since we have a microservices architecture, deploying everything at once would be very slow. So, we implemented two specific approaches in our `cd.yml` code to drastically reduce the time the CD takes to run:
1. **Path Filtering:** We implemented a path filter. The pipeline detects exactly which microservices had code changes. We only build and deploy the specific services that actually changed, rather than rebuilding the entire repository.
2. **Parallel Deployment:** In our deployment script, instead of updating our Azure containers one by one sequentially, we use bash background jobs (`&` and `wait`) to deploy all the updated services in parallel at the exact same time.

Because of this, our automated release process is incredibly fast, efficient, and perfectly reliable."

---

### Service Deployment, Environment Consistency (15%) & Automated Infrastructure (15%)

*(When they ask about Docker, Containerization, or Infrastructure-as-Code, use this script:)*

"To ensure our platform behaves the exact same way wherever it runs, we containerized every single component of AegisVault using **Docker**. Our frontend, API Gateway, our 5 microservices, Postgres database, Redis cache, and RabbitMQ broker all run in isolated containers. We used lightweight `alpine` base images in our Dockerfiles to keep our containers secure, small, and fast to boot.

For **Automated Infrastructure**, we use **Docker Compose** to define our entire system as code. 
Our `docker-compose.yml` automatically provisions exactly what we need:
1. **Isolated Networks:** It sets up a dedicated internal `aegisvault-network`. This ensures our databases and message brokers are completely hidden from the public internet.
2. **Persistent Volumes:** It provisions secure volumes for Postgres, guaranteeing no financial data is lost if a container restarts.
3. **Strict Dependencies & Healthchecks:** We use `condition: service_healthy` so our microservices wait to start until RabbitMQ and Postgres are fully operational.

In production, our automated pipeline provisions this exact same architecture using **Azure Container Apps**, ensuring 100% environment consistency between what we built and what is running live in the cloud right now."

---

### Scalability, Availability & Reliability (10%) & Special Approaches

*(When they ask what makes your project unique, or how you handle high traffic and failures, use this script:)*

"To guarantee massive scalability and reliability, we completely avoided building a monolithic application. Instead, we architected AegisVault as a true **Microservices** platform. We split the banking system into independent, focused services: an API Gateway, Auth, Account, Transaction, Notification, and Admin service.

To handle sudden traffic spikes dynamically without wasting resources, we configured Azure to **auto-scale horizontally**. Here is the exact hardware allocation and respawn scaling logic we applied to each service:

| Service Component | Machine Power | Min Instances | Max Instances | Scaling Trigger (Respawn Logic) |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Client (Frontend)** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Auth Service** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Account Service** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Transaction Service** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Notification Service**| 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **Admin Service** | 0.5 CPU / 1Gi RAM | 1 | 5 | Spawns new replica when > 50 Concurrent HTTP Requests |
| **RabbitMQ Broker** | 0.5 CPU / 1Gi RAM | 1 | 1 | Fixed Allocation (No Auto-scaling) |

This architecture allowed us to implement some very specific special approaches to guarantee availability:

First, **Asynchronous Messaging via RabbitMQ**. Our services don't wait on each other synchronously. For example, if the Notification service crashes during a spike, the Transaction service doesn't fail—it just emits an event to RabbitMQ, which safely queues the message until the Notification service comes back online.

Second, **Strict Data Isolation**. Even though we use a single PostgreSQL database to reduce overhead, we implemented a strict 'schema-per-service' design. The Auth service uses `auth_db`, the Account service uses `acct_db`, and so on. This prevents any service from accidentally corrupting another service's data, which is critical for financial security.

Finally, we integrated **Redis** to cache frequent lookups, such as user sessions in the Auth service. This drastically reduces the load on our database and speeds up response times for end users, allowing us to easily handle sudden spikes in traffic."

---

### Operational Visibility & System Health (15% of Marks)

*(When they ask how you monitor the system or prevent crashes from spiraling, use this script:)*

"To guarantee that our platform can self-heal, we implemented strict **Automated Healthchecks** and dependency rules in our orchestration code.

For our local infrastructure defined in `docker-compose.yml`, we wrote explicit commands to validate system health every 5 seconds. Our Postgres container runs `pg_isready -U aegis_admin -d aegisvault`, Redis executes `redis-cli ping`, and RabbitMQ uses `rabbitmq-diagnostics -q ping`. We pair this with `condition: service_healthy` so our microservices absolutely will not boot up until they verify these dependencies are ready.

In our production cloud environment, we rely on **Azure Container Apps** native orchestration. As defined in our `provision-dbs.azcli` and `provision.azcli` scripts, Azure continuously monitors the active TCP transport ports (like 5432 for Postgres, 5672 for RabbitMQ, and our microservice ports). 

If a service crashes or a port stops responding, the container orchestration immediately kills the failed pod and spins up a fresh instance without any manual intervention. Because we enforce a strict auto-restart policy across both our local and cloud environments, we have a completely self-healing system."

---

### Security Practices & Protection of Sensitive Data (15% of Marks)

*(When they ask how you secure the banking platform from attackers, use this script:)*

"Because we are deploying a financial platform, security and data protection were woven into our architecture from day one. We focused heavily on two main areas: Network Exposure and Secret Management.

First, we implemented strict **Network Isolation**. If you look at our `provision.azcli` script for Azure, you'll see that our API Gateway and Frontend Client are the *only* services created with `external` ingress. Our core microservices (Auth, Account, Transaction), as well as our Postgres database and RabbitMQ broker, are strictly deployed with `internal` ingress. This means our core financial logic and sensitive customer data are completely walled off and cannot be directly accessed by an attacker on the public internet. 

Second, we completely eliminated hardcoded secrets. In our `cd.yml` deployment pipeline, you'll notice that sensitive data—like our Postgres Database Passwords, SMTP mail credentials, and JWT Signing Secrets—are injected dynamically using **GitHub Secrets**. They are passed securely as environment variables to the Azure containers at runtime, so they never exist in plain text in our code repository. 

Finally, to protect user data, we implemented a robust **JWT (JSON Web Token)** architecture in our Auth service. We use short-lived access tokens that expire in 15 minutes, paired with encrypted refresh tokens. This ensures that even if an attacker manages to intercept a user's session token, their access window is extremely limited."

---

### Specific Special Approaches to Highlight

*(If the judges explicitly ask "What makes your project stand out?", hit them with these three advanced architectural decisions we made that go above and beyond the requirements:)*

1. **Smart Monorepo CD Strategy (Path Filtering):** 
"We didn't just write a basic deployment script. We built an advanced CI/CD pipeline using `dorny/paths-filter`. Our pipeline analyzes Git commits, figures out exactly which microservices were modified, and *only* builds and deploys those specific containers. This allows us to push lightning-fast micro-updates without rebuilding the entire banking platform."

2. **Automated Database Seeding via Serverless Jobs:** 
"We completely automated our database initialization. Instead of manually running SQL scripts, our deployment pipeline dynamically spins up an ephemeral **Azure Container Apps Job** (`db-seed-job`). This serverless job runs Prisma ORM to automatically generate our database schemas and seed initial data, then deletes itself to save costs."

3. **Centralized API Gateway Pattern:** 
"Instead of our frontend communicating with 5 different microservices, we built a dedicated API Gateway. It acts as a single, secure entry point for the public internet. It validates JWT tokens and routes traffic internally, ensuring that an attacker can never directly ping our core transaction or account services."

---

### Engineering Best Practices, Team Contributions (10% of Marks) & Closing

*(To wrap up the presentation or if asked about your team workflow, use this script:)*

"Beyond just deploying the code, we adhered strictly to **Engineering Best Practices**. We maintained a clean, modular repository structure where each microservice is completely decoupled with its own `Dockerfile` and `package.json`. Our entire deployment relies on Infrastructure as Code (using our `.azcli` scripts and `docker-compose.yml`), making our cloud setup fully auditable and version-controlled via Git.

As a team, we distributed the workload effectively. *(Take 10 seconds here to mention who handled what—for example, who built the CI/CD pipeline, who managed Azure, and who secured the microservices).*

**Closing Statement:**
By deploying AegisVault using this automated, self-healing microservices architecture, we've proven it can survive real traffic, real failures, and real attackers. We didn't just write code—we successfully restored and fortified the digital banking system. 

Thank you, and we'd be happy to answer any questions you have!"
