-- ============================================================
-- CRX Viewer v2.1 Database Schema
-- PostgreSQL 17+
-- ============================================================

-- 扩展分析记录
CREATE TABLE IF NOT EXISTS extensions (
    id              TEXT PRIMARY KEY,          -- Chrome/Edge extension ID (32-char)
    name            TEXT NOT NULL,             -- Extension name
    version         TEXT,                      -- Latest analyzed version
    store           TEXT DEFAULT 'chrome',     -- 'chrome' | 'edge' | 'local'
    store_url       TEXT,                      -- Original store URL
    file_count      INTEGER DEFAULT 0,         -- Number of files in extension
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    last_analyzed   TIMESTAMPTZ                -- When last viewed
);

-- 安全检查记录
CREATE TABLE IF NOT EXISTS scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extension_id    TEXT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'pending',    -- 'pending' | 'running' | 'done' | 'error'
    files_scanned   INTEGER DEFAULT 0,
    total_files     INTEGER DEFAULT 0,
    high_count      INTEGER DEFAULT 0,
    medium_count    INTEGER DEFAULT 0,
    low_count       INTEGER DEFAULT 0,
    ai_summary      TEXT,                      -- AI-generated analysis summary
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 风险发现项
CREATE TABLE IF NOT EXISTS scan_findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    level           TEXT NOT NULL CHECK (level IN ('High', 'Medium', 'Low')),
    category        TEXT,                      -- e.g. 'network_request', 'eval_usage', 'permission'
    description     TEXT NOT NULL,
    file_path       TEXT,                      -- Source file where found
    line_number     INTEGER,
    code_snippet    TEXT,                      -- The suspicious code
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 扩展权限记录
CREATE TABLE IF NOT EXISTS scan_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL,             -- e.g. 'tabs', 'cookies', 'webRequest'
    risk_level      TEXT CHECK (risk_level IN ('High', 'Medium', 'Low')),
    description     TEXT,                      -- What this permission allows
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 用户设置
CREATE TABLE IF NOT EXISTS user_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 商店下载缓存
CREATE TABLE IF NOT EXISTS download_cache (
    extension_id    TEXT NOT NULL,
    store           TEXT NOT NULL DEFAULT 'chrome',
    name            TEXT,
    version         TEXT,
    icon_url        TEXT,
    rating          NUMERIC(3,2),
    rating_count    INTEGER,
    user_count      TEXT,                      -- e.g. '10,000+ users'
    raw_response    JSONB,                     -- Raw store API response
    cached_at       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (extension_id, store)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_extensions_updated
    ON extensions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_extensions_name
    ON extensions USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scans_extension
    ON scans(extension_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status
    ON scans(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_findings_scan
    ON scan_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_level
    ON scan_findings(level);
CREATE INDEX IF NOT EXISTS idx_findings_category
    ON scan_findings(category);
CREATE INDEX IF NOT EXISTS idx_permissions_scan
    ON scan_permissions(scan_id);
CREATE INDEX IF NOT EXISTS idx_download_cache_expiry
    ON download_cache(cached_at);

-- ============================================================
-- Trigram extension for fuzzy search (optional)
-- ============================================================
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Views
-- ============================================================

-- 扩展安全概况（最新扫描结果汇总）
CREATE OR REPLACE VIEW extension_security_summary AS
SELECT
    e.id,
    e.name,
    e.version,
    e.store,
    s.id AS latest_scan_id,
    s.high_count,
    s.medium_count,
    s.low_count,
    s.finished_at AS last_scanned_at,
    CASE
        WHEN s.high_count > 0 THEN 'High'
        WHEN s.medium_count > 0 THEN 'Medium'
        WHEN s.low_count > 0 THEN 'Low'
        ELSE 'Clean'
    END AS worst_risk
FROM extensions e
LEFT JOIN LATERAL (
    SELECT * FROM scans
    WHERE scans.extension_id = e.id AND scans.status = 'done'
    ORDER BY created_at DESC
    LIMIT 1
) s ON true;
