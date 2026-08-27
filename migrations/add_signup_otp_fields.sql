-- Migration: Add self-serve signup + OTP email verification support
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.
--
-- Adds an email column (separate from username -- username can stay
-- whatever it already is for existing accounts) plus short-lived OTP
-- storage used only during the signup flow. otp_code is cleared once
-- verified or once a fresh code is requested, so it never lingers as a
-- standing secret on the row.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify: SELECT id, username, email, email_verified, is_active FROM users;
