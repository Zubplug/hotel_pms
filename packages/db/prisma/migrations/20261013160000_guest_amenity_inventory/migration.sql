-- Complimentary in-room guest amenities consume stock at cost.
ALTER TYPE "StockTransactionSource" ADD VALUE IF NOT EXISTS 'GUEST_AMENITY';
