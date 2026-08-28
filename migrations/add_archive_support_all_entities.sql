-- Migration: Add archive support to Employees, Interns, and Recruitment
-- Candidates (Users already got this in add_user_archive.sql).
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
--
-- This system never hard-deletes records. The "Delete" button on
-- Employees, Interns, and Recruitment Candidates now archives instead:
-- is_archived = true, the record disappears from the default list view,
-- and the row itself -- along with everything that references it
-- (disciplinary memos for an employee, etc.) -- is left completely
-- intact. A super_admin can look up archived records on the History
-- page and restore one (is_archived = false) if it was archived by
-- mistake.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by  INTEGER REFERENCES users(id);

ALTER TABLE interns
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by  INTEGER REFERENCES users(id);

ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS is_archived  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by  INTEGER REFERENCES users(id);

-- Verify:
-- SELECT id, emp_id, is_archived, archived_at FROM employees WHERE is_archived = true;
-- SELECT id, first_name, last_name, is_archived, archived_at FROM interns WHERE is_archived = true;
-- SELECT id, candidate_name, is_archived, archived_at FROM recruitment_candidates WHERE is_archived = true;
