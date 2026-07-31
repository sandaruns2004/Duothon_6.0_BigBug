# Agent Guidelines: AegisVault Documentation Reference

Welcome to the AegisVault project! Whenever you are working on this repository, please refer to the 3 core architecture documents located in the `docs/` directory for context.

## Core Documentation (`/docs/`)

1. **`basic features.md`** 
   - **What it is:** The complete system architecture and application blueprint.
   - **Contents:** Details the 5 microservices, database schemas (PostgreSQL schema-per-service), API endpoints, authentication flow (JWT + OTP), core banking transaction ACID flow, and the frontend stack (Next.js). Use this to understand *how the app works*.

2. **`azure_deployment_plan.md`**
   - **What it is:** The finalized Azure infrastructure strategy.
   - **Contents:** Explains how the microservices are protected inside an internal Azure Virtual Network (VNet) using Azure Container Apps, and how the public-facing API Gateway routes traffic to them. Use this to understand *where and how the app is hosted*.

3. **`ci_cd.md`**
   - **What it is:** The Continuous Integration and Continuous Deployment strategy.
   - **Contents:** Details the GitHub Actions workflows (`ci.yml` and `cd.yml`) used for linting, testing (Jest/Supertest), Docker image building, pushing to Azure Container Registry (ACR), and deploying to Azure Container Apps. Use this to understand *how code gets tested and deployed*.

4. **`transfers_and_transactions_guide.md`**
   - **What it is:** The complete technical blueprint and operational guide for transfers, transactions, fraud detection, and JIT account provisioning.
   - **Contents:** Details ACID SQL transactions (`account-service`), the rule-based fraud engine (`transaction-service`), SHA-256 audit logs (`notification-service`), **Just-In-Time (JIT) Auto-Provisioning** (`500k LKR` default for new users), and dynamic multi-sandbox session binding (`Customer 1` vs `Customer 2`).

> **Note to AI Agents:** Always consult these documents before suggesting architectural changes or writing deployment scripts to ensure alignment with the established project constraints (Hackathon environment, strict microservices isolation, $200 Azure credit limit, and dynamic JIT account resolution).
