-- Migration: create whale_events and risk_snapshots with correct columns
-- Run: psql $DATABASE_URL -f scripts/migrate-historical-data.sql

CREATE TABLE IF NOT EXISTS whale_events (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol          TEXT NOT NULL,
  action            TEXT NOT NULL,
  usd_value         NUMERIC(20, 2) NOT NULL,
  wallet            TEXT NOT NULL,
  block_number      BIGINT,
  tx_hash           TEXT NOT NULL,
  net_flow_direction TEXT NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL,
  source            TEXT NOT NULL DEFAULT 'envio'
);

CREATE UNIQUE INDEX IF NOT EXISTS whale_events_tx_hash_uidx     ON whale_events (tx_hash);
CREATE INDEX        IF NOT EXISTS whale_events_protocol_ts_idx  ON whale_events (protocol, timestamp DESC);
CREATE INDEX        IF NOT EXISTS whale_events_timestamp_idx    ON whale_events (timestamp DESC);

CREATE TABLE IF NOT EXISTS risk_snapshots (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol  TEXT NOT NULL,
  score     INTEGER NOT NULL,
  health    INTEGER NOT NULL,
  tvl       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_snapshots_protocol_ts_idx ON risk_snapshots (protocol, timestamp DESC);
CREATE INDEX IF NOT EXISTS risk_snapshots_timestamp_idx   ON risk_snapshots (timestamp DESC);

-- Migrate existing risk_snapshots rows that have risk_factors but no tvl column
-- (worker may have already created a version of this table)
ALTER TABLE risk_snapshots ADD COLUMN IF NOT EXISTS tvl NUMERIC(20, 2) NOT NULL DEFAULT 0;
ALTER TABLE risk_snapshots ADD COLUMN IF NOT EXISTS health INTEGER;
UPDATE risk_snapshots SET health = score WHERE health IS NULL;
-- Note: existing whale_events table from worker bootstrap has different columns;
-- new columns are additive and existing rows won't conflict on tx_hash.
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS protocol          TEXT;
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS action            TEXT;
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS usd_value         NUMERIC(20, 2);
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS wallet            TEXT;
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS net_flow_direction TEXT;
ALTER TABLE whale_events ADD COLUMN IF NOT EXISTS source            TEXT;
