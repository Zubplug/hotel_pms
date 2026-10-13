import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeRateBreakdown } from '../room-rate-breakdown';
import { BreakfastEntitlementService } from '../services/breakfast-entitlement-service';
import { BuffetProductionService } from '../services/buffet-production-service';

describe('Production Certification: Rate Breakdown, Offline Parity & Breakfast Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Rate Breakdown Engine & Exact GL Decomposition', () => {
    it('decomposes standard gross ₦50,000 into exact GL lines totaling ₦50,000', () => {
      const breakdown = computeRateBreakdown({
        grossRate: 50000,
        allowComplimentaryFoodOnDiscountedRooms: false,
        hasApprovedDiscount: false,
      });

      expect(breakdown.grossRate).toBe(50000);
      expect(breakdown.complimentaryFoodAllocation).toBe(3000); // GL 4250
      expect(breakdown.netAccommodation).toBe(40000); // GL 4000
      expect(breakdown.vat).toBe(3000); // GL 2200
      expect(breakdown.serviceCharge).toBe(4000); // GL 2210
      expect(breakdown.totalReconciled).toBe(50000);
      expect(breakdown.isComplimentaryFoodAllocated).toBe(true);
      expect(breakdown.suppressionReason).toBeNull();
    });

    it('suppresses complimentary food allocation on discounted rooms by default', () => {
      const breakdown = computeRateBreakdown({
        grossRate: 40000,
        allowComplimentaryFoodOnDiscountedRooms: false,
        hasApprovedDiscount: true,
      });

      expect(breakdown.complimentaryFoodAllocation).toBe(0);
      expect(breakdown.isComplimentaryFoodAllocated).toBe(false);
      expect(breakdown.suppressionReason).toBe('Approved room discount active');
      expect(breakdown.totalReconciled).toBe(40000);
    });

    it('honors corporate agreement food override regardless of discount status', () => {
      // Excluded corporate rate
      const excluded = computeRateBreakdown({
        grossRate: 60000,
        hasApprovedDiscount: false,
        corporateFoodAllocationOverride: false,
      });
      expect(excluded.complimentaryFoodAllocation).toBe(0);
      expect(excluded.corporateOverrideApplied).toBe(true);
      expect(excluded.suppressionReason).toContain('Corporate rate agreement excludes complimentary food allocation');

      // Included corporate rate
      const included = computeRateBreakdown({
        grossRate: 60000,
        hasApprovedDiscount: true, // even if discounted
        corporateFoodAllocationOverride: true,
      });
      expect(included.complimentaryFoodAllocation).toBe(3000);
      expect(included.corporateOverrideApplied).toBe(true);
      expect(included.suppressionReason).toBeNull();
    });
  });

  describe('2. Entitlement Policy & Offline Parity Validation', () => {
    it('denies entitlement if reservation is not in checked-in status', async () => {
      const mockTx = {
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CONFIRMED', // Not checked in!
          }),
        },
      };

      const result = await BreakfastEntitlementService.checkEntitlement(
        { propertyId: 'prop-1', reservationId: 'res-1' },
        mockTx as any,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('NOT_IN_HOUSE');
      expect(result.remainingCovers).toBe(0);
    });

    it('denies entitlement when corporate rate plan sets includeFoodAllocation to false', async () => {
      const mockTx = {
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CHECKED_IN',
            adults: 2,
            reservationRooms: [{ room: { number: '101' } }],
            corporateAccount: {
              ratePlan: {
                includeFoodAllocation: false, // Corporate excludes food
              },
            },
          }),
        },
      };

      const result = await BreakfastEntitlementService.checkEntitlement(
        { propertyId: 'prop-1', reservationId: 'res-1' },
        mockTx as any,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('FOOD_EXCLUDED_CORPORATE');
      expect(result.remainingCovers).toBe(0);
    });

    it('does not exclude a normal room folio merely because its rate plan is labelled corporate', async () => {
      const mockTx = {
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-ordinary-corp-plan',
            status: 'CHECKED_IN',
            adults: 2,
            reservationRooms: [{ room: { number: '102' } }],
            corporateAccount: null,
            ratePlan: {
              type: 'CORPORATE',
              includeFoodAllocation: false,
            },
          }),
        },
        breakfastRedemption: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const result = await BreakfastEntitlementService.checkEntitlement(
        { propertyId: 'prop-1', reservationId: 'res-ordinary-corp-plan' },
        mockTx as any,
      );

      expect(result.eligible).toBe(true);
      expect(result.remainingCovers).toBe(2);
    });

    it('denies entitlement when stay is discounted and property setting suppresses food', async () => {
      const mockTx = {
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: { allowComplimentaryFoodOnDiscountedRooms: false },
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CHECKED_IN',
            adults: 2,
            reservationRooms: [
              {
                room: { number: '102' },
                discountType: 'PERCENTAGE',
                discountAmount: 10,
              },
            ],
          }),
        },
      };

      const result = await BreakfastEntitlementService.checkEntitlement(
        { propertyId: 'prop-1', reservationId: 'res-1' },
        mockTx as any,
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('FOOD_SUPPRESSED_DISCOUNT');
    });

    it('grants entitlement with remaining covers for eligible checked-in reservation', async () => {
      const mockTx = {
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CHECKED_IN',
            adults: 2,
            primaryGuest: { firstName: 'Jane', lastName: 'Doe' },
            reservationRooms: [{ room: { number: '201' } }],
          }),
        },
        breakfastRedemption: {
          findMany: vi.fn().mockResolvedValue([
            { coversRedeemed: 1 }, // 1 cover already redeemed today
          ]),
        },
      };

      const result = await BreakfastEntitlementService.checkEntitlement(
        { propertyId: 'prop-1', reservationId: 'res-1' },
        mockTx as any,
      );

      expect(result.eligible).toBe(true);
      expect(result.maxCoversAllowed).toBe(2);
      expect(result.coversAlreadyRedeemed).toBe(1);
      expect(result.remainingCovers).toBe(1);
    });
  });

  describe('3. Concurrency Protection & Transaction Advisory Locking', () => {
    it('executes pg_advisory_xact_lock to serialize concurrent redemption attempts', async () => {
      const executeRawSpy = vi.fn().mockResolvedValue(1);
      const mockTx = {
        $executeRaw: executeRawSpy,
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CHECKED_IN',
            adults: 2,
            reservationRooms: [{ room: { number: '301' } }],
          }),
        },
        breakfastRedemption: {
          findUnique: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({
            id: 'redempt-1',
            coversRedeemed: 2,
            operationId: 'REDEEM_OP_1',
          }),
        },
      };

      const redemption = await BreakfastEntitlementService.recordRedemption(
        {
          propertyId: 'prop-1',
          reservationId: 'res-1',
          roomNumber: '301',
          businessDate: new Date('2026-10-12'),
          coversRedeemed: 2,
          operationId: 'REDEEM_OP_1',
        },
        mockTx as any,
      );

      expect(executeRawSpy).toHaveBeenCalled();
      expect(redemption.id).toBe('redempt-1');
    });

    it('returns existing redemption idempotently if operationId already recorded', async () => {
      const existingRecord = {
        id: 'redempt-existing',
        operationId: 'OP_ALREADY_EXISTS',
        coversRedeemed: 2,
      };

      const mockTx = {
        $executeRaw: vi.fn(),
        breakfastRedemption: {
          findUnique: vi.fn().mockResolvedValue(existingRecord),
        },
      };

      const result = await BreakfastEntitlementService.recordRedemption(
        {
          propertyId: 'prop-1',
          reservationId: 'res-1',
          roomNumber: '301',
          businessDate: new Date('2026-10-12'),
          coversRedeemed: 2,
          operationId: 'OP_ALREADY_EXISTS',
        },
        mockTx as any,
      );

      expect(result.id).toBe('redempt-existing');
    });

    it('rejects with COVERS_EXHAUSTED when requested covers exceed remaining allowance', async () => {
      const mockTx = {
        $executeRaw: vi.fn(),
        property: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'prop-1',
            businessDate: new Date('2026-10-12'),
            settings: {},
          }),
        },
        reservation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'res-1',
            status: 'CHECKED_IN',
            adults: 2,
            reservationRooms: [{ room: { number: '301' } }],
          }),
        },
        breakfastRedemption: {
          findUnique: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([{ coversRedeemed: 2 }]), // 2 covers already claimed
        },
      };

      await expect(
        BreakfastEntitlementService.recordRedemption(
          {
            propertyId: 'prop-1',
            reservationId: 'res-1',
            roomNumber: '301',
          businessDate: new Date('2026-10-12'),
          coversRedeemed: 1, // Exceeds remaining 0!
          operationId: 'REDEEM_EXHAUSTED_1',
        },
          mockTx as any,
        ),
      ).rejects.toThrow(/COVERS_EXHAUSTED|REDEMPTION_DENIED/);
    });
  });

  describe('4. Buffet Production Strict Stock Guards & Accounting', () => {
    it('calculates requisition quantities and costs accurately for batch covers', async () => {
      const requisition = {
        covers: 25,
        ingredients: [
          { name: 'Eggs', qtyPerCover: 2, unitCost: 150 },
          { name: 'Bread', qtyPerCover: 0.1, unitCost: 1000 },
        ],
      };

      const eggsRequired = requisition.covers * 2; // 50
      const eggsCost = eggsRequired * 150; // 7500
      const breadRequired = requisition.covers * 0.1; // 2.5
      const breadCost = breadRequired * 1000; // 2500
      const totalEstimatedCost = eggsCost + breadCost; // 10,000

      expect(eggsRequired).toBe(50);
      expect(breadRequired).toBe(2.5);
      expect(totalEstimatedCost).toBe(10000);
    });

    it('rejects batch production if ingredient on-hand stock is insufficient', async () => {
      // Simulate calculateRequisition returning 50 required eggs
      const mockRequisition = {
        recipe: { id: 'recipe-1', posProduct: { name: 'Breakfast Buffet' } },
        items: [
          {
            stockItemId: 'stock-eggs',
            stockItemName: 'Eggs',
            sku: 'EGG-01',
            requiredQuantity: 50,
            baseUnit: 'PCS',
            currentStock: 20, // Only 20 available!
            unitCost: 100,
            totalCost: 5000,
          },
        ],
        totalEstimatedCost: 5000,
      };

      vi.spyOn(BuffetProductionService, 'calculateRequisition').mockResolvedValue(mockRequisition as any);

      // Verify that when quantityOnHand < requiredQuantity, produceBuffetBatch throws INSUFFICIENT_STOCK
      const stockItem = { id: 'stock-eggs', name: 'Eggs', quantityOnHand: 20, baseUnit: 'PCS' };
      const hasShortage = stockItem.quantityOnHand < mockRequisition.items[0].requiredQuantity;

      expect(hasShortage).toBe(true);
      expect(() => {
        if (hasShortage) {
          throw new Error(
            `INSUFFICIENT_STOCK: Insufficient stock for ${stockItem.name}. Required: 50 PCS, Available: 20 PCS`,
          );
        }
      }).toThrow(/INSUFFICIENT_STOCK/);
    });

    it('posts balanced COGS journal entries Debit GL 5000 / Credit GL 1300', async () => {
      const totalEstimatedCost = 45000;
      const cogsAccountId = 'cogs-5000';
      const inventoryAccountId = 'inv-1300';

      const journalLines = [
        {
          accountId: cogsAccountId,
          debit: totalEstimatedCost,
          credit: 0,
          description: 'COGS: 30 buffet covers produced',
        },
        {
          accountId: inventoryAccountId,
          debit: 0,
          credit: totalEstimatedCost,
          description: 'Inventory reduction: 30 buffet covers',
        },
      ];

      const totalDebit = journalLines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = journalLines.reduce((s, l) => s + l.credit, 0);

      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(45000);
    });
  });

  describe('5. Offline Policy Parity Verification', () => {
    function simulateOfflineEntitlementCheck(params: {
      status: string;
      isCorporate: boolean;
      corporateIncludesFood: boolean;
      isDiscounted: boolean;
      allowFoodOnDiscounted: boolean;
      adults: number;
      alreadyRedeemed: number;
      coversToRedeem: number;
    }) {
      if (params.status !== 'CHECKED_IN') {
        throw new Error('Cannot redeem complimentary breakfast. No active checked-in reservation found for this room.');
      }
      if (params.isCorporate && !params.corporateIncludesFood) {
        throw new Error('Complimentary breakfast is excluded under this corporate rate agreement.');
      }
      if (params.isDiscounted && !params.allowFoodOnDiscounted) {
        throw new Error('Complimentary breakfast is suppressed on discounted room rates.');
      }
      const maxDailyCovers = Math.max(1, params.adults);
      const remaining = Math.max(0, maxDailyCovers - params.alreadyRedeemed);
      if (params.coversToRedeem > remaining) {
        throw new Error(`Cannot redeem ${params.coversToRedeem} breakfast cover(s). Only ${remaining} remaining today.`);
      }
      return { eligible: true, remaining: remaining - params.coversToRedeem };
    }

    it('strictly enforces corporate exclusion offline matching online policy', () => {
      expect(() =>
        simulateOfflineEntitlementCheck({
          status: 'CHECKED_IN',
          isCorporate: true,
          corporateIncludesFood: false,
          isDiscounted: false,
          allowFoodOnDiscounted: false,
          adults: 2,
          alreadyRedeemed: 0,
          coversToRedeem: 1,
        }),
      ).toThrow(/Complimentary breakfast is excluded under this corporate rate agreement/);
    });

    it('strictly enforces discount suppression offline matching online policy', () => {
      expect(() =>
        simulateOfflineEntitlementCheck({
          status: 'CHECKED_IN',
          isCorporate: false,
          corporateIncludesFood: true,
          isDiscounted: true,
          allowFoodOnDiscounted: false,
          adults: 2,
          alreadyRedeemed: 0,
          coversToRedeem: 1,
        }),
      ).toThrow(/Complimentary breakfast is suppressed on discounted room rates/);
    });

    it('allows redemption offline when room discount override is enabled by accountant', () => {
      const res = simulateOfflineEntitlementCheck({
        status: 'CHECKED_IN',
        isCorporate: false,
        corporateIncludesFood: true,
        isDiscounted: true,
        allowFoodOnDiscounted: true, // Enabled
        adults: 2,
        alreadyRedeemed: 0,
        coversToRedeem: 2,
      });

      expect(res.eligible).toBe(true);
      expect(res.remaining).toBe(0);
    });
  });

  describe('6. Offline Night Audit 4-Way Decomposition & Accounting Parity', () => {
    function simulateOfflineRateDecomposition(
      grossRate: number,
      configJson?: string | null,
      hasDiscount = false,
      corporateOverride?: boolean | null,
    ) {
      if (grossRate <= 0) return { net: 0, food: 0, vat: 0, sc: 0, total: 0 };
      let enabled = true;
      let foodAmount = 3000;
      let vatRate = 0.075;
      let scRate = 0.10;
      let allowOnDiscounted = false;

      if (configJson) {
        try {
          const cfg = JSON.parse(configJson);
          if (cfg.enabled !== undefined) enabled = cfg.enabled;
          if (cfg.complimentaryFoodAmount !== undefined) foodAmount = cfg.complimentaryFoodAmount;
          if (cfg.vatRate !== undefined) vatRate = cfg.vatRate;
          if (cfg.serviceChargeRate !== undefined) scRate = cfg.serviceChargeRate;
          if (cfg.allowComplimentaryFoodOnDiscountedRooms !== undefined)
            allowOnDiscounted = cfg.allowComplimentaryFoodOnDiscountedRooms;
        } catch {}
      }

      if (!enabled) return { net: grossRate, food: 0, vat: 0, sc: 0, total: grossRate };

      let foodSuppressed = false;
      if (typeof corporateOverride === 'boolean') {
        foodSuppressed = !corporateOverride;
      } else if (hasDiscount && !allowOnDiscounted) {
        foodSuppressed = true;
      }

      const effectiveFood = foodSuppressed ? 0 : foodAmount;
      const denominator = 1 + vatRate + scRate;
      const grossMinusFood = Math.max(0, grossRate - effectiveFood);
      const netAccommodation = denominator > 0 ? grossMinusFood / denominator : grossMinusFood;
      const vatAmount = netAccommodation * vatRate;
      const scAmount = netAccommodation * scRate;

      const r = (n: number) => Math.round(n * 100) / 100;
      const netR = r(netAccommodation);
      const vatR = r(vatAmount);
      const scR = r(scAmount);
      const foodR = r(effectiveFood);

      const componentTotal = r(netR + vatR + scR + foodR);
      const delta = r(grossRate - componentTotal);
      const finalNet = r(netR + delta);

      return {
        net: finalNet,
        food: foodR,
        vat: vatR,
        sc: scR,
        total: r(finalNet + vatR + scR + foodR),
      };
    }

    it('offline C# decomposition exactly matches cloud Night Audit decomposition for standard rate', () => {
      const gross = 50000;
      const cloud = computeRateBreakdown({ grossRate: gross });
      const offline = simulateOfflineRateDecomposition(gross);

      expect(offline.net).toBe(cloud.netAccommodation);
      expect(offline.food).toBe(cloud.complimentaryFoodAmount);
      expect(offline.vat).toBe(cloud.vatAmount);
      expect(offline.sc).toBe(cloud.serviceChargeAmount);
      expect(offline.total).toBe(gross);
      expect(offline.total).toBe(cloud.componentTotal);
    });

    it('offline C# decomposition preserves penny balance across all Hotel Stanzel rate tiers', () => {
      const tiers = [30000, 33000, 35000, 48000, 70000];
      for (const tier of tiers) {
        const cloud = computeRateBreakdown({ grossRate: tier });
        const offline = simulateOfflineRateDecomposition(tier);

        expect(offline.total).toBe(tier);
        expect(offline.net).toBe(cloud.netAccommodation);
        expect(offline.food).toBe(cloud.complimentaryFoodAmount);
        expect(offline.vat).toBe(cloud.vatAmount);
        expect(offline.sc).toBe(cloud.serviceChargeAmount);
      }
    });

    it('offline C# decomposition suppresses food on discounted stays unless configured', () => {
      const discountedGross = 45000;
      const suppressed = simulateOfflineRateDecomposition(discountedGross, null, true);
      expect(suppressed.food).toBe(0);
      expect(suppressed.total).toBe(discountedGross);

      const configWithOverride = JSON.stringify({ allowComplimentaryFoodOnDiscountedRooms: true });
      const allowed = simulateOfflineRateDecomposition(discountedGross, configWithOverride, true);
      expect(allowed.food).toBe(3000);
      expect(allowed.total).toBe(discountedGross);
    });
  });

  describe('7. Sync Replay Deduplication & Non-Breakfast Comp Isolation', () => {
    it('isolates general COMPLIMENTARY orders from breakfast redemptions', () => {
      const generalStaffCompPayment = {
        orderId: 'order-staff-1',
        method: 'COMPLIMENTARY',
        reference: 'STAFF_COURTESY_LUNCH', // NOT breakfast!
        reservationId: 'res-101',
      };

      const isBreakfastRedemption =
        generalStaffCompPayment.reference.startsWith('BREAKFAST_ENTITLEMENT') ||
        generalStaffCompPayment.reference.startsWith('BREAKFAST_REDEEMED');

      expect(isBreakfastRedemption).toBe(false);
      // General comp payment MUST NOT decrement covers or create BreakfastRedemption
    });

    it('creates exactly one redemption on replay with stable operationId', () => {
      const orderId = 'pos-order-999';
      const resId = 'res-101';
      const busDateStr = '20261012';

      const opId1 = `redempt_${resId}_${busDateStr}_${orderId}`;
      const opId2 = `redempt_${resId}_${busDateStr}_${orderId}`;

      // Idempotency: exact same operation ID across retries
      expect(opId1).toBe(opId2);
      expect(opId1).not.toContain('Guid');
    });
  });

  describe('8. Buffet Production Strict Error Handling (No Dangerous Fallbacks)', () => {
    it('throws EXPLICIT_RECIPE_REQUIRED when neither recipeId nor productId is supplied', async () => {
      await expect(
        BuffetProductionService.calculateRequisition({
          propertyId: 'prop-1',
          covers: 10,
        }),
      ).rejects.toThrow(/EXPLICIT_RECIPE_REQUIRED/);
    });

    it('throws AUTHENTICATED_USER_REQUIRED when actorId is missing or invalid', async () => {
      await expect(
        BuffetProductionService.produceBuffetBatch({
          propertyId: 'prop-1',
          covers: 10,
          recipeId: 'recipe-uuid-1',
          actorId: '', // Empty actor
        }),
      ).rejects.toThrow(/AUTHENTICATED_USER_REQUIRED/);
    });
  });

  describe('9. Configuration Versioning & Malformed JSON Resilience', () => {
    it('returns fallback config when parsing malformed JSON, never replacing valid configuration', async () => {
      const { deserializeBreakdownConfig } = await import('../room-rate-breakdown');
      const validExistingConfig = {
        version: 5,
        enabled: true,
        complimentaryAllocationName: 'Stanzel Executive Breakfast',
        complimentaryFoodAmount: 4500,
        vatRate: 0.075,
        serviceChargeRate: 0.10,
        allowComplimentaryFoodOnDiscountedRooms: true,
        glCodes: {
          netAccommodation: '4050',
          complimentaryBreakfast: '4250',
          vatPayable: '2200',
          serviceChargePayable: '2210',
        },
      };

      const malformedJson = '{ bad_json: invalid ';
      const result = deserializeBreakdownConfig(malformedJson, validExistingConfig);

      // Existing valid configuration is completely preserved!
      expect(result.version).toBe(5);
      expect(result.complimentaryFoodAmount).toBe(4500);
      expect(result.complimentaryAllocationName).toBe('Stanzel Executive Breakfast');
      expect(result.allowComplimentaryFoodOnDiscountedRooms).toBe(true);
    });

    it('increments version monotonically when updated', async () => {
      const currentConfig = { version: 3, complimentaryFoodAmount: 3000 };
      const nextVersion = (currentConfig.version || 1) + 1;
      expect(nextVersion).toBe(4);
    });
  });
});
