-- OWWH schema. The `opportunities` table is created dynamically by the seed script
-- with the exact 284 Salesforce column names from salesforce_synthetic_cut.xlsx.

CREATE TABLE sf_field_meta (
    column_name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    field_group TEXT NOT NULL,
    field_type TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    is_key INTEGER NOT NULL DEFAULT 0,
    display INTEGER NOT NULL DEFAULT 1
);

-- OWWH-side normalised facets for each opportunity (keeps `opportunities` pure Salesforce).
CREATE TABLE opportunity_facets (
    opportunity_id TEXT PRIMARY KEY REFERENCES opportunities("ItemInternalId"),
    sector TEXT,
    client TEXT,
    region TEXT,           -- primary region code (QLD, VIC, NZ North, National…)
    regions TEXT,          -- comma-separated list of all regions with revenue
    service_line TEXT,
    status TEXT,           -- open | won | lost
    tcv REAL,
    is_restricted INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL         -- salesforce (row from the xlsx) | synthetic (generated for the demo)
);

CREATE TABLE sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    short_name TEXT NOT NULL,
    description TEXT,
    content_owner TEXT,
    administrator TEXT,
    backup_administrator TEXT
);

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL,        -- bid_manager | proposal_writer | sector_admin | enterprise_admin
    sector TEXT NOT NULL REFERENCES sectors(name)
);

CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_name TEXT NOT NULL,   -- value as it appears in Salesforce
    title TEXT,
    location TEXT,
    primary_sector TEXT,
    sectors TEXT NOT NULL DEFAULT '[]',
    expertise TEXT NOT NULL DEFAULT '[]',
    roles TEXT NOT NULL DEFAULT '[]',
    clients TEXT NOT NULL DEFAULT '[]',
    service_lines TEXT NOT NULL DEFAULT '[]',
    bio TEXT,
    opp_count INTEGER NOT NULL DEFAULT 0,
    win_count INTEGER NOT NULL DEFAULT 0,
    closed_count INTEGER NOT NULL DEFAULT 0,
    total_tcv REAL NOT NULL DEFAULT 0,
    is_team INTEGER NOT NULL DEFAULT 0,
    data_source TEXT NOT NULL DEFAULT 'synthetic'   -- salesforce (named in the xlsx) | synthetic
);

CREATE TABLE contact_opportunities (
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    opportunity_id TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (contact_id, opportunity_id, role)
);

CREATE TABLE content_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    body_json TEXT NOT NULL DEFAULT '{}',
    sector TEXT NOT NULL,
    business_unit TEXT,
    service_line TEXT,
    contract_value REAL,
    contract_value_range TEXT,
    client TEXT,
    geography TEXT,
    confidentiality TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'sector_only',
    restricted_flags TEXT NOT NULL DEFAULT '[]',
    is_restricted INTEGER NOT NULL DEFAULT 0,
    owner TEXT,
    review_date TEXT,
    expiry_date TEXT,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    version INTEGER NOT NULL DEFAULT 1,
    source_opportunity_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    data_source TEXT NOT NULL DEFAULT 'synthetic',  -- synthetic (seeded demo content) | user (submitted in the app)
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_content_sector ON content_items(sector);
CREATE INDEX idx_content_type ON content_items(type);
CREATE INDEX idx_content_source ON content_items(source_opportunity_id);

CREATE TABLE content_shares (
    content_id TEXT NOT NULL REFERENCES content_items(id),
    sector TEXT NOT NULL,
    PRIMARY KEY (content_id, sector)
);

CREATE TABLE content_contacts (
    content_id TEXT NOT NULL REFERENCES content_items(id),
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    role TEXT NOT NULL,
    PRIMARY KEY (content_id, contact_id, role)
);

CREATE TABLE content_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL REFERENCES content_items(id),
    version INTEGER NOT NULL,
    changed_by TEXT,
    changed_at TEXT NOT NULL,
    summary TEXT,
    snapshot_json TEXT
);

CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    detail TEXT
);

-- Unified search documents (one per content item, opportunity and contact).
-- Permission columns mirror content_items so one visibility clause works everywhere.
CREATE TABLE search_docs (
    rowid INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,     -- content | opportunity | contact
    entity_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,        -- content type, 'opportunity' or 'contact'
    title TEXT NOT NULL,
    subtitle TEXT,
    sector TEXT,
    client TEXT,
    region TEXT,
    service_line TEXT,
    value REAL,
    status TEXT,
    visibility TEXT NOT NULL,
    is_restricted INTEGER NOT NULL DEFAULT 0,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    owner TEXT,
    updated_at TEXT,
    source TEXT NOT NULL,          -- salesforce | synthetic | user
    UNIQUE (entity_type, entity_id)
);

CREATE VIRTUAL TABLE search_index USING fts5(
    title, body, tags,
    tokenize = 'porter unicode61'
);
