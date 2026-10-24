import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../website/src/lib/services/gl-mapping-service', () => ({
  GLMappingService: {
    getAssetAccountForMethod: vi.fn().mockResolvedValue('asset-account'),
    getCorporateAdvancesAccount: vi.fn().mockResolvedValue('advance-liability'),
  },
}));

vi.mock('../../../../website/src/lib/services/general-ledger-service', () => ({
  GeneralLedgerService: { postJournal: vi.fn().mockResolvedValue({ id: 'journal-1' }) },
}));

import {
  CorporateSettlementError,
  lockCorporateSettlement,
  settleCorporatePayment,
} from '../../../../website/src/lib/booking-engine/corporate-settlement-service';

function fixture(overrides: Record<string, unknown> = {}) {
  const queryRaw = vi.fn().mockResolvedValue([{ id: 'locked' }]);
  const tx = {
    $queryRaw: queryRaw,
    bookingPaymentTransaction: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'bpt-1',
        organizationId: 'org-1',
        propertyId: 'property-1',
        providerRef: 'corp-ref-1',
        amount: 5000,
        currency: 'NGN',
        cityLedgerEntryId: null,
        metadata: { channel: 'CORPORATE_API', paymentTarget: 'STANDALONE_API', paymentMode: 'FULL' },
        reservation: {
          id: 'reservation-1',
          propertyId: 'property-1',
          corporateAccountId: 'corporate-1',
          status: 'PENDING',
          currency: 'NGN',
          ratePlanSnapshot: { total: 5000, paymentMode: 'FULL' },
          property: { organizationId: 'org-1' },
        },
        ...overrides,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    corporateAccount: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'corporate-1',
        organizationId: 'org-1',
        propertyId: 'property-1',
        cityLedgerAccountId: 'ledger-1',
        isActive: true,
      }),
    },
    cityLedgerAccount: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'ledger-1',
        propertyId: 'property-1',
        organizationId: 'org-1',
        type: 'CORPORATE',
        status: 'ACTIVE',
        currency: 'NGN',
        balance: 0,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    folio: {
      findFirst: vi.fn().mockResolvedValue({ id: 'master-folio', propertyId: 'property-1', type: 'CITY_LEDGER' }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    },
    cityLedgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'entry-1' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    cityLedgerInvoice: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    reservation: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ status: 'CONFIRMED' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    outboxEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return { tx, queryRaw };
}

describe('corporate settlement transaction boundary', () => {
  it('locks the payment transaction before the corporate ledger account', async () => {
    const { tx, queryRaw } = fixture();

    const result = await lockCorporateSettlement(tx, 'bpt-1');

    expect(result.settlementIdentity).toBe('CORP_SETTLEMENT:bpt-1');
    expect(result.cityLedgerAccount.id).toBe('ledger-1');
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(queryRaw.mock.invocationCallOrder[1]);
  });

  it('rejects a transaction that is already linked to a City Ledger entry', async () => {
    const { tx } = fixture({ cityLedgerEntryId: 'entry-1' });

    await expect(lockCorporateSettlement(tx, 'bpt-1')).rejects.toMatchObject<CorporateSettlementError>({
      code: 'ALREADY_SETTLED',
    });
    expect(tx.corporateAccount.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-corporate payment transactions before touching ledger state', async () => {
    const { tx } = fixture({ metadata: { channel: 'BOOKING_ENGINE' } });

    await expect(lockCorporateSettlement(tx, 'bpt-1')).rejects.toMatchObject<CorporateSettlementError>({
      code: 'NOT_CORPORATE_TRANSACTION',
    });
    expect(tx.corporateAccount.findUnique).not.toHaveBeenCalled();
  });

  it('posts one City Ledger advance and confirms only after settlement', async () => {
    const { tx } = fixture();
    const result = await settleCorporatePayment({
      tx,
      bookingPaymentTransactionId: 'bpt-1',
      providerRef: 'corp-ref-1',
      providerTransactionId: 'provider-1',
      verifiedAmount: 5000,
      verifiedCurrency: 'NGN',
      businessDate: new Date('2026-10-24T00:00:00.000Z'),
      systemActorId: 'actor-1',
      requestId: 'request-1',
    });
    expect(result).toMatchObject({ paymentId: 'payment-1', cityLedgerEntryId: 'entry-1', reservationConfirmed: true });
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.cityLedgerEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'PAYMENT', accountId: 'ledger-1', amount: 5000 }) }));
    expect(tx.reservation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }));
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('does not post when the verified amount differs from the gateway transaction', async () => {
    const { tx } = fixture();
    await expect(settleCorporatePayment({
      tx,
      bookingPaymentTransactionId: 'bpt-1',
      providerRef: 'corp-ref-1',
      providerTransactionId: 'provider-1',
      verifiedAmount: 5001,
      verifiedCurrency: 'NGN',
      businessDate: new Date('2026-10-24T00:00:00.000Z'),
      systemActorId: 'actor-1',
      requestId: 'request-1',
    })).rejects.toMatchObject({ code: 'CORPORATE_ACCOUNT_MISMATCH' });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.cityLedgerEntry.create).not.toHaveBeenCalled();
  });
});
