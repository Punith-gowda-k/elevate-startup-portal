-- ============================================================
--  Admin Portal schema
--  Run this ONCE against the ksfp_portal database:
--    psql "$DATABASE_URL" -f database/admin_schema.sql
--  Roles, permissions and a default admin are auto-seeded by
--  the backend on startup (see seedAdminData() in server.js).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Roles & permissions (RBAC) ----------
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------- Extend existing users table ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ---------- Admin accounts ----------
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  password_salt VARCHAR(32) NOT NULL,
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Activity / audit logs ----------
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(20) NOT NULL,        -- 'admin' | 'gm' | 'founder' | 'system'
  actor_id UUID,
  actor_email VARCHAR(254),
  action VARCHAR(100) NOT NULL,           -- e.g. 'user.created', 'account.deactivated'
  target_type VARCHAR(50),
  target_id UUID,
  details TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx
  ON activity_logs (created_at DESC);

-- ---------- Dynamic form builder ----------
CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key VARCHAR(60) NOT NULL UNIQUE,   -- e.g. 'startup_onboarding'
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  field_name VARCHAR(80) NOT NULL,        -- data key, e.g. 'gstNumber'
  label VARCHAR(160) NOT NULL,
  field_type VARCHAR(30) NOT NULL
    CHECK (field_type IN ('text','email','tel','number','date','textarea','select','checkbox')),
  placeholder VARCHAR(255),
  help_text VARCHAR(255),
  section VARCHAR(120),
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB,                          -- [{"label":"Yes","value":"yes"}] for select
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (form_id, field_name)
);
CREATE INDEX IF NOT EXISTS form_fields_form_idx
  ON form_fields (form_id, sort_order);
