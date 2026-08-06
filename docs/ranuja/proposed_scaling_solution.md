# Proposed Scaling & Resource Allocation Solution

## 1. Executive Summary

Our previous analysis revealed that the current Azure Container Apps configuration is acting as a bottleneck. All services are hard-capped at 1 replica (`maxReplicas: 1`) and severely constrained by low compute resources (`0.5 vCPU`, `1Gi Memory`). 

To achieve "industrial quality" performance suitable for a high-stakes hackathon demo without incurring unnecessary cloud costs, we propose a two-tiered scaling strategy: **Horizontal Scaling** for stateless microservices and **Vertical Scaling** for stateful infrastructure.

---

## 2. Proposed Configuration

### Tier A: Stateless Microservices
*Applies to: `api-gateway`, `auth-service`, `account-service`, `transaction-service`, `notification-service`, `client`, `admin-service`*

These services process requests but do not store long-term state locally. They are perfect candidates for horizontal elasticity.

| Setting | Current | Proposed | Rationale |
| :--- | :--- | :--- | :--- |
| **Min Replicas** | 1 | **1** | Avoids "Cold Start" delays. Ensures the app is always instantly responsive when a judge or user first interacts with it. |
| **Max Replicas** | 1 | **5** | Allows the system to seamlessly handle load bursts (e.g., a stress test) by spinning up extra instances on demand. |
| **CPU / Memory** | 0.5 / 1Gi | **0.5 / 1Gi** | Keep as is. Because these services scale horizontally, it is more efficient to have many small instances than a few large ones. |
| **Scaling Rule** | None | **HTTP Concurrency (50)** | Azure needs a metric to trigger scaling. A rule that spins up a new instance when concurrent HTTP requests exceed 50 per replica is an industry standard for web apps. |

### Tier B: Stateful Infrastructure
*Applies to: `postgres`, `redis`, `rabbitmq`*

These services manage persistent data and state. Running multiple disconnected replicas of a standard database container leads to data corruption. Therefore, they must scale vertically (getting bigger, not multiplying).

| Setting | Current | Proposed | Rationale |
| :--- | :--- | :--- | :--- |
| **Min Replicas** | 1 | **1** | Must always be running. |
| **Max Replicas** | 1 | **1 (STRICT)** | Prevents Azure from spinning up disjointed database instances under load, which would break the application. |
| **CPU / Memory** | 0.5 / 1Gi | **1.0 vCPU / 2Gi** | Databases are resource-hungry. Doubling the CPU and memory prevents query bottlenecks and ensures the persistence layer can keep up with the horizontally scaled microservices. |

---

## 3. Cost vs. Performance Analysis

- **Performance Gain**: By applying this solution, your API Gateway and microservices will no longer queue requests under heavy load. The database will process queries twice as fast, resulting in a snappy, "instant" user experience.
- **Cost Efficiency**: You only pay for the extra microservice replicas *when traffic actually spikes*. Because `minReplicas` remains at 1, your baseline running cost only slightly increases due to the vertically scaled databases. This strikes the perfect balance for a hackathon: enterprise-grade elasticity on a startup budget.

---

## 4. Implementation Guide

No application code changes are required. You can implement this proposed solution instantly using the Azure CLI.

**Step 1: Vertically Scale Infrastructure**
```bash
az containerapp update -n postgres -g aegisvault-rg --cpu 1.0 --memory 2.0Gi
az containerapp update -n redis -g aegisvault-rg --cpu 1.0 --memory 2.0Gi
az containerapp update -n rabbitmq -g aegisvault-rg --cpu 1.0 --memory 2.0Gi
```

**Step 2: Horizontally Scale Microservices & Add Rules**
*(Run this for `api-gateway`, `auth-service`, `transaction-service`, etc.)*
```bash
az containerapp update -n api-gateway -g aegisvault-rg \
  --min-replicas 1 \
  --max-replicas 5 \
  --scale-rule-name http-scale-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```
