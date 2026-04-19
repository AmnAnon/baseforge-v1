-- Migration: add webhook_url and last_triggered to alert_rules
-- Run once against Neon: psql $DATABASE_URL -f scripts/migrate-alert-rules-webhook.sql
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS last_triggered timestamptz;
