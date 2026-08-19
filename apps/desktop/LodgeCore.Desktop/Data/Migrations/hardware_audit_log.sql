-- LodgeCore Hardware Audit Log
-- Tracks all hardware events (cash drawer, printers, KDS) for audit compliance

CREATE TABLE IF NOT EXISTS hardware_audit_log (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    device_id   TEXT NOT NULL,
    event_type  TEXT NOT NULL,  -- CASH_DRAWER_OPEN, RECEIPT_PRINT, KITCHEN_TICKET_PRINT, KDS_ORDER_SENT, KDS_STATUS_*
    payload     TEXT,           -- JSON payload for replay/debugging
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hardware_audit_user ON hardware_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_hardware_audit_created ON hardware_audit_log(created_at);
