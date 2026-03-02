-- ─── AgilesTest Database Initialization ───────────────────────────────────────
-- This script runs automatically when PostgreSQL container starts
-- It creates the necessary tables and seeds initial data

-- ─── Users Table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'VIEWER')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Projects Table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  domain VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Executions Table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  profile_id UUID,
  scenario_id UUID,
  status VARCHAR(50) DEFAULT 'PENDING',
  runner_type VARCHAR(50),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  duration_ms INTEGER,
  artifacts_count INTEGER DEFAULT 0,
  incidents_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Artifacts Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id),
  type VARCHAR(50) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  storage_path VARCHAR(500),
  s3_uri VARCHAR(500),
  checksum VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Incidents Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50) CHECK (severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'INFO')),
  step_name VARCHAR(255),
  expected_result TEXT,
  actual_result TEXT,
  detected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Reports Table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES executions(id),
  project_id UUID REFERENCES projects(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  status VARCHAR(50) DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Seed Initial Data ────────────────────────────────────────────────────────
-- Admin user (password: admin123 - bcrypt hash)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@agilestest.io',
  '$2b$10$YourBcryptHashForAdmin123HereChangeInProduction',
  'Administrator',
  'ADMIN',
  true
) ON CONFLICT (email) DO NOTHING;

-- Manager user (password: manager123)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'manager@agilestest.io',
  '$2b$10$YourBcryptHashForManager123HereChangeInProduction',
  'Project Manager',
  'MANAGER',
  true
) ON CONFLICT (email) DO NOTHING;

-- Viewer user (password: viewer123)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'viewer@agilestest.io',
  '$2b$10$YourBcryptHashForViewer123HereChangeInProduction',
  'Test Viewer',
  'VIEWER',
  true
) ON CONFLICT (email) DO NOTHING;

-- ─── Create Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_executions_project_id ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_execution_id ON artifacts(execution_id);
CREATE INDEX IF NOT EXISTS idx_incidents_execution_id ON incidents(execution_id);
CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_execution_id ON reports(execution_id);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);

-- ─── Grant permissions ────────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agilestest;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agilestest;
