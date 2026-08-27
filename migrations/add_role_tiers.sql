-- Migration: Add real role tiers (super_admin / admin / user)
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.
--
-- Until now `role` was a free-text column that only ever held 'admin' --
-- nothing in the app actually checked it. This promotes the sample
-- account (sample@getmeds.ph) to 'super_admin' and locks the column to
-- the three real tiers going forward: super_admin (full access, can
-- manage other accounts' roles), admin (full access to HR data, cannot
-- manage accounts), user (read-only, cannot see salary/gov-ID/bank data).

UPDATE users SET role = 'super_admin' WHERE email = 'sample@getmeds.ph';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'user'));

-- Verify: SELECT id, username, email, role FROM users ORDER BY role;
