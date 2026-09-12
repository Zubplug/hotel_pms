import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { authenticateSyncRequest } from '@/lib/sync-auth';

/**
 * GET /api/v1/sync/pull
 *
 * Secure desktop sync pull endpoint for Incremental Synchronization.
 */
export async function GET(req: NextRequest) {
  try {
    const propertyId  = req.nextUrl.searchParams.get('propertyId');
    const cursorParam = req.nextUrl.searchParams.get('cursor');
    const sinceParam  = req.nextUrl.searchParams.get('since');
    const limitParam  = req.nextUrl.searchParams.get('limit') || '500';
    
    // Support both ?since= (legacy) and ?cursor=
    const rawCursor = cursorParam || sinceParam;
    const since = rawCursor ? new Date(rawCursor) : undefined;
    const limit = parseInt(limitParam, 10);

    // 1. Establish Server Watermark
    // This protects against race conditions where records are modified during the query.
    const watermark = new Date();

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Helper to build queries that respect the watermark and incremental cursor
    const buildWhere = (baseWhere: any) => {
      if (!since) {
        // Initial sync: fetch all valid records up to watermark
        return { ...baseWhere, updatedAt: { lte: watermark } };
      }
      // Incremental sync: fetch ANY record (including inactive/deleted) changed in the window
      return { 
        propertyId: baseWhere.propertyId, // keep scope (e.g. propertyId or outletId)
        updatedAt: { gt: since, lte: watermark }
      };
    };

    const buildOutletWhere = (baseWhere: any) => {
      if (!since) {
        return { ...baseWhere, updatedAt: { lte: watermark } };
      }
      return { 
        outletId: baseWhere.outletId, 
        updatedAt: { gt: since, lte: watermark }
      };
    };

    const buildOrganizationWhere = (baseWhere: any) => {
      if (!since) {
        return { ...baseWhere, updatedAt: { lte: watermark } };
      }
      return { 
        organizationId: baseWhere.organizationId, 
        updatedAt: { gt: since, lte: watermark }
      };
    };

    let terminalOutletId: string | undefined = undefined;
    if (authResult.success && authResult.isDevice && authResult.deviceId) {
      const terminal = await prisma.posTerminal.findUnique({ where: { id: authResult.deviceId } });
      if (terminal) {
        terminalOutletId = terminal.outletId;
      }
    }

    // ---- Load property config -------------------------------------------
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const noShowPolicy = await prisma.noShowPolicy.findFirst({
      where: { propertyId },
      orderBy: { name: 'asc' },
    });

    const cashAccounts = await prisma.cashAccount.findMany({
      where: buildWhere({ propertyId, isActive: true }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // We include active Front Desk sessions, PLUS any that have changed recently
    // so the desktop knows when a session is submitted/completed/approved.
    const twoDaysAgo = new Date(watermark.getTime() - 2 * 24 * 60 * 60 * 1000);
    const frontdeskSessionsWhere: any = since 
      ? {
          propertyId,
          OR: [
            { status: 'OPEN' as any },
            { updatedAt: { gt: since, lte: watermark } }
          ]
        }
      : {
          propertyId,
          updatedAt: { lte: watermark },
          OR: [
            { status: 'OPEN' as any },
            { closedAt: { gte: twoDaysAgo } }
          ]
        };

    const frontdeskSessions = await prisma.frontdeskSession.findMany({
      where: frontdeskSessionsWhere,
      include: { cashMovements: true },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // ---- Fetch Data -----------------------------------------------------
    // To support pagination across multiple tables, we fetch up to `limit` from EACH table,
    // then merge, sort by updatedAt, and slice the overall list to `limit`.

    const staffList = await prisma.staff.findMany({
      where: buildWhere({ propertyAccess: { has: propertyId }, isActive: true, deletedAt: null }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const rooms = await prisma.room.findMany({
      where: buildWhere({ propertyId, isActive: true }),
      include: {
        building: { select: { name: true } },
        floor: { select: { name: true, number: true } }
      },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const roomTypes = await prisma.roomType.findMany({
      where: buildWhere({ propertyId, isActive: true }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const corporateAccounts = await prisma.corporateAccount.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const ratePlans = await prisma.ratePlan.findMany({
      where: buildWhere({ propertyId, isActive: true }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const rates = await prisma.rate.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // Target window for Reservations: In-house + 3 days out + today's departures
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const resBaseWhere = {
      propertyId,
      deletedAt: null,
      OR: [
        { status: 'CHECKED_IN' },
        { status: 'CONFIRMED', checkIn: { lte: threeDaysFromNow, gte: yesterday } },
        { checkOut: { gte: yesterday, lte: threeDaysFromNow } }
      ]
    };

    const reservations = await prisma.reservation.findMany({
      where: buildWhere(resBaseWhere),
      include: {
        primaryGuest: true,
        reservationGuests: { include: { guest: true } },
        reservationRooms: { where: { status: 'ACTIVE' }, include: { room: true } },
        folios: { include: { items: true, payments: true, credits: true } },
        lockCredentials: true,
        lockOperations: { orderBy: { requestedAt: 'desc' }, take: 20 }
      },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // A folio can change without its reservation.updatedAt changing (for
    // example, a payment, room charge, or credit application). Pull folios as
    // first-class sync data so individual guest folios are not missed by an
    // incremental desktop pull.
    const foliosChangedSinceCursor = await prisma.folio.findMany({
      where: since
        ? { propertyId, updatedAt: { gt: since, lte: watermark } }
        : { propertyId, status: 'OPEN', updatedAt: { lte: watermark } },
      include: { items: true, payments: true, credits: true },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // POS Configuration
    const posOutletsWhere: any = { propertyId, isActive: true };
    if (terminalOutletId) {
      posOutletsWhere.id = terminalOutletId;
    }

    const posOutlets = await prisma.posOutlet.findMany({
      where: buildWhere(posOutletsWhere),
      include: { warehouse: { select: { id: true } } },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    
    const outletIds = posOutlets.map(o => o.id);
    const outletWarehouses = await prisma.warehouse.findMany({
      where: { propertyId, posOutletId: { in: outletIds }, isActive: true },
      select: { id: true },
    });
    const outletWarehouseIds = outletWarehouses.map((warehouse) => warehouse.id);
    // A POS terminal can sell kitchen items even when its physical outlet is
    // assigned to the bar. Sync all active production categories for the
    // property to offline tills; the assigned outlet is still used for
    // orders, tables, sessions, and inventory scope.
    const posCategoryWhere = terminalOutletId
      ? (!since
          ? { outlet: { propertyId }, isActive: true, updatedAt: { lte: watermark } }
          : { outlet: { propertyId }, updatedAt: { gt: since, lte: watermark } })
      : buildOutletWhere({ outletId: { in: outletIds }, isActive: true });
    const posCategories = await prisma.productCategory.findMany({
      where: posCategoryWhere,
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    
    const categoryIds = posCategories.map(c => c.id);
    const posProductsWhere: any = { propertyId, isActive: true };
    if (terminalOutletId) {
      posProductsWhere.categoryId = { in: categoryIds };
    }

    const posProducts = await prisma.posProduct.findMany({
      where: buildWhere(posProductsWhere),
      include: { modifiers: true, stockItems: { where: { isActive: true } } },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // Only inventory mapped to active POS recipes belongs on a POS terminal.
    // Warehouse-only stock (assets, cleaning supplies, housekeeping items, etc.)
    // must remain available to inventory users without being synced to tills.
    const recipes = await prisma.recipe.findMany({
      where: { propertyId, isActive: true },
      include: {
        versions: {
          where: { isActive: true },
          include: { ingredients: true },
        },
      },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    const posRecipeStockItemIds = Array.from(new Set(
      recipes.flatMap((recipe: any) => recipe.versions.flatMap((version: any) =>
        version.ingredients.map((ingredient: any) => ingredient.stockItemId)
      )).filter(Boolean)
    ));
    const posDirectStockItemIds = posProducts.flatMap((product: any) => [
      ...(product.stockItems || []).map((item: any) => item.id),
      ...(product.modifiers || []).map((modifier: any) => modifier.stockItemId),
    ]).filter(Boolean);
    const posMappedStockItemIds = Array.from(new Set([...posRecipeStockItemIds, ...posDirectStockItemIds]));

    // Inventory quantities are restricted to recipe-mapped items. On an
    // incremental pull, returning the mapped set also covers a newly-created
    // recipe link whose stock item itself has an older updatedAt timestamp.
    const stockWhere = since
      ? { propertyId, OR: [{ id: { in: posMappedStockItemIds } }, { warehouseId: { in: outletWarehouseIds } }] }
      : { ...buildWhere({ propertyId }), OR: [{ id: { in: posMappedStockItemIds } }, { warehouseId: { in: outletWarehouseIds } }] };
    const stockItems = await prisma.stockItem.findMany({
      where: stockWhere,
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const posFloorPlans = await prisma.posFloorPlan.findMany({
      where: buildOutletWhere({ outletId: { in: outletIds }, isActive: true }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const posTables = await prisma.posTable.findMany({
      where: { floorPlanId: { in: posFloorPlans.map((fp: any) => fp.id) }, ...(!since ? { isActive: true, updatedAt: { lte: watermark } } : { updatedAt: { gt: since, lte: watermark } }) },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    // ── POS Transactions (Sessions, Orders, KOTs, Payments) ──
    const buildPosSessionWhere = (baseWhere: any) => {
      if (!since) {
        const twoDaysAgo = new Date(watermark);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        return { 
            ...baseWhere, 
            updatedAt: { lte: watermark },
            OR: [
              { status: 'OPEN' },
              { status: 'RECONCILIATION_REQUIRED' },
              { closedAt: { gte: twoDaysAgo } }
            ]
        };
      }
      return {
        ...baseWhere,
        updatedAt: { gt: since, lte: watermark }
      };
    };

    const posSessions = await prisma.posSession.findMany({
      where: buildOutletWhere(buildPosSessionWhere({ outletId: { in: outletIds } })),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const buildPosOrderWhere = (baseWhere: any) => {
      if (!since) {
        const twoDaysAgo = new Date(watermark);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        return {
            ...baseWhere,
            updatedAt: { lte: watermark },
            OR: [
              // Keep every unpaid/non-terminal order available offline. Older
              // clients and imported orders may use OPEN/DRAFT-like statuses,
              // while the current enum uses SUBMITTED/IN_SERVICE.
              { status: { notIn: ['CLOSED', 'VOIDED'] }, paymentStatus: { not: 'PAID' } },
              { closedAt: { gte: twoDaysAgo } }
            ]
        };
      }
      return {
        ...baseWhere,
        updatedAt: { gt: since, lte: watermark }
      };
    };

    const posOrders = await prisma.posOrder.findMany({
      where: buildPosOrderWhere({ propertyId }),
      include: {
        items: { include: { modifiers: true } },
        checks: true,
        kots: { include: { items: true } },
        productionBatches: { include: { items: true } },
        payments: true
      },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const housekeepingTasks = await prisma.housekeepingTask.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const maintenanceTickets = await prisma.maintenanceTicket.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const laundryItems = await prisma.laundryItem.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    const laundryOrders = await prisma.laundryOrder.findMany({
      where: buildWhere({ propertyId }),
      include: {
        items: true,
        statusHistory: true,
      },
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    let allGuests: any[] = [];
    allGuests = await prisma.guest.findMany({
      where: buildWhere({ propertyId }),
      take: limit,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }]
    });

    // ---- Merge and Paginate ---------------------------------------------
    
    // We attach an entityType and extract the updatedAt to globally sort
    type SyncEntity = { type: string, updatedAt: Date, data: any };
    let allEntities: SyncEntity[] = [];

    staffList.forEach(s => allEntities.push({ type: 'Staff', updatedAt: s.updatedAt, data: s }));
    rooms.forEach(s => allEntities.push({ type: 'Room', updatedAt: s.updatedAt, data: s }));
    roomTypes.forEach(s => allEntities.push({ type: 'RoomType', updatedAt: s.updatedAt, data: s }));
    corporateAccounts.forEach(s => allEntities.push({ type: 'CorporateAccount', updatedAt: s.updatedAt, data: s }));
    ratePlans.forEach(s => allEntities.push({ type: 'RatePlan', updatedAt: s.updatedAt, data: s }));
    rates.forEach(s => allEntities.push({ type: 'Rate', updatedAt: s.updatedAt, data: s }));
    reservations.forEach(s => allEntities.push({ type: 'Reservation', updatedAt: s.updatedAt, data: s }));
    posOutlets.forEach(s => allEntities.push({ type: 'PosOutlet', updatedAt: s.updatedAt, data: s }));
    posCategories.forEach(s => allEntities.push({ type: 'ProductCategory', updatedAt: s.updatedAt, data: s }));
    posProducts.forEach(s => allEntities.push({ type: 'PosProduct', updatedAt: s.updatedAt, data: s }));
    posFloorPlans.forEach(s => allEntities.push({ type: 'PosFloorPlan', updatedAt: s.updatedAt, data: s }));
    posTables.forEach(s => allEntities.push({ type: 'PosTable', updatedAt: s.updatedAt, data: s }));
    posSessions.forEach(s => allEntities.push({ type: 'PosSession', updatedAt: s.updatedAt, data: s }));
    posOrders.forEach(s => allEntities.push({ type: 'PosOrder', updatedAt: s.updatedAt, data: s }));
    housekeepingTasks.forEach(s => allEntities.push({ type: 'HousekeepingTask', updatedAt: s.updatedAt, data: s }));
    maintenanceTickets.forEach(s => allEntities.push({ type: 'MaintenanceTicket', updatedAt: s.updatedAt, data: s }));
    laundryItems.forEach(s => allEntities.push({ type: 'LaundryItem', updatedAt: s.updatedAt, data: s }));
    laundryOrders.forEach(s => allEntities.push({ type: 'LaundryOrder', updatedAt: s.updatedAt, data: s }));
    allGuests.forEach(s => allEntities.push({ type: 'Guest', updatedAt: s.updatedAt, data: s }));

    // Sort globally by updatedAt ascending
    allEntities.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    let hasMore = false;
    let nextCursor = watermark.toISOString();

    if (allEntities.length > limit) {
      // Find the safe cutoff timestamp
      const cutoffEntity = allEntities[limit - 1];
      const cutoffTime = cutoffEntity.updatedAt.getTime();
      
      // To prevent skipping records with identical timestamps, we must include ALL records 
      // up to the exact cutoffTime, even if it slightly exceeds the limit.
      const safeEntities = allEntities.filter(e => e.updatedAt.getTime() <= cutoffTime);
      
      if (safeEntities.length < allEntities.length) {
        hasMore = true;
      }
      
      allEntities = safeEntities;
      nextCursor = new Date(cutoffTime).toISOString();
    }

    // Now re-group back into arrays
    const finalStaff = allEntities.filter(e => e.type === 'Staff').map(e => e.data);
    const finalRooms = allEntities.filter(e => e.type === 'Room').map(e => e.data);
    const finalRoomTypes = allEntities.filter(e => e.type === 'RoomType').map(e => e.data);
    // A reservation carries a corporateAccountId foreign key, so the account
    // must travel with the reservation even when global pagination splits the
    // account and reservation into different pages. Without this dependency
    // closure, desktop stores the ID but cannot hydrate CorporateAccount and
    // incorrectly reports "Corporate Link Missing Offline".
    let finalCorporateAccounts = allEntities.filter(e => e.type === 'CorporateAccount').map(e => e.data);
    const finalRatePlans = allEntities.filter(e => e.type === 'RatePlan').map(e => e.data);
    const finalRates = allEntities.filter(e => e.type === 'Rate').map(e => e.data);
    const finalReservations = allEntities.filter(e => e.type === 'Reservation').map(e => e.data);
    const finalOutlets = allEntities.filter(e => e.type === 'PosOutlet').map(e => e.data);
    const finalCategories = allEntities.filter(e => e.type === 'ProductCategory').map(e => e.data);
    const finalProducts = allEntities.filter(e => e.type === 'PosProduct').map(e => e.data);
    const finalFloorPlans = allEntities.filter(e => e.type === 'PosFloorPlan').map(e => e.data);
    const finalTables = allEntities.filter(e => e.type === 'PosTable').map(e => e.data);
    const finalPosSessions = allEntities.filter(e => e.type === 'PosSession').map(e => e.data);
    const finalPosOrders = allEntities.filter(e => e.type === 'PosOrder').map(e => e.data);
    const finalHousekeepingTasks = allEntities.filter(e => e.type === 'HousekeepingTask').map(e => e.data);
    const finalMaintenanceTickets = allEntities.filter(e => e.type === 'MaintenanceTicket').map(e => e.data);
    const finalLaundryItems = allEntities.filter(e => e.type === 'LaundryItem').map(e => e.data);
    const finalLaundryOrders = allEntities.filter(e => e.type === 'LaundryOrder').map(e => e.data);
    const finalGuests = allEntities.filter(e => e.type === 'Guest').map(e => e.data);

    const referencedCorporateAccountIds = [...new Set(
      finalReservations
        .map((reservation: any) => reservation.corporateAccountId)
        .filter(Boolean),
    )];
    if (referencedCorporateAccountIds.length > 0) {
      const includedCorporateAccountIds = new Set(
        finalCorporateAccounts.map((account: any) => account.id),
      );
      const missingCorporateAccounts = await prisma.corporateAccount.findMany({
        where: {
          propertyId,
          id: { in: referencedCorporateAccountIds },
          updatedAt: { lte: watermark },
        },
      });
      finalCorporateAccounts = [
        ...finalCorporateAccounts,
        ...missingCorporateAccounts.filter((account) => !includedCorporateAccountIds.has(account.id)),
      ];
    }

    // Existing desktop reservations may already be cached locally, so they
    // may not appear in an incremental reservation page after a corporate link
    // is added. Always include active accounts as small reference data so the
    // local CorporateAccount navigation can be hydrated before offline check-in.
    const activeCorporateAccounts = await prisma.corporateAccount.findMany({
      where: { propertyId, isActive: true },
    });
    const mergedCorporateAccountIds = new Set(
      finalCorporateAccounts.map((account: any) => account.id),
    );
    finalCorporateAccounts = [
      ...finalCorporateAccounts,
      ...activeCorporateAccounts.filter((account) => !mergedCorporateAccountIds.has(account.id)),
    ];

    // Pending discount requests are not written to ReservationRoom until the
    // night auditor approves them. Include their immutable request snapshot so
    // offline front desk can show the request status without treating it as an
    // approved price change.
    const pendingDiscounts = await prisma.approvalRequest.findMany({
      where: { propertyId, type: 'DISCOUNT', status: 'PENDING' },
      select: { id: true, reason: true, snapshot: true, details: true },
    });
    const pendingDiscountByRoom = new Map<string, any>();
    for (const approval of pendingDiscounts) {
      const snapshot: any = approval.snapshot || approval.details || {};
      const roomId = snapshot.reservationRoomId;
      if (snapshot.targetType === 'RESERVATION_ROOM' && roomId) {
        pendingDiscountByRoom.set(roomId, {
          id: approval.id,
          type: snapshot.discountType,
          amount: Number(snapshot.discountAmount || 0),
          percent: Number(snapshot.discountPercent || 0),
          reason: snapshot.reason || approval.reason,
        });
      }
    }

    // Shared corporate folios are independent of reservation.updatedAt. They
    // must be included on incremental pulls as well, otherwise a payment,
    // credit application, or night-audit correction on the ledger never
    // reaches the desktop unless one of the linked reservations changes.
    const sharedCorporateFolios = await prisma.folio.findMany({
      where: {
        propertyId,
        type: 'CITY_LEDGER',
        status: 'OPEN',
      },
      include: { items: true, payments: true, credits: true },
    });
    const sharedCorporateFolioByAccount = new Map(
      sharedCorporateFolios.map((folio: any) => [folio.corporateAccountId, folio]),
    );

    // Flatten Guests and Folios from the resulting reservations
    const guestMap = new Map<string, any>();
    finalGuests.forEach(g => guestMap.set(g.id, g));
    const folioById = new Map<string, any>();
    const addFolio = (folio: any) => {
      if (folio?.id) folioById.set(folio.id, folio);
    };
    const plainReservations = finalReservations.map(r => {
      if (r.primaryGuest) guestMap.set(r.primaryGuest.id, r.primaryGuest);
      r.reservationGuests.forEach((rg: any) => { if (rg.guest) guestMap.set(rg.guest.id, rg.guest); });
      r.folios.forEach((f: any) => addFolio(f));
      const sharedCorporateFolio = r.corporateAccountId
        ? sharedCorporateFolioByAccount.get(r.corporateAccountId)
        : null;
      if (sharedCorporateFolio && !r.folios.some((f: any) => f.id === sharedCorporateFolio.id)) {
        addFolio(sharedCorporateFolio);
      }

      const roomId = r.reservationRooms?.[0]?.roomId || null;
      const roomNumber = r.reservationRooms?.[0]?.room?.number || null;
      const roomTypeId = r.reservationRooms?.[0]?.room?.roomTypeId || null;
      const reservationRoom = r.reservationRooms?.[0] || null;
      const pendingDiscount = reservationRoom?.id ? pendingDiscountByRoom.get(reservationRoom.id) : null;

      const { primaryGuest, reservationGuests, folios: rFolios, reservationRooms, ...rest } = r;
      // Reservation rooms are flattened for the desktop cache. Keep the
      // approved pricing adjustment fields in that flattened record too;
      // otherwise offline detail pages can only display the room type's full
      // base rate after a discount has been approved in the cloud.
      return {
        ...rest,
        roomId,
        roomNumber,
        roomTypeId,
        // Keep the reservation-room identity stable on the desktop. This is
        // different from the physical Room.id and is required by follow-up
        // offline events such as discount and complimentary requests.
        reservationRoomId: reservationRoom?.id ?? null,
        discountType: reservationRoom?.discountType ?? null,
        discountAmount: reservationRoom?.discountAmount ?? null,
        discountPercent: reservationRoom?.discountPercent ?? null,
        discountReason: reservationRoom?.discountReason ?? null,
        discountApprovalId: reservationRoom?.discountApprovalId ?? null,
        pendingDiscountType: pendingDiscount?.type ?? null,
        pendingDiscountAmount: pendingDiscount?.amount ?? null,
        pendingDiscountPercent: pendingDiscount?.percent ?? null,
        pendingDiscountReason: pendingDiscount?.reason ?? null,
        pendingDiscountApprovalId: pendingDiscount?.id ?? null,
      };
    });

    sharedCorporateFolios.forEach(addFolio);
    foliosChangedSinceCursor.forEach(addFolio);
    const folios = Array.from(folioById.values());
    
    // Resolve permissions for staff
    const staffWithPermissions = await Promise.all(
      finalStaff.map(async (staff: any) => {
        let permissions: string[] = [];
        let roleName = '';
        let hasPosAccess = false;
        
        if (staff.userId) {
          const userRoles = await prisma.userRole.findMany({
            where: { userId: staff.userId, OR: [{ propertyId }, { propertyId: null }] },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
          });

          permissions = Array.from(new Set<string>(
            userRoles.flatMap((ur: any) => ur.role.permissions.map((rp: any) => rp.permission.name))
          ));
          roleName = userRoles[0]?.role?.name ?? staff.position;

          hasPosAccess = permissions.some(p =>
            p === 'ACCESS_POS' || p === 'ACCESS_FRONT_DESK' || p.startsWith('ACCESS_KEYCARD')
          ) || ['RECEPTIONIST', 'MANAGER', 'ADMIN', 'WAITER', 'FNB_MANAGER', 'HOTEL_MANAGER', 'SUPER_ADMIN'].includes(staff.position?.toUpperCase() ?? '');
        }

        // Fetch which outlets this staff member can operate in
        const outletAccess = await prisma.staffPosOutletAccess.findMany({
          where: { staffId: staff.id },
          select: { outletId: true },
        });
        const allowedOutletIds = outletAccess.map((a: any) => a.outletId);

        return {
          id:              staff.id,
          firstName:       staff.firstName,
          lastName:        staff.lastName,
          role:            roleName || staff.position,
          posPinHash:      staff.posPinHash ?? null,
          posTokenVersion: staff.posTokenVersion,
          isActive:        staff.isActive,
          hasPosAccess,
          permissionsJson: JSON.stringify(permissions),
          allowedOutletIds,
        };
      })
    );

    const settings = (property.settings as Record<string, unknown>) ?? {};
    const financialControls = (settings.financialControls as Record<string, unknown>) ?? {};
    const propertyPayload = {
      id: property.id,
      name: property.name,
      currency: property.baseCurrency,
      timezone: property.timezone,
      businessDate: property.businessDate,
      auditStatus: property.auditStatus,
      isActive: property.isActive,
      earlyCheckinWindowHours: (settings.earlyCheckinWindowHours as number) ?? 2,
      bankingModel: ((settings.pos as any)?.bankingModel as string) ?? 'CENTRAL_CASHIER',
      depositApprovalThreshold: Number(financialControls.depositApprovalThreshold ?? 250000),
      creditAdjustmentApprovalThreshold: Number(financialControls.creditAdjustmentApprovalThreshold ?? 1),
      refundApprovalThreshold: Number(financialControls.refundApprovalThreshold ?? 1),
      offlineHighValueDepositPolicy: String(financialControls.offlineHighValueDepositPolicy ?? 'BLOCK').toUpperCase(),
      noShowCutoffTime: noShowPolicy?.cutoffTime ?? '02:00',
      noShowGracePeriodMinutes: noShowPolicy?.gracePeriodMinutes ?? 0,
      noShowChargeType: noShowPolicy?.chargeType ?? 'FIRST_NIGHT',
      noShowChargeValue: Number(noShowPolicy?.chargeValue ?? 0),
      noShowRefundableUnusedNights: noShowPolicy?.refundableUnusedNights ?? true,
      noShowAllowReinstatement: noShowPolicy?.allowReinstatement ?? true,
      noShowReinstatementRequiresApproval: noShowPolicy?.reinstatementRequiresApproval ?? true,
    };

    return NextResponse.json({
      // Pagination metadata
      syncedAt:   nextCursor,
      hasMore:    hasMore,
      
      property:   propertyPayload,
      cashAccounts,
      frontdeskSessions,
      staff:      staffWithPermissions,
      rooms:      finalRooms,
      roomTypes:  finalRoomTypes,
      corporateAccounts: finalCorporateAccounts,
      ratePlans: finalRatePlans,
      rates: finalRates,
      reservations: plainReservations,
      guests:     Array.from(guestMap.values()),
      folios,
      posOutlets: finalOutlets,
      posCategories: finalCategories,
      posProducts: finalProducts,
      stockItems,
      recipes,
      posFloorPlans: finalFloorPlans,
      posTables:  finalTables,
      posSessions: finalPosSessions,
      posOrders: finalPosOrders,
      housekeepingTasks: finalHousekeepingTasks,
      maintenanceTickets: finalMaintenanceTickets,
      laundryItems: finalLaundryItems,
      laundryOrders: finalLaundryOrders
    });

  } catch (error: any) {
    console.error('[sync/pull] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
