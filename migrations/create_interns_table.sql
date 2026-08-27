-- Migration: Create interns table (Intern Masterfile sheet)
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.

CREATE TABLE IF NOT EXISTS interns (
  id              BIGSERIAL PRIMARY KEY,
  seq_no          TEXT UNIQUE,
  last_name       TEXT,
  first_name      TEXT,
  middle_name     TEXT,
  middle_initial  TEXT,
  complete_name   TEXT,
  hire_date       DATE,
  birthday        DATE,
  address         TEXT,
  contact_no      TEXT,
  email           TEXT,
  school          TEXT,
  department      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Verify: SELECT column_name, data_type FROM information_schema.columns
--         WHERE table_name = 'interns' ORDER BY ordinal_position;
