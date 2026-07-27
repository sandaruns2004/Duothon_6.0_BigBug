# AegisVault Transaction Service (`services/transaction-service`)

The Transaction Service runs on **Port 3003** and handles digital banking fund transfers, **real-time rule-based fraud detection**, paginated transaction histories, and verifiable receipt generation for the AegisVault platform.

## Core Architectural & Security Features

1. **Schema-per-Service Database (`txn_db`)**:
   - Manages isolated Postgres tables via Prisma ORM: `transactions` and `fraud_alerts`.
2. **Rule-Based Fraud Detection Engine (`src/utils/fraudEngine.js`)**:
   - Executes real-time evaluation across 3 core rules before transaction persistence:
     - **Rule 1 (High Amount)**: Triggers if transfer amount `> 500,000 LKR` (Risk score: `+40`).
     - **Rule 2 (High Velocity)**: Triggers if `>= 3 transfers` executed within the last 10 minutes (Risk score: `+35`).
     - **Rule 3 (New Recipient Large Amount)**: Triggers if `amount > 100,000 LKR` to an account with no prior successful transfer history (Risk score: `+25`).
   - If any rule triggers, flags the transaction (`fraudFlag: true`, `status: 'FLAGGED'`), creates explicit audit records in `fraud_alerts`, and dispatches async security alerts.
3. **Atomic Fund Transfer Orchestration**:
   - Performs sender balance pre-verification via HTTP `GET http://account-service:3002/api/accounts/:id/balance`.
   - Invokes Account Service atomic ACID transaction (`POST http://account-service:3002/api/accounts/execute-transfer`).
4. **Async Fire-and-Forget Security Notifications**:
   - Dispatches non-blocking notifications (`POST /internal/notify`) and audit logs (`POST /internal/audit`) to Notification Service (`http://notification-service:3004`).
5. **Verifiable Transaction Receipts**:
   - Generates formatted digital receipts (`RCP-<REFERENCE>`) suitable for download or audit compliance.

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/transactions/transfer` | Orchestrates balance check, fraud engine, ACID account transfer, and async alert dispatch. |
| `GET` | `/api/transactions` | Paginated transaction history with optional type (`TRANSFER\|PAYMENT\|DEPOSIT`) and date filters. |
| `GET` | `/api/transactions/:id` | Retrieves details for a single transaction (by UUID or reference number) including triggered fraud alerts. |
| `GET` | `/api/transactions/:id/receipt` | Returns a formatted digital transaction receipt. |
| `GET` | `/health` | Health check returning status, uptime, and service timestamp. |
