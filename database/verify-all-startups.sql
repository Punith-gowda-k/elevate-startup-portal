-- Apply the missing schema changes to the live database.
ALTER TABLE eligibility
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE eligibility
  DROP CONSTRAINT IF EXISTS eligibility_status_check;

ALTER TABLE eligibility
  ADD CONSTRAINT eligibility_status_check
  CHECK (status IN ('Pending', 'Verified', 'Rejected'));

-- Mark every existing startup as Verified.
-- 1) Ensure users with no eligibility record get a complete, constraint-valid record.
INSERT INTO eligibility (
  user_id,
  registration_state,
  entity_type,
  turnover,
  incorporation_date,
  innovation_idea,
  status,
  verified_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  'Karnataka',
  'Private Limited',
  5000000.00,
  DATE '2023-01-15',
  'Backfilled by GM bulk verification for historical startup records.',
  'Verified',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
LEFT JOIN eligibility e ON e.user_id = u.id
WHERE e.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2) Flip any remaining Pending/Rejected records to Verified.
UPDATE eligibility
SET status = 'Verified',
    verified_at = CURRENT_TIMESTAMP,
    rejected_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE status <> 'Verified';
