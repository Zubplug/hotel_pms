DO $$
DECLARE
    v_folio_id UUID := '4c5ace4c-4d29-4f4c-a3a5-d84cc051c54d';
    v_res_id UUID := '44e38dc7-8d4a-4480-8e29-ea08be624f86';
    v_credit_entry_id UUID := '005b011e-2179-4cc3-9d18-7c07ac276e91';
    v_account_id UUID;
    v_property_id UUID;
    v_guest_id UUID;
    v_credit_id UUID := gen_random_uuid();
    v_payment_id UUID := gen_random_uuid();
    v_alloc_id UUID := gen_random_uuid();
    v_app_id UUID := gen_random_uuid();
BEGIN
    -- Get info
    SELECT "accountId" INTO v_account_id FROM "CityLedgerEntry" WHERE id = v_credit_entry_id;
    SELECT "propertyId", "primaryGuestId" INTO v_property_id, v_guest_id FROM "Reservation" WHERE id = v_res_id;

    -- 1. Update CityLedgerEntry to SETTLED
    UPDATE "CityLedgerEntry" SET status = 'SETTLED' WHERE id = v_credit_entry_id;

    -- 2. Decrement CityLedgerAccount balance by 60,000
    UPDATE "CityLedgerAccount" SET balance = balance - 60000 WHERE id = v_account_id;

    -- 3. Create CityLedgerAllocation
    INSERT INTO "CityLedgerAllocation" (id, "paymentId", "folioId", amount, currency, "createdAt", "updatedAt")
    VALUES (v_alloc_id, v_credit_entry_id, v_folio_id, 60000, 'NGN', NOW(), NOW());

    -- 4. Create FolioCredit of 60,000 (remaining 30,000)
    INSERT INTO "FolioCredit" (id, "folioId", "reservationId", "propertyId", amount, "remainingAmount", currency, method, status, "createdAt", "updatedAt", "businessDate")
    VALUES (v_credit_id, v_folio_id, v_res_id, v_property_id, 60000, 30000, 'NGN', 'GUEST_CREDIT', 'PARTIALLY_APPLIED', NOW(), NOW(), CURRENT_DATE);

    -- 5. Create Payment of 60,000
    INSERT INTO "Payment" (id, "folioId", "propertyId", "reservationId", method, amount, "baseAmount", currency, status, "createdAt", "updatedAt", "businessDate")
    VALUES (v_payment_id, v_folio_id, v_property_id, v_res_id, 'GUEST_CREDIT', 60000, 60000, 'NGN', 'COMPLIMENTARY', NOW(), NOW(), CURRENT_DATE);

    -- 6. Create FolioCreditApplication of 30,000 (to offset the 30,000 room charge)
    INSERT INTO "FolioCreditApplication" (id, "creditId", "folioId", amount, currency, source, description, "createdAt", "updatedAt", "businessDate")
    VALUES (v_app_id, v_credit_id, v_folio_id, 30000, 'NGN', 'ROOM_CHARGE', 'Applied guest credit to Room Charge', NOW(), NOW(), CURRENT_DATE);

    -- 7. Update Folio balance to 0, totalPayments to 60,000
    UPDATE "Folio" SET balance = balance - 30000, "totalPayments" = "totalPayments" + 60000 WHERE id = v_folio_id;

END $$;
