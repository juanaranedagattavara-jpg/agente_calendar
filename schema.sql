-- schema.sql — Julieta Dashboard
-- Run once: psql -U your_user -d your_database -f schema.sql

CREATE TABLE IF NOT EXISTS julieta_events (
    id                 BIGSERIAL PRIMARY KEY,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type         TEXT NOT NULL CHECK (event_type IN (
                         'appointment_booked',
                         'appointment_rescheduled',
                         'appointment_cancelled',
                         'inquiry_answered'
                       )),
    client_name        TEXT,
    service_name       TEXT,
    service_price      NUMERIC(10, 2) DEFAULT 0,
    appointment_date   TIMESTAMPTZ,
    conversation_id    TEXT,
    time_saved_minutes INT NOT NULL DEFAULT 5,
    notes              JSONB
);

CREATE INDEX IF NOT EXISTS idx_julieta_events_created_at
    ON julieta_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_julieta_events_monthly
    ON julieta_events (created_at, event_type, service_price, time_saved_minutes);
