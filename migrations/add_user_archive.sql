-- Migration: Add archive support for user accounts
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
--
-- This system never hard-deletes records. "Delete" in Manage Users archives
-- the account instead: is_archived = true, login is blocked (the existing
-- is_active check in authController.js already covers this once archiving
-- also sets is_active = false), the account disappears from the default
-- Manage Users list, and the row itself -- along with every disciplinary
-- memo or Zoho connection that references it -- is left completely intact.
-- A super_admin can always look up archived accounts separately and
-- restore one (is_archived = false) if it was archived by mistake.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by  INTEGER REFERENCES users(id);

-- Verify: SELECT id, username, full_name, role, is_active, is_archived, archived_at FROM users;
