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
