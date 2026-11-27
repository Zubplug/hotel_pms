-- Adds a first-class cloud order type for public Food Commerce orders.
-- Existing orders are unchanged; this only extends the PostgreSQL enum.
ALTER TYPE "PosOrderType" ADD VALUE IF NOT EXISTS 'ONLINE_WEB';
