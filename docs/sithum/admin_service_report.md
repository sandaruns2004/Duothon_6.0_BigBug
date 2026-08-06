# Admin Service Capabilities & Status Report

This report outlines the responsibilities of the Admin Service, its current implementation status, and the modifications required to meet the functional requirements outlined in the project specifications.

## 1. What the Admin Service Does

The Admin Service acts as the central command and governance center for the AegisVault platform. It securely interfaces with other microservices (Auth, Account, Transaction) to provide administrators with oversight and control over the banking ecosystem.

### Core Capabilities:
- **Dashboard & KPIs**: Aggregates real-time metrics including total users, pending KYC, active accounts, daily transaction volume, and flagged fraud alerts.
- **User Governance**: Allows administrators to list users, suspend suspicious accounts, and unlock previously locked accounts.
- **KYC Management**: Provides tools to review user-uploaded KYC documents and either approve or reject their verified status.
- **Fraud Monitoring**: Interfaces with the Transaction Service to display rule-based fraud alerts (e.g., high velocity, large thresholds) for manual review.
- **Cryptographic Audit Viewer**: Displays the immutable, SHA-256 hash-chained audit logs for critical system actions.
- **Loan Approvals**: Lists pending loan applications and allows administrative officers to approve or reject them based on credit risk.
- **Transaction Ledger**: Provides a complete view of all transactions across the platform for auditing purposes.

---

## 2. What is Already Working

Based on the current implementation in `admin.controller.js` and `client/src/app/admin/page.tsx`, the following features are actively functioning:

- **Secured Routes**: All admin endpoints are protected by the `requireRole('ADMIN', 'OFFICER')` RBAC middleware.
- **Metrics Aggregation**: The `getDashboard` API successfully pulls counts from multiple Prisma schemas and generates daily system metric snapshots.
- **Cross-Service Communication**: The Admin service successfully proxies requests to:
  - Auth Service (for listing users, verifying KYC, etc.)
  - Account Service (for fetching pending loans and approving them)
- **Governance Actions**: Suspending, unlocking, verifying KYC, and rejecting KYC endpoints are implemented and record an `admin_actions` audit trail.
- **Admin UI Components**: 
  - KPI metric cards are displaying live data.
  - Tabbed interface exists for: **Users, Fraud Alerts, Audit Chain, Pending Loans, All Transactions**.
  - KYC Document Modal is implemented for reviewing uploaded NICs.
  - Verification of the Cryptographic Audit Chain works directly from the UI.

---

## 3. Things to Implement

To fully satisfy the functional requirements, the following features need to be implemented:

- **Security Alerts & Important Logs Dashboard**: While fraud alerts exist, general security alerts (e.g., multiple failed login attempts, locked accounts due to brute force) need a dedicated view. The dashboard should aggregate these important logs.
- **Manual Login After Account Blocking (Admin Side)**: Providing administrators the ability to manually initiate a login or generate a secure one-time unlock link for users who were locked out due to exceeding failed attempts.
- **Advanced Filtering**: Adding date-range and status filters for loans and KYC approvals to make the admin workflows more efficient.

---

## 4. Things That Need Changes / Modifications

These are the immediate changes required in the existing codebase:

> [!WARNING]
> **Distracting UI Elements**
> Currently, the Recharts (Area/Bar charts showing transaction volume and velocity) are rendered at the top of the `page.tsx` file, meaning they are visible across **all tabs** (Users, Fraud, Audit, etc.). This makes the UI cluttered and distracting.
> 
> **Solution**: Move the charts into a dedicated "Overview" or "Dashboard" tab so they are only visible when the admin specifically wants to view high-level platform analytics.

- **Tab Restructuring**: Introduce a new `overview` tab to house the KPI cards and the Recharts graphs. Default the view to this `overview` tab.
- **Loan UI Enhancements**: Currently, rejecting a loan does not prompt the admin for a reason. Adding a modal to provide a rejection reason (which can be sent to the user via the Notification Service) will improve user experience.
- **Error Handling on Cross-Service Calls**: Add more robust fallback UI states in the admin dashboard in case the Auth or Account service is temporarily down, preventing the whole dashboard from crashing.
