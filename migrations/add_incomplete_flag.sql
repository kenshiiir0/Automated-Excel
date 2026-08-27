-- Migration: Add data-completeness flag to employees
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
--
-- Background: the source Excel workbook has a "VALID ROW" helper column
-- that HR's own dashboard formulas rely on. It was being used to decide
-- which rows counted as real employees during import -- but that helper
-- flags a row invalid the moment ANY field it checks is blank, even when
-- the row clearly names a real person. That silently dropped 14 real
-- employees who are missing something (usually department or hire date)
-- from the system entirely.
--
-- Fixed: every named person is now imported, and rows missing a core
-- field (emp_id, first_name, last_name, department, position, hire_date)
-- are flagged here instead of being dropped, so HR can see and fix the
-- gaps rather than the person just vanishing from the list.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_incomplete  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS missing_fields TEXT;

-- Verify: SELECT column_name, data_type FROM information_schema.columns
--         WHERE table_name = 'employees' ORDER BY ordinal_position;
