# Azure vs. Docker Networking Analysis (Updated)

## 1. Does Local Docker Mimic Azure's Network?
**Short Answer:** No. They handle internal DNS resolution completely differently.

### Local Docker (Docker Compose)
When you run `docker-compose.yml`, Docker creates a custom bridge network (e.g., `aegisvault-network`). Docker includes a built-in DNS server that maps the exact `service` name to the container's internal IP address. 
*   **Result:** A microservice can connect to the database simply by calling `postgres:5432` or `redis:6379`. Docker automatically resolves `postgres` to the correct container.

### Azure Container Apps (ACA)
Azure Container Apps uses a managed virtual network environment. Unlike Docker Compose, **Azure does NOT support short-name DNS resolution out of the box**. 
*   **Result:** A microservice cannot simply call `postgres:5432`. It **must** use the Fully Qualified Domain Name (FQDN) assigned by the environment, which looks something like this: `postgres.internal.mangofield-38522f67.eastus.azurecontainerapps.io:5432`.

---

## 2. Are there any problems in your Azure Network?
**Yes. After reviewing your latest `git pull`, there are TWO Critical Networking Bugs breaking your cloud environment.**

I re-analyzed your updated deployment workflow (`.github/workflows/cd.yml`) and compared it to your `docker-compose.yml`.

### Bug #1: The Disconnect Bug (Still Unresolved)
While HTTP services (like `AUTH_URL` and the newly added `CLIENT_URL`) are correctly using FQDNs, your **Infrastructure Services (Postgres, Redis, RabbitMQ)** are STILL hardcoded to use the local Docker short names!

```bash
# The FQDNs are fetched perfectly fine:
PG_FQDN=$(az containerapp show -n postgres ...)

# BUT THEY ARE IGNORED! 
DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=require"
REDIS_URL="redis://redis:6379"
RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672"
```
**Impact:** Because `cd.yml` passes `@postgres:5432`, your Azure microservices are booting up and asking Azure's DNS server: *"Where is 'postgres'?"* Azure responds with `ENOTFOUND`. Your microservices are currently completely isolated from your databases in the cloud.

### Bug #2: The New SSL Crash Bug
In your recent update, `sslmode=disable` was changed to `sslmode=require` in the `DB_BASE` string.
```bash
# NEWLY ADDED:
DB_BASE=".../aegisvault?sslmode=require"
```
**Impact:** Your Postgres container (`postgres:16-alpine`) does not have SSL certificates configured or mounted. Furthermore, Azure Container Apps TCP ingress does not automatically terminate SSL for raw TCP traffic. When your apps try to connect using `sslmode=require`, Postgres will reject the connection because it doesn't support SSL. This will crash all your Node.js services on boot.

---

## 3. Proposed Fix (Analysis Only - No Changes Made)

To fix this, the `cd.yml` file needs to be updated. 

**Step 1:** Stop using the hardcoded short names and start using the FQDN variables that are already being fetched.
**Step 2:** Revert `sslmode=require` back to `sslmode=disable` (or omit it if your ORM supports fallback) so the container doesn't reject the connection.

The variables in `cd.yml` MUST be updated to look exactly like this:
*   `DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@${PG_FQDN}:5432/aegisvault?sslmode=disable"`
*   `REDIS_URL="redis://${REDIS_FQDN}:6379"`
*   `RABBITMQ_URL="amqp://guest:guest@${RABBITMQ_FQDN}:5672"`

Once those connection strings use the FQDNs and disable SSL enforcement, Azure's internal DNS will properly route the traffic, and your microservices will finally connect to your databases!
