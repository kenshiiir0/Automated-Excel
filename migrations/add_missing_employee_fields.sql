-- Migration: Add missing employee fields
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS new_designation            TEXT,
  ADD COLUMN IF NOT EXISTS relationship               TEXT,
  ADD COLUMN IF NOT EXISTS company_issued_no          TEXT,
  ADD COLUMN IF NOT EXISTS issued_equipment           TEXT,
  ADD COLUMN IF NOT EXISTS job_description            TEXT,
  ADD COLUMN IF NOT EXISTS company_rules              TEXT,
  ADD COLUMN IF NOT EXISTS employment_contract_status TEXT;

-- Verify: SELECT column_name, data_type FROM information_schema.columns
--         WHERE table_name = 'employees' ORDER BY ordinal_position;
