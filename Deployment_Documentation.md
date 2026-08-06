# Duothan 6.0 - Phase 03 Deployment Documentation

> **Team:** BigBug
> **Project:** AegisVault Digital Banking Platform
> **Live URL:** [https://client.mangofield-38522f67.eastus.azurecontainerapps.io/](https://client.mangofield-38522f67.eastus.azurecontainerapps.io/)

This document outlines our production deployment architecture, demonstrating how the AegisVault platform fulfills the Phase 3 RESTORE requirements for consistency, automation, scalability, visibility, and security.

---

## 1. Service Deployment & Environment Consistency

Our platform is containerized using Docker, guaranteeing that it behaves exactly the same way in local development and production. We deploy to Microsoft Azure Container Apps to manage our independent microservices.

### Containerization Proof

![Local Docker Containers](./public/screenshots/local%20docker%20containers.png)
*Figure 1: Proof of local environment parity showing our core microservices running seamlessly in Docker Desktop.*

---

## 2. Build & Release Automation (CI/CD)

We have fully automated our release process. Changes merged to the main branch automatically trigger our GitHub Actions CI/CD pipelines, which build the Docker images, run tests, and deploy directly to Azure.

### CI/CD Pipeline Execution

![GitHub Actions Pipeline Checks](./public/screenshots/github%20actions%20pipeline%20checks.png)
*Figure 2: Comprehensive pipeline checks ensuring code quality, running tests, and preparing artifacts before deployment.*

![GitHub Actions Workflow History](./public/screenshots/github%20actions%20workflow%20history.png)
*Figure 3: Consistent, green build history demonstrating reliable continuous integration and deployment processes.*

---

## 3. Automated Infrastructure & Configuration Management

We utilize automated GitHub workflows and structured resource groups in Azure to ensure our environments are reproducible. This approach protects against human error during deployment. *(Note: We opted for automated CI/CD-driven resource configuration instead of Terraform/Kubernetes for this phase).*

### Infrastructure Provisioning

![Azure Resource Groups & Containers](./public/screenshots/azure%20resource%20groups%20&%20containers.png)
*Figure 4: Automated cloud infrastructure showcasing active resource groups and container apps deployed in Azure.*

---

## 4. Scalability, Availability & Reliability

Our architecture is designed to handle varying loads seamlessly. By deploying independently scalable microservices, we can adapt to real traffic spikes and automatically recover from localized failures.

### Scaling and Availability Configurations

![API Gateway Azure Info](./public/screenshots/api%20gateway%20info%20azure.png)
*Figure 5: API Gateway scaling and availability overview, detailing ingress routing and instance allocation rules.*

---

## 5. Operational Visibility & System Health

We maintain strict visibility into our system's health, ensuring that incidents are detected through logs and metrics long before customers notice them.

### Monitoring and Logging Dashboards

![Grafana API Gateway Dashboards](./public/screenshots/api%20gateway%20dashboards%20with%20graffana.png)
*Figure 6: Real-time Grafana monitoring dashboard tracking API Gateway request rates, latencies, and active connections.*

![API Gateway Logs & Query History](./public/screenshots/api%20gateway%20logs%20&%20query%20history.png)
*Figure 7: Detailed log aggregation and query history providing deep insights into system operations.*

![Auth Service Grafana Dashboard](./public/screenshots/auth%20service%20graffana%20dashboard%20metrics.png)
*Figure 8: Authentication service telemetry displaying token issuance rates and validation health.*

---

## 6. Security Practices & Protection of Sensitive Data

Security is maintained throughout the delivery process. All sensitive data (API keys, database credentials) are injected securely via key vaults at runtime, and our network boundaries are restricted.

### Secret Management & Network Security

![GitHub Secrets & Variables](./public/screenshots/github%20secrets%20&%20variables.png)
*Figure 9: Strict secret management separating sensitive credentials and environment configurations from source code.*

---

## 7. Live Application Proof

The banking platform is fully operational, publicly accessible, and successfully serving traffic in production.

### Live Production Web App

**Client Dashboard:**
![Application Client Dashboard](./public/screenshots/application%20client%20dashboard.png)
*Figure 10: The central client interface showing an overview of accounts, balances, and quick actions.*

**Admin Dashboard:**
![App Admin Dashboard](./public/screenshots/app%20admin%20dashboard.png)
*Figure 11: The admin interface for comprehensive system management, user analytics, and platform oversight.*

---

## 8. Application Feature Gallery

Below are additional views of our deployed application, highlighting the breadth of features implemented.

### Client Application Features

**Bills Payment Portal:**
![Application Client Bills](./public/screenshots/application%20client%20bills.png)
*Figure 12: Integrated portal for securely managing and paying utility and service bills.*

**Financial Ledger:**
![Application Client Ledger](./public/screenshots/application%20client%20ledger.png)
*Figure 13: Detailed transaction ledger for clients to track historical financial movements.*

**Loan Calculator:**
![Application Client Loan Calculator](./public/screenshots/application%20client%20loan%20calculator.png)
*Figure 14: Interactive tools for clients to model loan scenarios and calculate repayment schedules.*

**Funds Transfer:**
![Application Client Transfer](./public/screenshots/application%20client%20transfer.png)
*Figure 15: Secure internal and external transfer interface for moving funds seamlessly.*

**Client Profile:**
![App Client Profile](./public/screenshots/app%20client%20profile.png)
*Figure 16: Account settings and profile management for personalized banking experiences.*

### Admin Application Features

**Alerts & Notifications:**
![App Admin Alerts](./public/screenshots/app%20admin%20alerts.png)
*Figure 17: Administrative alert center for monitoring flagged activities and system notifications.*

**Transaction Oversight:**
![App Admin Transactions](./public/screenshots/app%20admin%20transacions.png)
*Figure 18: Global transaction monitoring interface allowing admins to review and audit platform activity.*

**User Registry:**
![App Admin User Registry](./public/screenshots/app%20admin%20user%20registry.png)
*Figure 19: Comprehensive user management portal for handling client onboarding and account statuses.*
