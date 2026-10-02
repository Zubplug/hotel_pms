import { Prisma, PrismaClient } from '@hotel-pms/db';

type TxClient = Prisma.TransactionClient | PrismaClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NightlyRate {
  date: Date;          // The night being priced (checkIn date of that night)
  amount: number;      // Resolved rate in property currency
  source: 'SEASONAL' | 'RATE' | 'BASE_RATE';
  seasonalRateName?: string;
}

export interface PricingQuote {
  ratePlanId: string;
  roomTypeId: string;
  currency: string;
  nights: number;
  nightlyRates: NightlyRate[];
  subtotal: number;     // Sum of nightly amounts
  /** Deposit required at booking time (0 if paymentMode = PAY_LATER) */
  depositAmount: number;
  depositType: string | null;
  /** Full snapshot to persist on Reservation.ratePlanSnapshot */
  snapshot: PricingSnapshot;
}

export interface PricingSnapshot {
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  roomTypeId: string;
  roomTypeName: string;
  currency: string;
  nights: number;
  subtotal: number;
  depositAmount: number;
  depositType: string | null;
  paymentMode: string;
  nightlyRates: NightlyRate[];
  capturedAt: string; // ISO timestamp — snapshot is immutable after this
}

// ---------------------------------------------------------------------------
// ReservationPricingService
// ---------------------------------------------------------------------------

/**
 * Single authority for calculating Booking Engine room pricing.
 *
 * Resolution order per night:
 *   1. SeasonalRate  (exact date-range overlap, picks highest-priority = most-specific)
 *   2. Rate          (effectiveFrom/To window + dayOfWeek match)
 *   3. RoomType.baseRate  (final fallback)
 *
 * The returned PricingSnapshot is immutable — it MUST be written to
 * Reservation.ratePlanSnapshot at reservation creation time.
 *
 * This service is read-only. It never mutates any data.
 */
