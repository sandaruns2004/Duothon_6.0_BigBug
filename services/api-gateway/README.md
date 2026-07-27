# AegisVault API Gateway (`services/api-gateway`)

The API Gateway is the central entry point for all incoming HTTP traffic in the AegisVault digital banking platform. It runs on **Port 3000** and orchestrates security, authentication, rate limiting, and reverse proxy routing to the 5 backend microservices.

## Architectural Middleware Stack

1. **CORS & Helmet (`cors`, `helmet`)**: Secures HTTP response headers and enables controlled cross-origin requests from the Next.js client (`http://localhost:8080`).
2. **Winston Request Logger (`requestLogger`)**: Outputs structured JSON logs containing timestamp, method, path, HTTP status, duration, IP, and authenticated `userId` / `userRole`.
3. **Redis-Backed Rate Limiter (`express-rate-limit`, `rate-limit-redis`)**:
   - `Public Route Limiter`: 20 requests per minute per IP (e.g., `/api/auth/login`).
   - `Authenticated Route Limiter`: 100 requests per minute per User ID or IP (e.g., `/api/accounts`, `/api/transactions`).
   - Includes graceful offline fallback to an in-memory store if Redis is unreachable.
4. **JWT Authentication & Route Whitelisting (`jwtAuthMiddleware`)**:
   - Whitelists public endpoints: `/health`, `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-otp`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`.
   - Validates Bearer token on all other `/api/*` endpoints.
   - Injects user identity headers (`x-user-id`, `x-user-role`, `x-user-email`) before proxying to backend microservices.
5. **Reverse Proxy Routing (`http-proxy-middleware`)**:
   - `/api/auth/*` → `http://auth-service:3001`
   - `/api/accounts/*`, `/api/payments/*`, `/api/loans/*` → `http://account-service:3002`
   - `/api/transactions/*` → `http://transaction-service:3003`
   - `/api/notifications/*`, `/api/audit/*` → `http://notification-service:3004`
   - `/api/admin/*` → `http://admin-service:3005`
   - Configured with `fixRequestBody` so parsed JSON payloads stream correctly to backend microservices.
6. **Health Check (`GET /health`)**:
   - Returns `{ status: 'healthy', service: 'api-gateway', timestamp, uptimeSeconds }`.
