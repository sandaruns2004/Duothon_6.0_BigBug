# AegisVault Frontend Client (`/client`)

Next.js 14 Web Application for Customer & Admin portals of the AegisVault digital banking platform.

## Architecture & Tech Stack

- **Framework:** Next.js 14 (App Router, Server-Side Rendering)
- **Language:** TypeScript
- **UI Components:** shadcn/ui + Radix UI Primitives
- **Form Handling:** React Hook Form + Zod (client-side validation matching backend schemas)
- **State & Data Fetching:** TanStack Query (React Query)
- **Charts & Visualization:** Recharts (Admin Dashboard KPIs)

## Container & Routing

- Runs on internal port `3000`, mapped to host port `8080` (`http://localhost:8080`).
- Communicates with backend exclusively via API Gateway (`http://api-gateway:3000` in container network or `http://localhost:3000` via client browser).

## Dynamic Account Resolution & Sandbox Testing

- **Dynamic Account Binding**: All customer pages (`/dashboard`, `/transfer`, `/transactions`, `/payments`, `/profile`) dynamically bind to the logged-in user's active account (`aegisvault_selected_account_number`) and profile (`/api/users/profile`) without static demo fallback placeholders.
- **Quick Evaluation Sandbox (`/login`)**:
  - **Customer 1 Demo** (`customer1@aegisvault.com` — Savings Account `810000000001` — 1,500,000.00 LKR)
  - **Customer 2 Demo** (`customer2@aegisvault.com` — Current Account `810000000002` — 750,000.00 LKR)
  - **Admin Demo** (`admin@aegisvault.com` — Admin Governance Dashboard)
- **Session Hygiene**: Logging out via `clearTokens()` purges all cached tokens and account selection keys from `localStorage`, preventing any session state leakage across users.
