-- Migration: Disciplinary memos (NTE / Written Warning / Final Written
-- Warning) -- generated documents, review-before-send workflow, and a
-- log of what's been issued per employee.
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS disciplinary_memos (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT REFERENCES employees(id),
    memo_type           TEXT NOT NULL CHECK (memo_type IN ('NTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING')),
    rule_text           TEXT NOT NULL,
    incident_date       TEXT,
    incident_time       TEXT,
    incident_facts      TEXT,        -- the short bullet facts HR typed in
    incident_narrative  TEXT,        -- the AI-drafted / HR-edited final paragraph(s)
    memo_date           TEXT,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
    sent_at             TIMESTAMPTZ,
    sent_by             INTEGER REFERENCES users(id),
    sent_to_email       TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_memos_employee ON disciplinary_memos(employee_id);
