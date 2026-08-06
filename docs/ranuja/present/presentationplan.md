# Phase 3 Judging: Presentation Plan & Talking Points

This guide is designed for the judging round. Since there are no slides and it's a Q&A/discussion format, use these talking points to directly address the **evaluation criteria** and highlight our **special technical approaches**.

---

## 1. Introduction (The Elevator Pitch)
**What to say:**
"Welcome! For Phase 3, we successfully moved our rebuilt platform, **AegisVault**, out of the repository and into a live cloud environment. Our primary goal was to ensure maximum resilience against the 'Super Malware Agent' scenario by building an automated, microservices-based system that can recover from failure without manual intervention."

---

## 2. Covering the Mark Allocation & Technologies Used

### A. Build & Release Automation (20%)
*   **What to say:** "We fully automated our deployment pipeline. To achieve repeatable, verifiable, and safe releases, we utilize **GitHub Actions** (`cd.yml`). Every change pushed to the main branch is automatically built, tested, and deployed to our cloud environment. There are no manual steps required to update the application."
*   **Technologies:** GitHub Actions

### B. Service Deployment & Environment Consistency (15%) & Automated Infrastructure (15%)
*   **What to say:** "We guarantee environment consistency by containerizing every single component. Using **Docker and Docker Compose**, our infrastructure acts as code. Whether we run this on a developer's machine or in the cloud production environment, the platform behaves identically. We have custom `Dockerfiles` for each service."
*   **Technologies:** Docker, Docker Compose

### C. Scalability, Availability & Reliability (10%) & Special Approaches
*   **What to say:** "Our system is built on a **Microservices Architecture**. Instead of one monolithic block, we split AegisVault into specific services: API Gateway, Auth, Account, Transaction, Notification, and Admin. 
    *   **Special Approach - Asynchronous Messaging:** We use **RabbitMQ** to decouple these services. For example, if the notification service crashes, the transaction service still works perfectly—the message is just queued in RabbitMQ until the notification service comes back online.
    *   **Special Approach - Data Isolation:** We use a single PostgreSQL instance but enforce strict data isolation by giving each microservice its own database schema (e.g., `auth_db`, `acct_db`)."
*   **Technologies:** RabbitMQ, Microservices Architecture, Node.js (assuming based on Next/JS ecosystem)

### D. Operational Visibility & System Health (15%)
*   **What to say:** "To ensure we understand the state of the system at any moment, we've implemented strict health checks directly into our container orchestration. Services do not start until their dependencies (like RabbitMQ, Redis, or Postgres) report as healthy via automated ping tests. Furthermore, our Docker Compose setup enforces `restart: always` to self-heal in case of a crash."
*   **Technologies:** Docker Healthchecks, Redis (Ping), Postgres (`pg_isready`)

### E. Security Practices & Protection of Sensitive Data (15%)
*   **What to say:** "We’ve taken security very seriously. All sensitive data (Database passwords, JWT secrets, SMTP credentials) are injected via `.env` variables and never hardcoded in the repository. We also use a dedicated internal Docker network (`aegisvault-network`), meaning our databases and message brokers are completely invisible from the outside world; only the API Gateway and frontend are exposed."
*   **Technologies:** JWT, Docker Networking, Environment Variables

---

## 3. Specific Special Approaches to Highlight
If the judges ask "What makes your project stand out?", hit them with these three points:
1.  **RabbitMQ Message Broker:** Show them how it creates fault tolerance. "Our services don't wait on each other synchronously. We emit events."
2.  **Schema-per-Service Database Design:** "We followed true microservice data patterns. Services cannot accidentally corrupt each other's data because they operate in isolated schemas within Postgres."
3.  **Redis Caching:** "We integrated Redis to cache frequent data requests (like sessions/auth), reducing database load and speeding up response times."

---

## 4. Closing 
"By deploying AegisVault in this manner, we've proven it can survive real traffic and real failures. We have successfully automated the restoration of the digital banking system."
