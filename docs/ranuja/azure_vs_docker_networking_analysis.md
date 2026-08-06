# Azure vs. Docker Networking Analysis

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
**Yes. A Critical Networking Disconnect Bug.**

I analyzed your deployment workflow (`.github/workflows/cd.yml`) and compared it to your `docker-compose.yml`. There is a massive discrepancy that is currently breaking your cloud environment.

### The Good News
In your `cd.yml`, whoever wrote the script correctly understood that HTTP microservices need FQDNs. The script dynamically fetches the FQDNs and passes them correctly for HTTP calls:
```bash
AUTH_URL="https://$(az containerapp show -n auth-service ...)"
# Passed safely to other services as $AUTH_URL
```

### The Critical Bug
While HTTP services use the FQDN, your **Infrastructure Services (Postgres, Redis, RabbitMQ)** are hardcoded to use the local Docker short names!

Look at this section from your `cd.yml`:
```bash
# The FQDNs are fetched perfectly fine:
PG_FQDN=$(az containerapp show -n postgres ...)
REDIS_FQDN=$(az containerapp show -n redis ...)
RABBITMQ_FQDN=$(az containerapp show -n rabbitmq ...)

# BUT THEY ARE IGNORED! 
# The connection strings are hardcoded to use local short names:
DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@postgres:5432/aegisvault?sslmode=disable"
REDIS_URL="redis://redis:6379"
RABBITMQ_URL="amqp://guest:guest@rabbitmq:5672"
```

### The Impact
Because `cd.yml` passes `@postgres:5432` instead of `@$PG_FQDN:5432`, your Azure microservices are booting up and asking Azure's DNS server: *"Where is 'postgres'?"* 
Azure responds with `ENOTFOUND` (DNS resolution failed). 

**Currently, your cloud microservices cannot connect to your cloud databases.** They are completely isolated from Postgres, Redis, and RabbitMQ.

---

## 3. Proposed Fix (Analysis Only - No Changes Made)

To fix this, the `cd.yml` file needs to stop using the hardcoded short names and start using the FQDN variables that it is already fetching. 

The variables in `cd.yml` should be updated to look like this:
*   `DB_BASE="postgresql://aegis_admin:${DB_PASSWORD}@${PG_FQDN}:5432/aegisvault?sslmode=disable"`
*   `REDIS_URL="redis://${REDIS_FQDN}:6379"`
*   `RABBITMQ_URL="amqp://guest:guest@${RABBITMQ_FQDN}:5672"`

Once those connection strings use the FQDNs, Azure's internal DNS will properly route the traffic, and your microservices will finally connect to your databases!
