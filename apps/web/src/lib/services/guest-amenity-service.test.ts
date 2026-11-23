import { describe, expect, it, vi } from 'vitest';
import { postGuestAmenityPackInTransaction } from './guest-amenity-service';

describe('guest amenity stock posting', () => {
  it('deducts one pack per occupied room only from the configured housekeeping warehouse', async () => {
    const stock = [
      { id: 'water', name: 'Complimentry water', warehouseId: 'hk', baseUnit: 'BOTTLE', costPrice: 125, quantityOnHand: 100, stockUnits: [], isActive: true },
      { id: 'bottle-water', name: 'Bottle Water', warehouseId: 'hk', baseUnit: 'BOTTLE', costPrice: 999, quantityOnHand: 100, stockUnits: [], isActive: true },
      { id: 'milk', name: 'Sachet Milk', warehouseId: 'hk', baseUnit: 'SACHET', costPrice: 162, quantityOnHand: 100, stockUnits: [], isActive: true },
      { id: 'milo', name: 'Milo', warehouseId: 'hk', baseUnit: 'SACHET', costPrice: 175, quantityOnHand: 100, stockUnits: [], isActive: true },
      { id: 'sugar-cube', name: 'Sugar Cube', warehouseId: 'hk', baseUnit: 'PIECE', costPrice: 30, quantityOnHand: 100, stockUnits: [], isActive: true },
    ];
    const tx = {
      property: { findUnique: vi.fn().mockResolvedValue({ settings: {}, baseCurrency: 'NGN', supportedCurrencies: ['NGN'] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue({ id: 'hk', name: 'Housekeeping/Laundry' }) },
      stockItem: {
        findMany: vi.fn().mockResolvedValue(stock),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => ({
          quantityOnHand: 98,
          costPrice: stock.find((item) => item.id === where.id)?.costPrice || 0,
        })),
      },
      stockTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      guestAmenityFulfillment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await postGuestAmenityPackInTransaction(tx, {
      propertyId: 'property-1',
      nightAuditId: 'audit-1',
      reservationId: 'reservation-1',
      roomId: 'room-1',
      businessDate: new Date('2026-10-13T00:00:00.000Z'),
      guestCount: 2,
      actorId: 'staff-1',
    });

    expect(result).toEqual({ itemCount: 4, issuedQuantity: 8, shortageQuantity: 0, totalCost: 984, shortages: [] });
    expect(tx.warehouse.findFirst).toHaveBeenCalled();
    expect(tx.stockItem.updateMany).toHaveBeenCalledTimes(4);
    expect(tx.stockTransaction.create).toHaveBeenCalledTimes(4);
    expect(tx.stockTransaction.create.mock.calls[0][0].data.source).toBe('GUEST_AMENITY');
    expect(tx.stockTransaction.create.mock.calls[0][0].data.quantity).toBe(-2);
  });

  it('does not fall back to a general warehouse when the amenity warehouse is missing', async () => {
    const tx = {
      property: { findUnique: vi.fn().mockResolvedValue({ settings: {}, baseCurrency: 'NGN', supportedCurrencies: ['NGN'] }) },
      warehouse: { findFirst: vi.fn().mockResolvedValue(null) },
      guestAmenityFulfillment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await postGuestAmenityPackInTransaction(tx, {
      propertyId: 'property-1',
      nightAuditId: 'audit-1',
      reservationId: 'reservation-1',
      businessDate: new Date('2026-10-13T00:00:00.000Z'),
      guestCount: 1,
      actorId: 'staff-1',
    });

    expect(result.shortageQuantity).toBe(4);
    expect(result.shortages).toHaveLength(4);
    expect(tx.guestAmenityFulfillment.create).toHaveBeenCalledTimes(4);
  });
});
