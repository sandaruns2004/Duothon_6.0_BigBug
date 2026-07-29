#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════
 * AegisVault Digital Banking Platform — Demo Database Seed Script
 * Prepopulates Admin User, 2 Test Customers, Accounts, Transactions,
 * Fraud Alerts, and SHA-256 Audit Trail logs.
 * Usage: npm run seed:demo
 * ═══════════════════════════════════════════════════════════════════
 */

const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Automatically push schemas to ensure PostgreSQL tables exist before seeding
const syncDatabaseSchemas = () => {
  console.log('🔄 [0/4] Synchronizing Prisma database schemas with PostgreSQL...');
  const services = [
    { name: 'admin-service', schema: 'admin_db' },
    { name: 'account-service', schema: 'acct_db' },
    { name: 'transaction-service', schema: 'txn_db' },
    { name: 'notification-service', schema: 'notif_db' },
    { name: 'auth-service', schema: 'auth_db' }
  ];

  for (const svc of services) {
    const schemaPath = path.join(__dirname, '..', 'services', svc.name, 'prisma', 'schema.prisma');
    const baseDbUrl = process.env.DATABASE_URL || 'postgresql://aegis_admin:securep%40ss123@127.0.0.1:5432/aegisvault';
    const dbUrl = `${baseDbUrl.split('?')[0]}?schema=${svc.schema}`;
    try {
      console.log(`   -> Syncing schema for ${svc.name} (${svc.schema})...`);
      execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss`, {
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'inherit'
      });
    } catch (err) {
      console.error(`   ⚠️ Failed to sync ${svc.name}:`, err.message);
    }
  }
};

// Helper to safely load Prisma clients from microservices
const loadPrisma = (servicePath) => {
  try {
    const dbModule = require(path.join(__dirname, '..', servicePath, 'src/config/db'));
    return dbModule.prisma;
  } catch (err) {
    console.error(`❌ Could not load Prisma client for ${servicePath}:`, err.message);
    return null;
  }
};

const authPrisma = loadPrisma('services/auth-service');
const accountPrisma = loadPrisma('services/account-service');
const txnPrisma = loadPrisma('services/transaction-service');
const notifPrisma = loadPrisma('services/notification-service');

const hashPassword = async (pwd) => {
  return await bcrypt.hash(pwd, 12);
};

const runSeed = async () => {
  console.log('🚀 [AegisVault Seed] Starting database prepopulation for Demo Environment...');
  syncDatabaseSchemas();

  if (!authPrisma || !accountPrisma || !txnPrisma || !notifPrisma) {
    console.warn('⚠️ One or more Prisma clients could not be loaded. Ensure `npm install` and `prisma generate` were run in all services.');
    console.log('💡 Tip: When running via Docker Compose, seed scripts execute inside the containers or when database connections are active.');
    return;
  }

  try {
    // 1. Create Admin User
    console.log('🔐 [1/4] Creating Admin User...');
    const adminPasswordHash = await hashPassword('AdminSecure2026!');
    const adminUser = await authPrisma.user.upsert({
      where: { email: 'admin@aegisvault.com' },
      update: {},
      create: {
        id: 'usr-admin-demo-001',
        email: 'admin@aegisvault.com',
        phone: '+94710000000',
        nic: '200000000000',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        kycStatus: 'VERIFIED',
        failedAttempts: 0,
        isLocked: false,
      },
    });
    console.log(`  ✅ Admin ready: ${adminUser.email} (Role: ADMIN)`);

    // 2. Create 2 Test Customers & Banking Accounts
    console.log('👤 [2/4] Creating 2 Test Customer Accounts...');
    const customerPasswordHash = await hashPassword('CustomerSecure2026!');
    
    // Customer 1: Sandaru (Savings Account - 1,500,000 LKR)
    const cust1 = await authPrisma.user.upsert({
      where: { email: 'customer1@aegisvault.com' },
      update: {},
      create: {
        id: 'usr-cust-demo-001',
        email: 'customer1@aegisvault.com',
        phone: '+94770001001',
        nic: '199512345678',
        passwordHash: customerPasswordHash,
        role: 'CUSTOMER',
        kycStatus: 'VERIFIED',
      },
    });

    const acct1 = await accountPrisma.account.upsert({
      where: { accountNumber: '810000000001' },
      update: { balance: 1500000.00 },
      create: {
        id: 'acct-demo-001',
        userId: cust1.id,
        accountNumber: '810000000001',
        accountType: 'SAVINGS',
        balance: 1500000.00,
        currency: 'LKR',
        status: 'ACTIVE',
      },
    });
    console.log(`  ✅ Customer 1 ready: ${cust1.email} -> Acct #${acct1.accountNumber} (1,500,000.00 LKR)`);

    // Customer 2: Kasun (Current Account - 750,000 LKR)
    const cust2 = await authPrisma.user.upsert({
      where: { email: 'customer2@aegisvault.com' },
      update: {},
      create: {
        id: 'usr-cust-demo-002',
        email: 'customer2@aegisvault.com',
        phone: '+94770001002',
        nic: '199812345679',
        passwordHash: customerPasswordHash,
        role: 'CUSTOMER',
        kycStatus: 'VERIFIED',
      },
    });

    const acct2 = await accountPrisma.account.upsert({
      where: { accountNumber: '810000000002' },
      update: { balance: 750000.00 },
      create: {
        id: 'acct-demo-002',
        userId: cust2.id,
        accountNumber: '810000000002',
        accountType: 'CURRENT',
        balance: 750000.00,
        currency: 'LKR',
        status: 'ACTIVE',
      },
    });
    console.log(`  ✅ Customer 2 ready: ${cust2.email} -> Acct #${acct2.accountNumber} (750,000.00 LKR)`);

    // 3. Create Sample Transactions & Rule-Based Fraud Alert
    console.log('💸 [3/4] Seeding Sample Transactions and Fraud Guard Flags...');
    const txn1 = await txnPrisma.transaction.upsert({
      where: { referenceNumber: 'TXN-DEMO-2026-001' },
      update: {},
      create: {
        id: 'txn-demo-001',
        fromAccountId: acct1.accountNumber,
        toAccountId: acct2.accountNumber,
        amount: 50000.00,
        currency: 'LKR',
        type: 'TRANSFER',
        status: 'SUCCESS',
        referenceNumber: 'TXN-DEMO-2026-001',
        fraudFlag: false,
        description: 'Monthly office rent settlement',
      },
    });

    const txn2 = await txnPrisma.transaction.upsert({
      where: { referenceNumber: 'TXN-DEMO-2026-002-FRAUD' },
      update: {},
      create: {
        id: 'txn-demo-002-fraud',
        fromAccountId: acct1.accountNumber,
        toAccountId: '810099999999',
        amount: 650000.00,
        currency: 'LKR',
        type: 'TRANSFER',
        status: 'SUCCESS',
        referenceNumber: 'TXN-DEMO-2026-002-FRAUD',
        fraudFlag: true,
        description: 'High value wire remittance to external vendor',
      },
    });

    await txnPrisma.fraudAlert.upsert({
      where: { id: 'alert-demo-001' },
      update: {},
      create: {
        id: 'alert-demo-001',
        transactionId: txn2.id,
        ruleTriggered: 'HIGH_AMOUNT_THRESHOLD (> 500,000 LKR)',
        riskScore: 85,
        status: 'FLAGGED',
      },
    });
    console.log(`  ✅ Transactions seeded (1 Normal, 1 High-Value Flagged by Rule-Based Guard)`);

    // 4. Create Cryptographic Audit Trail Record
    console.log('📜 [4/4] Prepopulating Cryptographic SHA-256 Audit Trail...');
    const genesisHash = crypto.createHash('sha256').update('GENESIS_LOG_AEGISVAULT_2026').digest('hex');
    const firstLogHash = crypto.createHash('sha256').update(`${genesisHash}_SEED_DEMO_${Date.now()}`).digest('hex');
    await notifPrisma.auditLog.upsert({
      where: { id: 'audit-demo-001' },
      update: {},
      create: {
        id: 'audit-demo-001',
        userId: adminUser.id,
        action: 'SYSTEM_GENESIS_SEED',
        resource: 'DATABASE_SEEDER',
        resourceId: 'demo-env-v1',
        ipAddress: '127.0.0.1',
        details: 'Prepopulated demo admin, customers, accounts, and fraud flags.',
        previousHash: genesisHash,
        hash: firstLogHash,
      },
    });
    console.log(`  ✅ SHA-256 Audit Chain initialized (Genesis Hash: ${genesisHash.substring(0, 12)}...)`);

    console.log('\n🎉 [SUCCESS] Demo Environment Prepopulation Completed Successfully!');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log('👉 Admin Creds:      admin@aegisvault.com      / AdminSecure2026!');
    console.log('👉 Customer 1 Creds: customer1@aegisvault.com  / CustomerSecure2026!');
    console.log('👉 Customer 2 Creds: customer2@aegisvault.com  / CustomerSecure2026!');
    console.log('───────────────────────────────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Database seed encountered an error:', error);
  }
};

runSeed();
