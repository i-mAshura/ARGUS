-- Create spyderxdr database and tables
-- Note: In PostgreSQL, database creation is typically done before connecting.
-- If running manually: CREATE DATABASE spyderxdr;

-- Drop existing tables (for fresh install)
DROP TABLE IF EXISTS usage_metrics CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS tenant_users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS threat_intelligence CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS baselines CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Organizations / Tenants
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    website VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    status VARCHAR(50) DEFAULT 'trial',
    max_endpoints INT DEFAULT 50,
    current_endpoints INT DEFAULT 0,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'dark',
    features JSONB DEFAULT '{}',
    integrations_enabled JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Users within organization
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'viewer',
    permissions JSONB DEFAULT '{}',
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Usage Metrics
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    events_processed INT DEFAULT 0,
    alerts_generated INT DEFAULT 0,
    endpoints_connected INT DEFAULT 0,
    storage_used_gb INT DEFAULT 0,
    api_calls INT DEFAULT 0,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    month VARCHAR(7)
);

-- Agents table
CREATE TABLE agents (
    id VARCHAR(255) PRIMARY KEY,
    hostname VARCHAR(255),
    os_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'offline',
    version VARCHAR(50),
    ip_address VARCHAR(45),
    last_checkin TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    events_processed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id VARCHAR(36) PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    source_ip VARCHAR(45),
    destination_ip VARCHAR(45),
    hostname VARCHAR(255),
    agent_id VARCHAR(255),
    event_type VARCHAR(100),
    event_data JSONB,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rules table
CREATE TABLE rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    rule_type VARCHAR(50),
    is_enabled BOOLEAN DEFAULT true,
    severity VARCHAR(50),
    conditions JSONB,
    actions JSON,
    mitre_tactics JSON,
    mitre_techniques JSON,
    threshold INT,
    time_window INT,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE alerts (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    severity VARCHAR(50),
    status VARCHAR(50),
    source_event_ids JSON,
    rule_id VARCHAR(36) REFERENCES rules(id),
    detection_type VARCHAR(100),
    indicators JSONB,
    mitre_tactics JSON,
    mitre_techniques JSON,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    occurrences INT DEFAULT 1,
    hostname VARCHAR(255),
    "user" VARCHAR(255),
    assigned_to VARCHAR(255),
    notes JSON,
    artifacts JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Response actions table
CREATE TABLE responses (
    id VARCHAR(36) PRIMARY KEY,
    alert_id VARCHAR(36) REFERENCES alerts(id) ON DELETE CASCADE,
    action_type VARCHAR(100),
    target VARCHAR(500),
    status VARCHAR(50),
    result JSONB,
    executed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Threat Intelligence table
CREATE TABLE threat_intelligence (
    id VARCHAR(36) PRIMARY KEY,
    indicator_type VARCHAR(50),
    indicator_value VARCHAR(500),
    threat_type VARCHAR(100),
    severity VARCHAR(50),
    source VARCHAR(255),
    confidence DECIMAL(3,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Baselines table
CREATE TABLE baselines (
    id VARCHAR(36) PRIMARY KEY,
    hostname VARCHAR(255),
    username VARCHAR(255),
    behavior_type VARCHAR(100),
    baseline_data JSONB,
    learned_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_hostname_timestamp ON events(hostname, timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type);

CREATE INDEX idx_alerts_severity_status ON alerts(severity, status);
CREATE INDEX idx_alerts_hostname_created ON alerts(hostname, created_at DESC);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);

CREATE INDEX idx_rules_rule_type_enabled ON rules(rule_type, is_enabled);
CREATE INDEX idx_rules_enabled ON rules(is_enabled);

CREATE INDEX idx_threat_intel_indicator_value ON threat_intelligence(indicator_value);
CREATE INDEX idx_baselines_hostname_behavior ON baselines(hostname, behavior_type);
CREATE INDEX idx_agents_os_status ON agents(os_type, status);
