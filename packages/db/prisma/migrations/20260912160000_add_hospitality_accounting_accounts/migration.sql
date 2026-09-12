-- Add the minimum hospitality accounting control accounts required by the
-- departmental revenue and cash-control reports. This migration is additive:
-- existing accounts, journal lines, and posted transactions are untouched.

INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), p."id", a."code", a."name", a."type"::"AccountType",
  a."category", a."normalBalance"::"BalanceSide", a."description", true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
CROSS JOIN (
  VALUES
    ('1100', 'Guest Ledger Receivable', 'ASSET', 'Current Assets', 'DEBIT', 'Amounts due from in-house and checked-out guests.'),
    ('1110', 'Credit Card Receivable', 'ASSET', 'Current Assets', 'DEBIT', 'Card settlements pending receipt from payment processors.'),
    ('2210', 'Service Charge Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT', 'Service charges collected and held for staff distribution.'),
    ('4400', 'Other Operating Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT', 'Operating revenue not classified as rooms, food and beverage, laundry, or events.'),
    ('4900', 'Revenue Rebates and Discounts', 'REVENUE', 'Contra Revenue', 'DEBIT', 'Approved rebates, discounts, and concessions reducing gross revenue.'),
    ('6500', 'Bank and Merchant Fees', 'EXPENSE', 'Operating Expenses', 'DEBIT', 'Bank, card processor, and payment gateway charges.'),
    ('6600', 'OTA Commissions', 'EXPENSE', 'Operating Expenses', 'DEBIT', 'Commissions payable or incurred on online travel agency bookings.')
) AS a("code", "name", "type", "category", "normalBalance", "description")
WHERE NOT EXISTS (
  SELECT 1
  FROM "ChartOfAccount" existing
  WHERE existing."propertyId" = p."id"
    AND existing."code" = a."code"
);
