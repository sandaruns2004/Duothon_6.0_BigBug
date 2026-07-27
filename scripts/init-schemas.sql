-- ═══════════════════════════════════════════════════════════════════
-- AegisVault Database Initialization
-- Creates 5 isolated PostgreSQL schemas for the 5 microservices
-- ═══════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS auth_db;
CREATE SCHEMA IF NOT EXISTS acct_db;
CREATE SCHEMA IF NOT EXISTS txn_db;
CREATE SCHEMA IF NOT EXISTS notif_db;
CREATE SCHEMA IF NOT EXISTS admin_db;

-- Grant permissions on schemas to aegis_admin
GRANT ALL ON SCHEMA auth_db TO aegis_admin;
GRANT ALL ON SCHEMA acct_db TO aegis_admin;
GRANT ALL ON SCHEMA txn_db TO aegis_admin;
GRANT ALL ON SCHEMA notif_db TO aegis_admin;
GRANT ALL ON SCHEMA admin_db TO aegis_admin;
