# AegisVault Auth Service (`services/auth-service`)

The Auth Service runs on **Port 3001** and is responsible for customer identity management, secure authentication, multi-factor login (MFA OTP), JWT token issuance, session refresh, and customer KYC document submissions.

## Core Architectural & Security Features

1. **Schema-per-Service Database (`auth_db`)**:
   - Manages three isolated Postgres tables via Prisma ORM: `users`, `refresh_tokens`, and `otp_records`.
2. **Password Hashing & Account Lockout Enforcement**:
   - Hashes all passwords using `bcrypt` with **cost factor = 12**.
   - Tracks failed login attempts (`failedAttempts`).
   - Automatically locks accounts after **5 consecutive failed attempts** (`isLocked = true`).
3. **MFA Login & OTP Engine**:
   - On valid password verification, generates a secure 6-digit numeric OTP.
   - Caches OTP hash in **Redis** (`aegis_otp:login:<email>`) with a **5-minute TTL (300 seconds)**.
   - Also records OTP hash in Postgres (`otp_records`) as a resilient fallback.
   - Dispatches OTP email via `notification-service` (`http://notification-service:3004`).
4. **JWT Token Issuance & Refresh**:
   - `Access Token`: 15-minute expiration (`15m`), signed with `process.env.JWT_SECRET`. Contains `id`, `email`, `role`, and `kycStatus`.
   - `Refresh Token`: 7-day expiration (`7d`), hashed and persisted in `refresh_tokens` table with revocation checks.
5. **Customer KYC Submission**:
   - Accepts NIC number and document references.
   - Automatically updates KYC verification status to enable instant testing of banking accounts and transactions.

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registers a new user with Zod input validation and bcrypt password hashing. |
| `POST` | `/api/auth/login` | Verifies credentials, enforces lockout rules, generates MFA OTP, and sends email. |
| `POST` | `/api/auth/verify-otp` | Validates 6-digit OTP against Redis/Postgres and issues Access & Refresh JWTs. |
| `POST` | `/api/auth/refresh` | Validates refresh token against Postgres session store and issues a new Access token. |
| `GET` | `/api/users/profile` | Retrieves authenticated user profile and KYC status. |
| `PUT` | `/api/users/profile` | Updates user contact information (email or phone). |
| `POST` | `/api/users/kyc` | Submits NIC document reference for KYC verification. |
| `GET` | `/health` | Health check endpoint returning status, uptime, and service timestamp. |
