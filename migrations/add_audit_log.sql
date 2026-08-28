-- Migration: Add system-wide audit log
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run: CREATE TABLE IF NOT EXISTS is idempotent.
--
-- Records every create/update/delete(archive) across Employees, Interns,
-- Recruitment Candidates, and User Accounts -- who did it, exactly what
-- changed (old value -> new value per field), and when. Feeds the
-- "History" page in the app. This table is append-only from the app's
-- side (nothing here is ever edited or deleted by normal use).

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('employee', 'intern', 'candidate', 'user')),
  entity_id     BIGINT NOT NULL,
  entity_label  TEXT,                 -- human-readable name at the time of the action, e.g. "Dela Cruz, Juan" -- kept even if the record is later archived/changed further
  action        TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore')),
  changes       JSONB,                -- for 'update': [{ field, old_value, new_value }, ...]; null for create/archive/restore
  performed_by  INTEGER REFERENCES users(id),
  performed_by_name TEXT,             -- snapshot of the actor's name/username at the time, so history reads correctly even if that account is later archived/renamed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Verify: SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20;
