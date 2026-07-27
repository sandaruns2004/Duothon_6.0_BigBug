# AegisVault Microservice Engine (`/services`)

This directory houses the API Gateway and the 5 independent microservices of the AegisVault digital banking platform.

## Service Catalog

| Service Name | Port | Database Schema | Primary Role |
| :--- | :---: | :--- | :--- |
| **API Gateway** (`api-gateway`) | `3000` | N/A | Rate limiting (Redis), JWT middleware, Winston logging, reverse proxy |
| **Auth Service** (`auth-service`) | `3001` | `auth_db` | User registration, login, JWT token issuance/refresh, OTP MFA, KYC |
| **Account Service** (`account-service`) | `3002` | `acct_db` | Bank account CRUD, balance queries, ACID transfers, loans, bill payments |
| **Transaction Service** (`transaction-service`) | `3003` | `txn_db` | Orchestrator for fund transfers, rule-based fraud detection engine |
| **Notification Service** (`notification-service`) | `3004` | `notif_db` | Email sending (Nodemailer), alerts, immutable hash-chained audit trail |
| **Admin Service** (`admin-service`) | `3005` | `admin_db` | System KPI metrics, user management, KYC verification, fraud monitoring |

## Standard Docker Build

Every microservice can be built using the `Dockerfile.template` located in this directory or through root Docker Compose:
```bash
docker compose build auth-service
```
