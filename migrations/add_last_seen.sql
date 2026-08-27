-- Migration: Add last_seen_at for an approximate "currently online" status
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.
--
-- Distinct from last_login_at (stamped once, at login time). last_seen_at
-- is refreshed on any authenticated API call, throttled server-side to at
-- most once a minute per account, so it stays cheap even with lots of
-- traffic. Manage Users treats anyone seen within the last ~15 minutes as
-- "Online" -- this is an approximation (there's no live session list with
-- stateless JWTs), not a real-time presence indicator.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
