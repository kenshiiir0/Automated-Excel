-- Migration: Create users table for real authentication
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.
--
-- This replaces the "no login at all" state the system has been running in.
-- password_hash stores a bcrypt hash -- never a plain-text password, here or
-- anywhere else. role is a simple text field for now ("admin" is the only
-- value seeded below); it's there so per-person access levels can be added
-- later without a schema change, even though everyone is "admin" today.

CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT,
  role           TEXT NOT NULL DEFAULT 'admin',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);

-- Verify: SELECT id, username, full_name, role, is_active FROM users;
