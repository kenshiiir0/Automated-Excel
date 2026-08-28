-- Migration: store prior_warning_note on disciplinary_memos so a Final
-- Written Warning can be re-downloaded from History later with its
-- "prior warning" reference line intact, not just its other fields.
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.

ALTER TABLE disciplinary_memos
  ADD COLUMN IF NOT EXISTS prior_warning_note TEXT;
