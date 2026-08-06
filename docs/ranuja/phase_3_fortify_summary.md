# Duothan 6.0 - Phase 03: FORTIFY

## 01. Context: From Reality to Resilience
- **The Scenario**: A global cyber disaster in 2065 caused by the "Super Malware Agent" has devastated global systems, bringing the financial sector to a standstill.
- **The Current State**: The "Master Key" has been recovered, and the banking platform was rebuilt in Phase 2. Customer data is safe, and the architecture holds, but it currently only exists in a repository.
- **The Mission**: Save the digital banking system by moving the rebuilt platform out of the repository and deploying it to the cloud. It must operate as reliable, independent services that the world can depend on.
- **Resilience**: The platform must survive real traffic, real failures, and real attackers. Releases must be repeatable, environments reproducible, secrets protected, and incidents visible long before customers notice.

## 02. Brief: Phase Overview
In Phase 3 (Restore), teams transition from a working application to a live production system.
- **Cloud Deployment**: Deploy the banking platform built in Phase 2 onto a cloud environment as independent services.
- **Automation**: Build automation around the platform to ensure every release is repeatable, verifiable, and safe.
- **Consistency**: The deployed solution must remain consistent with the Phase 1 architecture and Phase 2 functionality.
- **Key Expectations**:
  - The platform behaves consistently regardless of where it runs.
  - Recovers from failures automatically (no manual intervention).
  - Remains available as demand fluctuates.
  - Allows for confident and repeated update releases.
  - Maintains operational visibility (understand system state at any moment).
  - Embeds security and engineering discipline throughout the delivery process, rather than just at the end.
  - Risks must be identified before release, and sensitive information protected at all stages.

## 03. Submission: Final Deliverables
At the end of Phase 3, teams must submit the following via `duothan.ieeensbm.org/submission`:
1. **Public GitHub Repository Link**: Must contain application code, infrastructure definitions, and pipeline configuration.
2. **Live Deployed Application URL or IP Address**: The application must be reachable and functional before submission.
3. **Brief Deployment Documentation with Screenshots**.

## 04. Evaluation: Mark Allocation
The evaluation criteria and their weightings are as follows:
- **Build & Release Automation**: 20%
- **Service Deployment & Environment Consistency**: 15%
- **Automated Infrastructure & Configuration Management**: 15%
- **Operational Visibility & System Health**: 15%
- **Security Practices & Protection of Sensitive Data**: 15%
- **Scalability, Availability & Reliability**: 10%
- **Engineering Best Practices**: 5%
- **Team Contributions**: 5%
*(Note: Weightings may be adjusted by the judging panel based on execution depth.)*

## Goal by the End of Phase 3
Your team should have a digital banking platform running in production, released, and operated entirely through automation. The platform rebuilt during REBUILD goes live during RESTORE.

**Deploy it. Automate it. Keep it running.**
