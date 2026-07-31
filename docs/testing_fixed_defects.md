# 🧪 Defect Resolution Testing Guide

This guide provides step-by-step instructions on how to test the 4 fixed defects on your local machine and in your Azure cloud environment.

## 🛠️ Local Testing Setup

To test these changes locally, you will need to rebuild your Docker images and restart your containers to ensure the latest code changes are applied.

1. **Stop existing containers and rebuild:**
   ```bash
   docker compose down
   docker compose up --build -d
   ```
2. **Seed the database (if needed):**
   ```bash
   npm run seed:demo
   ```
3. **Wait for services to be ready.** Check `docker compose ps` to ensure all containers are healthy.

---

## ☁️ Cloud Testing Setup (Azure)

To test these changes in the cloud, you need to trigger your Continuous Deployment (CD) pipeline to build and push the updated images to your Azure Container Registry (ACR), and update the Azure Container Apps.

1. **Commit and Push:**
   Commit all the changes we made to your repository and push to the `main` or `master` branch.
   ```bash
   git add .
   git commit -m "fix: resolve critical deployment defects (1-4)"
   git push origin main
   ```
2. **Trigger GitHub Actions:**
   The push will automatically trigger the `Continuous Deployment` GitHub Actions workflow (`cd.yml`).
3. **Verify Pipeline:**
   Go to the **Actions** tab in your GitHub repository and wait for the workflow to complete. It will deploy the modified microservices and the newly added RabbitMQ broker to your Azure environment.

---

## 🔍 How to Verify Each Defect

### Defect 1: Admin Routing & Login Isolation
*Issue: Admins were redirected to the user dashboard.*

**Testing Steps:**
1. Navigate to the login page (`http://localhost:8080/login` or your cloud URL).
2. Login with admin credentials (`admin@aegisvault.com` / `AdminSecure2026!`).
3. Complete the OTP verification (use `123456`).
4. **Expected Result:** You should be automatically redirected to the **Admin Dashboard** (`/admin`), NOT the customer dashboard (`/dashboard`).
5. Now, login with customer credentials (`customer1@aegisvault.com`).
6. Try to manually navigate to `/admin` in the URL bar.
7. **Expected Result:** You should be forcefully redirected back to `/dashboard`.

### Defect 2: OTP & Email Services in Production
*Issue: The notification service always fell back to the mock `123456` OTP in production.*

**Cloud Testing Steps (Requires valid SMTP credentials):**
1. In your GitHub repository, ensure you have set valid `SMTP_USERNAME` and `SMTP_PASSWORD` secrets (e.g., from Mailtrap or SendGrid).
2. Wait for the CD pipeline to finish deploying.
3. Go to the live cloud URL and attempt to register a new user with a valid email address you can check.
4. Attempt to login with that user.
5. **Expected Result:** The system should actually dispatch an email to the provided address containing the real OTP code, rather than just printing it to the logs or accepting `123456`. (Note: The `123456` mock will still work on `localhost` unless you provide SMTP env vars in your `.env` file).

### Defect 3: KYC and Loan Auto-Verification
*Issue: KYC uploads and Loan applications were automatically set to `VERIFIED` and `APPROVED`.*

**Testing Steps:**
1. Login as a customer (e.g., `customer1@aegisvault.com`).
2. Go to the **Profile** page and upload a mock KYC document.
3. **Expected Result:** The UI should show the KYC status as `PENDING`.
4. Go to the **Payments/Loans** page and apply for a new loan.
5. **Expected Result:** The loan application should be submitted successfully, but its status should be `PENDING` (the funds will not be immediately added to your balance).
6. Log out, and log back in as an **Admin** (`admin@aegisvault.com`).
7. In the Admin Dashboard (`/admin`), go to the **Users** tab.
8. Find the customer who uploaded the KYC. Click **"View KYC"** to see the document reference, then click **"Verify"**.
9. Go to the newly added **Pending Loans** tab.
10. Find the pending loan application and click **"Approve"**.
11. **Expected Result:** The loan is approved, and if you check the customer's account balance, the loan principal amount will now be credited.

### Defect 4: RabbitMQ Not Deployed in Azure
*Issue: The message broker was missing from the Azure infrastructure, breaking async events.*

**Cloud Testing Steps:**
1. Wait for the CD pipeline to finish deploying.
2. In the Azure Portal, navigate to your Container Apps Environment.
3. **Expected Result:** You should see a new container app named `rabbitmq` running successfully.
4. Perform an action that triggers an asynchronous event (e.g., executing a fund transfer, which triggers a notification and an audit log).
5. **Expected Result:** The transaction should succeed without hanging or throwing 500 errors, and the corresponding audit logs should appear in the Admin Dashboard's **Cryptographic Audit Chain** tab.
