-- Migration: Add phone number to user accounts
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.
--
-- This is a personal contact number on the LOGIN account itself, separate
-- from an employee's work phone in the Employees table (which may belong
-- to a different person's account, or not exist at all for this login).

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Verify: SELECT id, username, email, phone FROM users;
