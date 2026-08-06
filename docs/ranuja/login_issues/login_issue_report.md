# Login Issue Analysis Report

## Executive Summary
During the testing of the login functionality using the CLI against the deployed Azure environment, an authentication error was encountered. The login endpoint (`/api/auth/login`) returned a `500 Internal Server Error` with a generic message. Upon further investigation into the Azure Container Apps logs, the root cause was identified as a TLS handshake failure between the `auth-service` and the internal PostgreSQL database.

## Steps Taken to Reproduce
1. Attempted to trigger a login using the demo credentials via PowerShell:
   ```powershell
   Invoke-RestMethod -Uri "https://api-gateway.mangofield-38522f67.eastus.azurecontainerapps.io/api/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"email":"customer2@aegisvault.com","password":"CustomerSecure2026!"}'
   ```
2. The API Gateway responded with:
   ```json
   {"success":false,"error":"An error occurred during authentication. Please try again later."}
   ```
3. Queried the Azure Container App console logs for the `auth-service` to investigate the backend error.

## Analysis & Root Cause
By analyzing the logs for `auth-service` via Azure CLI (`az containerapp logs show -n auth-service`), the following stack trace was observed:
```
PrismaClientInitializationError: 
Invalid `prisma.user.findUnique()` invocation in
/app/src/controllers/auth.controller.js:102:36

Error opening a TLS connection: error performing TLS handshake: server does not support TLS
```

1. **Configuration Mismatch**: The deployed Azure environment currently has the `DATABASE_URL` configured with the parameter `?sslmode=require`. 
2. **Server Capability**: The internal PostgreSQL container (`postgres:16-alpine`) used in the Azure environment does not support or expose TLS over the internal network.
3. **Prisma Connection Failure**: When Prisma attempts to execute `prisma.user.findUnique()` during login, it strictly enforces a TLS connection due to `sslmode=require`. Since the PostgreSQL server rejects the TLS handshake, it throws a connection error.
4. **Seed Job Failure**: Because of the same TLS requirement, the database initialization job (`db-seed-job`) has also failed to connect to the database. This means the demo users (e.g., `customer2@aegisvault.com`) were never successfully seeded in the Azure environment.

## Conclusion and Recommendations
The login feature is completely blocked because the microservices cannot establish a connection to the database. Although the local `.github/workflows/cd.yml` file has already been updated to use `sslmode=disable`, these changes need to be committed and deployed to the Azure environment to resolve the issue.

### Next Steps:
1. Push the current local changes in `.github/workflows/cd.yml` to trigger a new deployment. This will update the `DATABASE_URL` environment variable for all services in Azure to use `sslmode=disable`.
2. Once the new deployment finishes, verify that the `db-seed-job` successfully runs and creates the demo users.
3. Re-test the login functionality via the frontend or CLI.