export const ReservationPricingService = {
  /**
   * Calculate a full pricing quote for the given room type + rate plan
   * over the requested date range.
   *
   * @param tx   A Prisma transaction client or the base prisma client.
   * @param opts Booking parameters.
   */
  async quote(
    tx: TxClient,
    opts: {
      propertyId: string;
      ratePlanId: string;
      roomTypeId: string;
      checkIn: Date;
      checkOut: Date;
      /** Override the booking-engine payment mode from BookingEngineConfig */
      paymentMode?: string;
    }
  ): Promise<PricingQuote> {
    const { propertyId, ratePlanId, roomTypeId, checkIn, checkOut } = opts;
    const paymentMode = opts.paymentMode ?? 'PAY_LATER';

    // --- Load rate plan (validates it exists and belongs to property) ---
    const ratePlan = await (tx as any).ratePlan.findFirst({
      where: { id: ratePlanId, propertyId, isActive: true, deletedAt: null },
      include: {
        depositPolicy: true,
        rates: {
          where: { roomTypeId },
          orderBy: { effectiveFrom: 'desc' },
        },
        seasonalRates: {
          where: {
            roomTypeId,
            startDate: { lte: checkOut },
            endDate: { gte: checkIn },
          },
          orderBy: [
            // Most specific (shortest range) first — acts as priority tiebreak
            { startDate: 'desc' },
            { endDate: 'asc' },
          ],
        },
      },
    });

    if (!ratePlan) {
      throw new Error(`RatePlan ${ratePlanId} not found or inactive for property ${propertyId}`);
    }

    // --- Load room type for base rate fallback ---
    const roomType = await (tx as any).roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, name: true, baseRate: true, currency: true },
    });
    if (!roomType) {
      throw new Error(`RoomType ${roomTypeId} not found`);
    }

    const currency: string = ratePlan.rates[0]?.currency ?? roomType.currency ?? 'NGN';

    // --- Resolve nightly rates ---
    const nights = nightCount(checkIn, checkOut);
    const nightlyRates: NightlyRate[] = [];

    for (let i = 0; i < nights; i++) {
      const night = addDays(checkIn, i);
      nightlyRates.push(resolveNightlyRate(night, ratePlan, roomType, currency));
    }

    const subtotal = nightlyRates.reduce((sum, n) => sum + n.amount, 0);

    // --- Resolve deposit ---
    const { depositAmount, depositType } = resolveDeposit(
      subtotal,
      nightlyRates,
      ratePlan.depositPolicy,
      paymentMode
    );

    const snapshot: PricingSnapshot = {
      ratePlanId,
      ratePlanCode: ratePlan.code,
      ratePlanName: ratePlan.name,
      roomTypeId,
      roomTypeName: roomType.name,
      currency,
      nights,
      subtotal,
      depositAmount,
      depositType,
      paymentMode,
      nightlyRates,
      capturedAt: new Date().toISOString(),
    };

    return {
      ratePlanId,
      roomTypeId,
      currency,
      nights,
      nightlyRates,
      subtotal,
      depositAmount,
      depositType,
      snapshot,
    };
  },

  /**
   * Validate that a guest's previously-captured quote snapshot is still valid
   * (i.e. the rate has not changed since the hold was created). Returns `true`
   * if the prices still match, `false` if they have drifted.
   *
   * Used at hold → reservation conversion to decide whether to re-price or
   * honour the locked-in quote.
   */
  async isSnapshotStillValid(
    tx: TxClient,
    snapshot: PricingSnapshot,
    opts: {
      propertyId: string;
      paymentMode?: string;
    }
  ): Promise<boolean> {
    try {
      const current = await ReservationPricingService.quote(tx, {
        propertyId: opts.propertyId,
        ratePlanId: snapshot.ratePlanId,
        roomTypeId: snapshot.roomTypeId,
        checkIn: new Date(snapshot.nightlyRates[0].date),
        checkOut: addDays(
          new Date(snapshot.nightlyRates[0].date),
          snapshot.nights
        ),
        paymentMode: opts.paymentMode ?? snapshot.paymentMode,
      });
      return Math.abs(current.subtotal - snapshot.subtotal) < 0.01;
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveNightlyRate(
  night: Date,
  ratePlan: any,
  roomType: any,
  currency: string
): NightlyRate {
  const nightDow = night.getDay(); // 0=Sun … 6=Sat

  // 1. SeasonalRate — first match wins (ordered most-specific first)
  for (const sr of ratePlan.seasonalRates ?? []) {
    const start = new Date(sr.startDate);
    const end = new Date(sr.endDate);
    if (night >= start && night < end) {
      return {
        date: night,
        amount: Number(sr.amount),
        source: 'SEASONAL',
        seasonalRateName: sr.name,
      };
    }
  }

  // 2. Rate (effectiveFrom/To + dayOfWeek)
  for (const r of ratePlan.rates ?? []) {
    const from = new Date(r.effectiveFrom);
    const to = r.effectiveTo ? new Date(r.effectiveTo) : null;
    const inWindow = night >= from && (!to || night < to);
    const dowMatch =
      !r.dayOfWeek ||
      (r.dayOfWeek as number[]).length === 0 ||
      (r.dayOfWeek as number[]).includes(nightDow);

    if (inWindow && dowMatch) {
      return {
        date: night,
        amount: Number(r.amount),
        source: 'RATE',
      };
    }
  }

  // 3. RoomType.baseRate fallback
  return {
    date: night,
    amount: Number(roomType.baseRate),
    source: 'BASE_RATE',
  };
}

function resolveDeposit(
  subtotal: number,
  nightlyRates: NightlyRate[],
  depositPolicy: any | null,
  paymentMode: string
): { depositAmount: number; depositType: string | null } {
  // PAY_LATER = no online payment required at booking
  if (paymentMode === 'PAY_LATER' || !depositPolicy || !depositPolicy.required) {
    return { depositAmount: 0, depositType: null };
  }

  if (paymentMode === 'FULL') {
    return { depositAmount: subtotal, depositType: 'FULL' };
  }

  // DEPOSIT mode — follow the deposit policy
  switch (depositPolicy.type) {
    case 'PERCENTAGE': {
      const pct = Number(depositPolicy.value) / 100;
      return {
        depositAmount: round2(subtotal * pct),
        depositType: 'PERCENTAGE',
      };
    }
    case 'FLAT': {
      return {
        depositAmount: Math.min(Number(depositPolicy.value), subtotal),
        depositType: 'FLAT',
      };
    }
    case 'FIRST_NIGHT': {
      const firstNight = nightlyRates[0]?.amount ?? 0;
      return { depositAmount: firstNight, depositType: 'FIRST_NIGHT' };
    }
    default:
      return { depositAmount: 0, depositType: null };
  }
}

function nightCount(checkIn: Date, checkOut: Date): number {
  return Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

