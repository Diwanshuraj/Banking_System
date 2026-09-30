-- =============================================================================
-- Bharat National Bank - MySQL setup
-- =============================================================================
-- Tables are created and updated automatically by Hibernate from the entity
-- classes in backend/src/main/java/com/banking/model (spring.jpa.hibernate.ddl-auto=update),
-- and demo data is inserted by DataSeeder on first start with real BCrypt hashes.
--
-- The JDBC URL already uses createDatabaseIfNotExist=true, so this script is only
-- needed if your MySQL user can't create databases.
--
-- Upgrading from the old hand-written schema? Its tables use different columns and
-- enum values. Drop the old database once so the app can recreate it:
--   DROP DATABASE banking_db;

CREATE DATABASE IF NOT EXISTS banking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
