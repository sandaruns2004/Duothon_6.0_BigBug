# AegisVault Account Service (`services/account-service`)

The Account Service runs on **Port 3002** and is responsible for customer bank account lifecycle management, real-time balance queries, loans, utility bill payment processing, and executing **atomic ACID fund transfers** for the AegisVault platform.

## Core Architectural Features

1. **Schema-per-Service Database (`acct_db`)**:
   - Manages isolated Postgres tables via Prisma ORM: `accounts`, `loans`, and `utility_receipts`.
2. **Auto-Generated Unique Account Numbers**:
   - Automatically assigns unique 12-digit numeric account numbers starting with the Sri Lankan banking prefix `102`.
3. **Atomic ACID SQL Transactions (`execute-transfer`)**:
   - Implements atomic debit/credit fund transfer execution wrapped in `prisma.$transaction`.
   - Guaranteed automatic rollback if the source account has insufficient funds (`INSUFFICIENT_FUNDS`) or if either account is inactive/frozen.
4. **Utility Bill Payments (`/api/payments/bill`)**:
   - Debits the customer's account atomically and generates a verifiable `UtilityReceipt` (`UB-<TIMESTAMP>-<HASH>`).
5. **Real-Time Balance Verification**:
   - Supports balance queries by either UUID or 12-digit account number for seamless internal microservice interoperability (e.g. Transaction Service pre-transfer balance check).

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/accounts` | Creates a new bank account with auto-generated 12-digit number & initial deposit. |
| `GET` | `/api/accounts` | Lists all bank accounts owned by the authenticated user (`x-user-id`). |
| `GET` | `/api/accounts/:id/balance` | Real-time balance lookup by UUID or 12-digit account number. |
| `POST` | `/api/accounts/execute-transfer` | Internal atomic ACID transaction: debit sender, credit receiver, auto-rollback on insufficient funds. |
| `POST` | `/api/payments/bill` | Executes utility bill payment (Electricity, Water, Internet, Mobile) & returns receipt. |
| `GET` | `/health` | Health check returning status, uptime, and service timestamp. |
