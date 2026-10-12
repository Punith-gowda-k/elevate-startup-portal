CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_name VARCHAR(120) NOT NULL,
  founder_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  cin CHAR(21) UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  password_salt VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
  ALTER COLUMN cin DROP NOT NULL;

CREATE TABLE IF NOT EXISTS eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  registration_state VARCHAR(40) NOT NULL CHECK (registration_state IN ('Karnataka', 'Other State')),
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('Private Limited', 'OPC', 'LLP', 'Partnership', 'Other')),
  turnover NUMERIC(15,2) NOT NULL CHECK (turnover >= 0),
  incorporation_date DATE NOT NULL,
  innovation_idea TEXT NOT NULL CHECK (char_length(innovation_idea) BETWEEN 20 AND 5000),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
  rejected_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('Utilization', 'Fund Disbursement')),
  description VARCHAR(250) NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'Recorded' CHECK (status IN ('Recorded', 'Approved', 'Credited', 'Rejected')),
  proof_file_name VARCHAR(255),
  proof_mime_type VARCHAR(100),
  proof_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS transactions_user_id_created_at_idx
  ON transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date);
