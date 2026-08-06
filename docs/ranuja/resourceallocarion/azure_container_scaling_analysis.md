# Azure Container Apps Scaling & Performance Analysis

Based on the configuration of your Azure Container Apps in the `aegisvault-rg` resource group, here is an in-depth analysis regarding container starting times, sleep behaviors, and performance bottlenecks.

## 1. Do the Containers Sleep? (Cold Starts vs. Warm Starts)

In Azure Container Apps, containers "sleep" when they scale down to 0 instances (which typically happens after a period of inactivity to save costs). When a new request arrives, a **Cold Start** occurs, taking 5–15 seconds to provision the container, pull the image, and start the application.

**Your Configuration:**
- **`minReplicas`**: Set to `1` across **all** your container apps (`auth-service`, `api-gateway`, `postgres`, etc.).

**Analysis:**
Because `minReplicas` is `1`, your containers **never go to sleep**. They are always running at least one active instance. Therefore, your website does **not** experience cold starts when a user visits after a period of inactivity. 
- *Initial Start Time*: The only time these containers experience an "initial start" is during a new deployment or if a container crashes and restarts. This startup time depends solely on your application's bootstrap logic and image size, not on Azure scaling.

## 2. What is Slowing Down the Website?

If the website is not "instant," the problem is not cold starts. Instead, it is caused by severe resource constraints and an inability to scale under load.

Here are the critical issues identified in your configuration:

### A. Hard Capped Scaling (`maxReplicas: 1`)
- **Configuration**: Every single service has `maxReplicas` set to `1`. 
- **Impact**: Your applications are strictly limited to exactly one container instance. If multiple users hit your website at the same time, that single container must handle all the concurrent requests. This leads to heavy queuing and latency, preventing the website from feeling "instant".

### B. Missing Scale Rules
- **Configuration**: The `rules` property is `null` for all services.
- **Impact**: Even if you increased `maxReplicas`, Azure Container Apps wouldn't know *when* or *why* to scale up (e.g., based on HTTP concurrent requests or CPU usage) because there are no KEDA scaling rules defined.

### C. Extremely Low Resource Allocation
- **Configuration**: All services are allocated exactly **0.5 vCPU** and **1Gi Memory**.
- **Impact**: 
  - **Databases (`postgres`, `redis`, `rabbitmq`)**: Running a relational database or a message broker on half a CPU is a major bottleneck. Under load, query execution and message passing will queue up, causing a chain reaction of slowness across all services that depend on them.
  - **Microservices (`api-gateway`, `auth-service`, `client`, etc.)**: Node.js/web applications running on 0.5 CPU can quickly become CPU-bound during intensive operations, resulting in slow HTTP responses.

## Summary & Recommendations

Your current architecture is configured like a constrained development environment rather than a production environment. To make your website feel instant and responsive:

1. **Increase Resources for Infrastructure**: Give your `postgres`, `redis`, and `rabbitmq` containers significantly more resources (e.g., 1.5 - 2.0 vCPU and 2-4Gi memory). Databases need breathing room.
2. **Allow Horizontal Scaling**: Increase `maxReplicas` (e.g., to 5 or 10) for your stateless microservices (like `api-gateway`, `client`, and the API services).
3. **Define Scale Rules**: Implement HTTP scaling rules (e.g., scale out when concurrent requests per instance exceed 10 or 20) so that Azure Container Apps actually provisions those extra replicas when traffic spikes. 

**Conclusion**: The lack of cold starts is good for initial response times, but the combination of `maxReplicas: 1` and `0.5 vCPU` means your single instances are likely choking under load, which is the primary reason the website doesn't feel instant.
