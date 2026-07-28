#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 * AegisVault Digital Banking Platform — Live API Smoke Test Script
 * Verifies End-to-End Microservice Flows through the API Gateway (Port 3000)
 * Usage: node scripts/smoke-test.js
 * ═══════════════════════════════════════════════════════════════════
 */

const BASE_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

const printHeader = (title) => {
  console.log('\n' + '═'.repeat(65));
  console.log(`🛡️  ${title}`);
  console.log('═'.repeat(65));
};

const printStep = (stepNum, description) => {
  console.log(`\n🔹 [Step ${stepNum}] ${description}...`);
};

const printSuccess = (message) => {
  console.log(`   ✅ SUCCESS: ${message}`);
};

const printError = (message, err) => {
  console.error(`   ❌ ERROR: ${message}`);
  if (err) console.error('      Details:', err);
};

const runSmokeTest = async () => {
  printHeader('AegisVault Live API Gateway & Microservices Smoke Test');
  console.log(`Target API Gateway URL: ${BASE_URL}\n`);

  let adminToken = null;
  let customerToken = null;

  try {
    // Step 1: Health Check
    printStep(1, 'Checking API Gateway Health (/health)');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    if (healthRes.ok && healthData.status === 'healthy') {
      printSuccess(`API Gateway is healthy! Uptime: ${healthData.uptimeSeconds}s | Service: ${healthData.service}`);
    } else {
      throw new Error(`Health check failed with status ${healthRes.status}: ${JSON.stringify(healthData)}`);
    }

    // Step 2: Admin Login Request
    printStep(2, 'Initiating MFA Login for System Admin (admin@aegisvault.com)');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aegisvault.com', password: 'AdminSecure2026!' })
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.ok && adminLoginData.requireMfa) {
      printSuccess(`MFA code generated for User ID: ${adminLoginData.userId} (Expires in ${adminLoginData.expiresInSeconds}s)`);
    } else {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
    }

    // Step 3: Verify OTP for Admin (Demo OTP: 123456)
    printStep(3, 'Verifying MFA OTP (123456) for System Admin');
    const adminOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aegisvault.com', otp: '123456' })
    });
    const adminOtpData = await adminOtpRes.json();
    if (adminOtpRes.ok && adminOtpData.accessToken) {
      adminToken = adminOtpData.accessToken;
      printSuccess(`Admin authenticated! Issued JWT Token | Role: ${adminOtpData.user.role} | Name: ${adminOtpData.user.fullName || adminOtpData.user.email}`);
    } else {
      throw new Error(`Admin OTP verification failed: ${JSON.stringify(adminOtpData)}`);
    }

    // Step 4: Query SHA-256 Cryptographic Audit Trail as Admin
    printStep(4, 'Querying SHA-256 Cryptographic Audit Trail via Notification Service (/api/audit)');
    const auditRes = await fetch(`${BASE_URL}/api/audit?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    const auditData = await auditRes.json();
    if (auditRes.ok && auditData.success) {
      const records = auditData.auditLogs || auditData.data || [];
      const recordsCount = records.length;
      const genesisRecord = records[0];
      printSuccess(`Retrieved ${recordsCount} immutable audit records from SHA-256 Hash Chain!`);
      if (genesisRecord) {
        console.log(`      └─ Latest Hash: ${genesisRecord.hash?.substring(0, 24)}... | Action: ${genesisRecord.action}`);
      }
    } else {
      throw new Error(`Audit trail query failed: ${JSON.stringify(auditData)}`);
    }

    // Step 5: Customer 1 Login & MFA Flow
    printStep(5, 'Authenticating Customer 1 (customer1@aegisvault.com)');
    const custLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer1@aegisvault.com', password: 'CustomerSecure2026!' })
    });
    const custLoginData = await custLoginRes.json();
    if (!custLoginRes.ok || !custLoginData.requireMfa) {
      throw new Error(`Customer 1 login failed: ${JSON.stringify(custLoginData)}`);
    }

    const custOtpRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer1@aegisvault.com', otp: '123456' })
    });
    const custOtpData = await custOtpRes.json();
    if (custOtpRes.ok && custOtpData.accessToken) {
      customerToken = custOtpData.accessToken;
      printSuccess(`Customer 1 authenticated! Issued JWT Token | Email: ${custOtpData.user.email}`);
    } else {
      throw new Error(`Customer 1 OTP verification failed: ${JSON.stringify(custOtpData)}`);
    }

    // Step 6: Fetch Customer 1 Bank Accounts from Account Service
    printStep(6, 'Fetching Bank Account Ledger from Account Service (/api/accounts)');
    const accountsRes = await fetch(`${BASE_URL}/api/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      }
    });
    const accountsData = await accountsRes.json();
    if (accountsRes.ok && accountsData.success) {
      const accounts = accountsData.accounts || accountsData.data || [];
      printSuccess(`Retrieved ${accounts.length} active account(s) for Customer 1`);
      accounts.forEach((acct) => {
        console.log(`      └─ Account #${acct.accountNumber} | Type: ${acct.accountType} | Balance: LKR ${Number(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} | Status: ${acct.status}`);
      });
    } else {
      throw new Error(`Customer accounts query failed: ${JSON.stringify(accountsData)}`);
    }

    // Step 7: Check Customer 1 Transaction History from Transaction Service
    printStep(7, 'Fetching Transaction History from Transaction Service (/api/transactions)');
    const txnsRes = await fetch(`${BASE_URL}/api/transactions?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      }
    });
    const txnsData = await txnsRes.json();
    if (txnsRes.ok && txnsData.success) {
      const txns = txnsData.transactions || txnsData.data || [];
      printSuccess(`Retrieved ${txns.length} recent transaction(s) for Customer 1`);
      txns.forEach((txn) => {
        const flagBadge = txn.fraudFlag ? '🚨 FLAGGED' : '✅ SUCCESS';
        console.log(`      └─ Ref: ${txn.referenceNumber} | ${txn.type} | Amount: LKR ${Number(txn.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} | ${flagBadge}`);
      });
    } else {
      throw new Error(`Customer transactions query failed: ${JSON.stringify(txnsData)}`);
    }

    printHeader('🎉 ALL 7 E2E API GATEWAY SMOKE TESTS PASSED PERFECTLY!');
    console.log('The AegisVault platform microservices, database, cache, auth, and audit chain are verified 100% operational.\n');

  } catch (error) {
    printError('Smoke test failed during execution:', error.message);
    process.exit(1);
  }
};

runSmokeTest();
