-- Migration: storage for the Zoho WorkDrive OAuth refresh token
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.
--
-- Zoho's OAuth flow issues a short-lived access token (~1 hour) plus a
-- long-lived refresh token. We only need ONE refresh token for the whole
-- app (one shared WorkDrive folder, connected once by a super_admin) --
-- not one per HR user -- so this is a single-row table, not per-user.
-- The access token itself is never stored; it's fetched fresh from the
-- refresh token on demand and kept in memory only (see lib/zohoWorkdrive.js).

CREATE TABLE IF NOT EXISTS zoho_workdrive_connection (
    id INTEGER PRIMARY KEY DEFAULT 1,
    refresh_token TEXT NOT NULL,
    connected_by INTEGER REFERENCES users(id),
    connected_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);
