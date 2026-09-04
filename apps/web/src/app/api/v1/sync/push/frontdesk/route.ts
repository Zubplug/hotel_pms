import { NextRequest, NextResponse } from "next/server";
import { authenticateSyncRequest } from "@/lib/sync-auth";
import prisma from "@hotel-pms/db";
import { createHash, randomUUID } from "crypto";
import { compare } from "bcryptjs";
import { NotificationEngine } from "@/lib/notification-engine";
import { encrypt } from "@/lib/encryption";
import { getReducedStayEstimate } from "@/lib/refunds/reduced-stay";
import { calculateNoShowAssessment } from "@/lib/refunds/no-show";
import { calculateFolioTotals } from "@/lib/finance/folio-totals";
import { applyAvailableFolioCredit } from "@/lib/finance/apply-folio-credit";
import { isNightAuditCutoverActive } from "@/lib/night-audit-guard";
import { getPropertyBusinessDate } from "@/lib/date-utils";

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

async function queueCancellationRefunds(
  tx: any,
  reservation: any,
  propertyId: string,
  organizationId: string,
  requestedById: string,
  reason: string,
) {
  const workflowRules = await tx.refundApprovalRule.findMany({
    where: { propertyId, isActive: true },
    orderBy: { stepOrder: "asc" },
  });
  for (const folio of reservation.folios || []) {
    for (const payment of folio.payments || []) {
      if (payment.status !== "COMPLETED") continue;
      const refunded = payment.refunds
        .filter((refund: any) => refund.status !== "FAILED")
        .reduce((sum: number, refund: any) => sum + Number(refund.amount), 0);
      const pending = await tx.refundRequest.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: ["PENDING_APPROVAL", "APPROVED", "PROCESSING"] as any },
        },
        _sum: { requestedAmount: true },
      });
      const amount =
        Number(payment.amount) -
        refunded -
        Number(pending._sum.requestedAmount || 0);
      if (amount <= 0) continue;
      const idempotencyKey = `reservation_cancel_refund_${reservation.id}_${payment.id}`;
      if (await tx.refundRequest.findUnique({ where: { idempotencyKey } }))
        continue;
      const matchingRules = workflowRules.filter(
        (rule: any) =>
          (rule.minAmount == null || amount >= Number(rule.minAmount)) &&
          (rule.maxAmount == null || amount <= Number(rule.maxAmount)),
      );
      const firstRule = matchingRules[0];
      const fallbackRoleName =
        amount > 250000
          ? "FINANCE_MANAGER"
          : amount > 50000
            ? "MANAGER"
            : "FRONT_DESK_MANAGER";
      const role = firstRule?.roleId
        ? await tx.role.findUnique({ where: { id: firstRule.roleId } })
        : await tx.role.findFirst({
            where: { organizationId, name: fallbackRoleName },
          });
      const candidate = firstRule?.approverId
        ? { userId: firstRule.approverId }
        : role
          ? await tx.userRole.findFirst({
              where: {
                roleId: role.id,
                userId: { not: requestedById },
                OR: [{ propertyId }, { propertyId: null }],
              },
              select: { userId: true },
            })
          : null;
      const request = await tx.refundRequest.create({
        data: {
          organizationId,
          propertyId,
          reservationId: reservation.id,
          folioId: folio.id,
          paymentId: payment.id,
          guestId: reservation.primaryGuestId,
          requestedAmount: amount,
          currency: payment.currency,
          requestedMethod: "ORIGINAL_PAYMENT",
          category: "RESERVATION_CANCELLED",
          reason: `Reservation cancelled: ${reason}`,
          requestedById,
          currentApproverId: candidate?.userId,
          approvalRoleId: role?.id,
          currentApprovalStep: firstRule?.stepOrder || 1,
          idempotencyKey,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.approvalRequest.create({
        data: {
          propertyId,
          type: "REFUND",
          status: "PENDING",
          requestedBy: requestedById,
          amount,
          currency: payment.currency,
          reason: request.reason,
          details: {
            refundRequestId: request.id,
            category: request.category,
            requestedAmount: amount,
            requestedMethod: "ORIGINAL_PAYMENT",
            approverRoleId: role?.id,
            approverId: candidate?.userId,
            stepOrder: firstRule?.stepOrder || 1,
          },
          expiresAt: request.expiresAt,
        },
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = await req.json();
    const { propertyId, events } = body;
    console.info(
      `[sync/frontdesk-push] request=${requestId} received propertyId=${propertyId ?? "missing"} events=${Array.isArray(events) ? events.length : "invalid"}`,
    );

    if (!propertyId || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 },
      );
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      console.warn(
        `[sync/frontdesk-push] request=${requestId} rejected propertyId=${propertyId} error=${authResult.error}`,
      );
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
    if (!authResult.isDevice) {
      console.warn(
        `[sync/frontdesk-push] request=${requestId} rejected propertyId=${propertyId} error=Must be a device`,
      );
      return NextResponse.json({ error: "Must be a device" }, { status: 403 });
    }

    // Verify terminal and property
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    if (await isNightAuditCutoverActive(propertyId)) {
      return NextResponse.json(
        {
          error:
            "Night audit is in progress. Financial synchronization is temporarily paused.",
        },
        { status: 409 },
      );
    }

    const device = { id: authResult.deviceId as string };
    const authoritativeBusinessDate =
      property.businessDate ||
      getPropertyBusinessDate("Africa/Lagos", new Date());

    console.info(
      `[sync/frontdesk-push] request=${requestId} authorized terminalId=${device.id} propertyId=${propertyId} events=${events.length}`,
    );

    const results = [];

    // Process outbox events sequentially
    for (const event of events) {
      const {
        id,
        idempotencyKey,
        aggregateType,
        aggregateId: rawAggregateId,
        aggregateVersion,
        eventType,
        occurredAt,
        sequence,
        payloadJson,
        operatorId,
      } = event;

      try {
        const payload = JSON.parse(payloadJson || "{}");
        let resultStatus = "SYNCED";
        let aggregateId = rawAggregateId;
        if (
          aggregateType === "FOLIO" &&
          eventType === "POST_PAYMENT" &&
          payload.reservationId
        ) {
          const targetFolio = await prisma.folio.findFirst({
            where: { id: aggregateId, propertyId },
            select: { id: true },
          });
          if (!targetFolio) {
            const reservationFolio = await prisma.folio.findFirst({
              where: {
                reservationId: payload.reservationId,
                propertyId,
                status: "OPEN",
              },
              select: { id: true },
            });
            if (reservationFolio) aggregateId = reservationFolio.id;
          }
        }
        const actorId = isUuid(operatorId) ? operatorId : device.id;
        const sessionBoundEvents = new Set([
          "ROOM_CHARGE",
          "POST_CHARGE",
          "POST_PAYMENT",
          "ADVANCE_DEPOSIT",
          "ADVANCE_DEPOSIT_REQUEST",
          "CREDIT_ADJUSTMENT_REQUEST",
          "ROOM_CREDIT",
          "REFUND_REQUESTED",
        ]);
        let sessionBusinessDate: Date | null = null;
        if (
          sessionBoundEvents.has(eventType) &&
          payload.frontdeskTransaction !== false
        ) {
          const frontdeskSessionId = payload.frontdeskSessionId;
          if (!frontdeskSessionId)
            throw new Error(
              "FRONTDESK_SHIFT_REQUIRED: Transaction has no cashier session.",
            );
          const frontdeskSession = await prisma.frontdeskSession.findUnique({
            where: { id: frontdeskSessionId },
          });
          if (
            !frontdeskSession ||
            frontdeskSession.propertyId !== propertyId ||
            frontdeskSession.status !== "OPEN" ||
            frontdeskSession.staffId !== actorId
          ) {
            throw new Error(
              "FRONTDESK_SHIFT_CLOSED: Cashier session is missing, closed, or belongs to another receptionist.",
            );
          }
          sessionBusinessDate = frontdeskSession.businessDate;
        }

        // 1 & 2. Atomic Concurrency Control & Execution within a Single Transaction
        await prisma.$transaction(async (tx) => {
          // 1. Idempotency Check (inside transaction lock)
          const existingEvent = await tx.hotelEvent.findUnique({
            where: { idempotencyKey },
            include: { syncConflict: true },
          });

          if (existingEvent) {
            const e = new Error("IDEMPOTENCY_DUPLICATE");
            (e as any).existingEvent = existingEvent;
            throw e;
          }

          let updatedCount = 0;

          if (aggregateType === "FRONTDESK_SESSION") {
            updatedCount = 1;
          } else if (aggregateType === "FOLIO") {
            const res = await tx.folio.updateMany({
              where: { id: aggregateId, version: aggregateVersion },
              data: { version: { increment: 1 } },
            });
            updatedCount = res.count;
          } else if (aggregateType === "RESERVATION") {
            if (eventType === "CREATE") {
              updatedCount = 1; // Bypass version lock since it doesn't exist yet
            } else {
              const res = await tx.reservation.updateMany({
                where: { id: aggregateId, version: aggregateVersion },
                data: { version: { increment: 1 } },
              });
              updatedCount = res.count;

              // Safe version-mismatch bypass for CHECK_OUT.
              // Night Audit folio operations can increment the server version
              // while the desktop still holds an older cached version. A checkout
              // is idempotent and safe to force-apply when:
              //   (a) the reservation is still CHECKED_IN (not already checked out), AND
              //   (b) the folio balance is zero (no outstanding charges or refunds).
              // If the reservation is already CHECKED_OUT (e.g. processed server-side
              // while the desktop was offline), we also succeed silently — pure idempotency.
              if (updatedCount === 0 && eventType === "CHECK_OUT") {
                const current = await tx.reservation.findUnique({
                  where: { id: aggregateId },
                  select: { status: true },
                });
                if (current?.status === "CHECKED_OUT") {
                  // Already checked out — idempotent, succeed silently
                  updatedCount = 1;
                  console.log(
                    `[sync/push] CHECK_OUT idempotent accept for already-CHECKED_OUT reservation ${aggregateId}`
                  );
                } else if (current?.status === "CHECKED_IN") {
                  const folioBalances = await tx.folio.findMany({
                    where: { reservationId: aggregateId, propertyId },
                    select: { balance: true },
                  });
                  const totalBalance = folioBalances.reduce(
                    (sum: number, f: any) => sum + Number(f.balance), 0
                  );
                  if (Math.abs(totalBalance) <= 0.01) {
                    // Accept at current server version — bump version to maintain monotonicity
                    await tx.reservation.updateMany({
                      where: { id: aggregateId },
                      data: { version: { increment: 1 } },
                    });
                    updatedCount = 1;
                    console.log(
                      `[sync/push] CHECK_OUT version-mismatch auto-resolved for ${aggregateId} ` +
                      `(desktop v${aggregateVersion}, balance ${totalBalance})`
                    );
                  }
                }
              }
            }
          } else if (
            aggregateType === "HOUSEKEEPING_TASK" ||
            aggregateType === "MAINTENANCE_TICKET" ||
            aggregateType === "GUEST" ||
            aggregateType === "ROOM" ||
            aggregateType === "LAUNDRY_ORDER"
          ) {
            updatedCount = 1; // No version field on cloud for these yet
          }

          if (updatedCount === 0) {
            if (aggregateType === "RESERVATION" && eventType !== "CREATE") {
              const reservation = await tx.reservation.findUnique({
                where: { id: aggregateId },
              });
              if (!reservation)
                throw new Error(
                  `DEPENDENCY_NOT_READY: Reservation ${aggregateId} has not been created yet`,
                );
            }

            // Retrieve actual version to report in the conflict
            let currentVersion = 1;
            if (aggregateType === "FOLIO") {
              const f = await tx.folio.findUnique({
                where: { id: aggregateId },
              });
              if (f) currentVersion = f.version;
            } else if (aggregateType === "RESERVATION") {
              const r = await tx.reservation.findUnique({
                where: { id: aggregateId },
              });
              if (r) currentVersion = r.version;
            }

            const e = new Error("CONCURRENCY_CONFLICT");
            (e as any).currentVersion = currentVersion;
            throw e;
          }

          // Authoritative Domain Routing
          if (
            aggregateType === "FRONTDESK_SESSION" &&
            eventType === "FRONTDESK_SESSION_OPENED"
          ) {
            const sessionId = payload.sessionId || aggregateId;
            // LocalRepository serializes nested session members with their C# names
            // (BusinessDate / ShiftReference), while the explicitly named members are camelCase.
            const businessDateValue =
              payload.businessDate ?? payload.BusinessDate;
            const businessDate = new Date(businessDateValue);
            const shiftReference =
              payload.shiftReference ?? payload.ShiftReference;
            if (Number.isNaN(businessDate.getTime())) {
              throw new Error(
                "Invalid FRONTDESK_SESSION_OPENED payload: businessDate is required.",
              );
            }
            if (!shiftReference) {
              throw new Error(
                "Invalid FRONTDESK_SESSION_OPENED payload: shiftReference is required.",
              );
            }
            const existingSession = await tx.frontdeskSession.findUnique({
              where: { id: sessionId },
            });
            if (!existingSession) {
              await tx.frontdeskSession.create({
                data: {
                  id: sessionId,
                  propertyId,
                  staffId: payload.staffId || actorId,
                  cashAccountId: payload.cashAccountId,
                  shiftReference,
                  businessDate,
                  openingFloat: Number(payload.openingFloat || 0),
                  systemExpectedCash: Number(payload.openingFloat || 0),
                },
              });
              await tx.frontdeskSessionAudit.create({
                data: {
                  frontdeskSessionId: sessionId,
                  action: "OPENED",
                  performedBy: actorId,
                  notes: "Offline session synchronized",
                },
              });
            }
          } else if (
            aggregateType === "FRONTDESK_SESSION" &&
            eventType === "FRONTDESK_SESSION_CLOSED"
          ) {
            const sessionId = payload.sessionId || aggregateId;
            const current = await tx.frontdeskSession.findUnique({
              where: { id: sessionId },
              include: { cashMovements: true },
            });
            if (!current)
              throw new Error(
                `DEPENDENCY_NOT_READY: Front Desk session ${sessionId} has not been created yet`,
              );
            if (
              [
                "APPROVED",
                "APPROVED_WITH_VARIANCE",
                "HANDOVER_PENDING",
                "HANDED_OVER",
                "DEPOSITED",
                "RECONCILED",
              ].includes(String(current.controlStatus))
            ) {
              throw new Error(
                "CONCURRENCY_CONFLICT: controlled Front Desk shift cannot be closed again",
              );
            }
            const movementTotal = (types: string[]) =>
              current.cashMovements
                .filter((movement: any) => types.includes(movement.type))
                .reduce(
                  (sum: number, movement: any) =>
                    sum + Number(movement.amount || 0),
                  0,
                );
            const expectedCash =
              Number(current.openingFloat || 0) +
              movementTotal(["PAYMENT", "CASH_IN", "CASH_TRANSFER_IN"]) -
              movementTotal([
                "REFUND",
                "PAID_OUT",
                "CASH_DROP",
                "CASH_TRANSFER_OUT",
              ]);
            const declaredCash = Number(payload.declaredCash || 0);
            const variance = declaredCash - expectedCash;
            await tx.frontdeskSession.update({
              where: { id: sessionId },
              data: {
                status: "CLOSED",
                controlStatus: "SUBMITTED",
                varianceStatus: variance === 0 ? null : "OPEN",
                submittedAt: occurredAt ? new Date(occurredAt) : new Date(),
                submittedBy: actorId,
                closingAt: occurredAt ? new Date(occurredAt) : new Date(),
                closedAt: occurredAt ? new Date(occurredAt) : new Date(),
                declaredCash,
                systemExpectedCash: expectedCash,
                variance,
              },
            });
            await tx.frontdeskSessionAudit.create({
              data: {
                frontdeskSessionId: sessionId,
                action: "CLOSED",
                performedBy: actorId,
                notes: "Offline close synchronized",
              },
            });
          } else if (
            aggregateType === "FRONTDESK_SESSION" &&
            eventType === "FRONTDESK_SESSION_REVIEWED"
          ) {
            const sessionId = payload.sessionId || aggregateId;
            const current = await tx.frontdeskSession.findUnique({
              where: { id: sessionId },
            });
            if (!current)
              throw new Error(
                `DEPENDENCY_NOT_READY: Front Desk session ${sessionId} has not been created yet`,
              );
            if (current.staffId === actorId)
              throw new Error(
                "SEGREGATION_OF_DUTIES: Operator cannot approve their own shift",
              );
            if (
              [
                "APPROVED",
                "APPROVED_WITH_VARIANCE",
                "HANDOVER_PENDING",
                "HANDED_OVER",
                "DEPOSITED",
                "RECONCILED",
              ].includes(String(current.controlStatus))
            ) {
              throw new Error(
                "CONCURRENCY_CONFLICT: controlled Front Desk shift cannot be reviewed again",
              );
            }
            const decision = String(payload.decision || "").toUpperCase();
            let nextControlStatus =
              decision === "APPROVED_WITH_VARIANCE"
                ? "APPROVED_WITH_VARIANCE"
                : decision === "APPROVED"
                  ? "APPROVED"
                  : "RETURNED";
            let nextStatus = "CLOSED";
            let handoverId = null;

            if (
              nextControlStatus === "APPROVED" ||
              nextControlStatus === "APPROVED_WITH_VARIANCE"
            ) {
              handoverId = randomUUID();
              await tx.cashHandover.create({
                data: {
                  id: handoverId,
                  propertyId: current.propertyId,
                  handoverReference: `HO-${Date.now()}-${randomUUID().split("-")[0].toUpperCase().substring(0, 4)}`,
                  amount: Number(current.declaredCash || 0),
                  handedOverById: current.staffId,
                  notes:
                    "Automatically created upon offline shift approval sync.",
                  status: "PENDING",
                },
              });
              await tx.shiftControlAudit.create({
                data: {
                  id: randomUUID(),
                  propertyId: current.propertyId,
                  frontdeskSessionId: sessionId,
                  action: "HANDOVER_CREATED",
                  fromStatus: nextControlStatus,
                  toStatus: "HANDOVER_PENDING",
                  performedBy: actorId,
                  idempotencyKey: `audit_ho_${randomUUID()}`,
                },
              });
              nextControlStatus = "HANDOVER_PENDING";
              nextStatus = "HANDOVER_PENDING";
            }

            await tx.frontdeskSession.update({
              where: { id: sessionId },
              data: {
                status: nextStatus as any,
                controlStatus: nextControlStatus as any,
                cashHandoverId: handoverId,
                varianceStatus:
                  decision === "APPROVED_WITH_VARIANCE"
                    ? "ACCEPTED"
                    : current.varianceStatus,
                approvalDecision: decision,
                approvalNotes: payload.notes || null,
                approvedBy: decision === "REJECTED" ? null : actorId,
                approvedAt:
                  decision === "REJECTED"
                    ? null
                    : payload.reviewedAt
                      ? new Date(payload.reviewedAt)
                      : new Date(),
              },
            });
            await tx.frontdeskSessionAudit.create({
              data: {
                frontdeskSessionId: sessionId,
                action: "REVIEWED",
                performedBy: actorId,
                notes: payload.notes || `Decision: ${decision}`,
              },
            });
          } else if (
            eventType === "CREATE" &&
            aggregateType === "RESERVATION"
          ) {
            const property = await tx.property.findUnique({
              where: { id: propertyId },
            });
            let finalGuestId = payload.GuestId || payload.guestId;

            // If a GuestId is provided, check if it exists in the cloud DB
            if (finalGuestId) {
              const existingGuest = await tx.guest.findUnique({
                where: { id: finalGuestId },
              });
              if (existingGuest && existingGuest.propertyId !== propertyId) {
                throw new Error("Guest does not belong to this property");
              }
              if (!existingGuest && payload.Guest) {
                // C# generated a local GuestId, but it's not in the cloud yet.
                await tx.guest.create({
                  data: {
                    id: finalGuestId,
                    organizationId: property?.organizationId || "",
                    propertyId,
                    firstName: payload.Guest.FirstName || "Unknown",
                    lastName: payload.Guest.LastName || "Guest",
                    email: payload.Guest.Email,
                    phone: payload.Guest.Phone,
                  },
                });
              } else if (!existingGuest) {
                // No payload.Guest provided and it doesn't exist, we can't do much but fail
                throw new Error(
                  `GuestId ${finalGuestId} does not exist and no Guest details provided`,
                );
              }
            } else if (payload.Guest) {
              // Fallback: create guest in cloud with auto-generated ID
              const g = await tx.guest.create({
                data: {
                  organizationId: property?.organizationId || "",
                  propertyId,
                  firstName: payload.Guest.FirstName || "Unknown",
                  lastName: payload.Guest.LastName || "Guest",
                  email: payload.Guest.Email,
                  phone: payload.Guest.Phone,
                },
              });
              finalGuestId = g.id;
            }

            if (!finalGuestId)
              throw new Error("Missing GuestId for reservation");

            const reqRoomId = payload.RoomId || payload.roomId;
            const reqRoomTypeId = payload.RoomTypeId || payload.roomTypeId;

            let room = null;
            let roomType = null;

            if (reqRoomId) {
              room = await tx.room.findFirst({
                where: { id: reqRoomId, propertyId },
                include: { roomType: true },
              });
              if (!room) throw new Error("Room not found or unauthorized");
              roomType = room.roomType;
            } else if (reqRoomTypeId) {
              roomType = await tx.roomType.findFirst({
                where: { id: reqRoomTypeId, propertyId },
              });
              if (!roomType)
                throw new Error("RoomType not found or unauthorized");
            } else {
              roomType = await tx.roomType.findFirst({
                where: { propertyId, isActive: true },
              });
              if (!roomType)
                throw new Error("No room types available for property");
            }

            const checkInDate = new Date(
              payload.CheckInDate || payload.checkInDate || payload.checkIn,
            );
            const checkOutDate = new Date(
              payload.CheckOutDate || payload.checkOutDate || payload.checkOut,
            );
            if (
              isNaN(checkInDate.getTime()) ||
              isNaN(checkOutDate.getTime()) ||
              checkOutDate <= checkInDate
            ) {
              throw new Error("Check-out must be after check-in");
            }
            const nights = Math.max(
              1,
              Math.ceil(
                (checkOutDate.getTime() - checkInDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            );
            let baseRate = Number(roomType.baseRate);
            const currency = roomType.currency || "NGN";

            let finalRatePlanId = "";
            const corporateAccountId =
              payload.CorporateAccountId || payload.corporateAccountId;
            if (corporateAccountId) {
              const corporateAccount = await tx.corporateAccount.findUnique({
                where: { id: corporateAccountId },
                include: { ratePlan: true },
              });
              if (corporateAccount?.ratePlan) {
                finalRatePlanId = corporateAccount.ratePlan.id;
                const rate = await tx.rate.findFirst({
                  where: {
                    ratePlanId: finalRatePlanId,
                    roomTypeId: roomType.id,
                  },
                });
                if (rate && (rate as any).amount) {
                  baseRate = Number((rate as any).amount);
                } else if (rate && (rate as any).baseAmount) {
                  baseRate = Number((rate as any).baseAmount);
                }
              }
            }

            if (!finalRatePlanId) {
              const ratePlan = await tx.ratePlan.findFirst({
                where: { propertyId, isActive: true },
              });
              if (!ratePlan)
                throw new Error("No active RatePlan found for property");
              finalRatePlanId = ratePlan.id;
            }

            const amount = baseRate * nights;

            await tx.reservation.create({
              data: {
                id: aggregateId,
                propertyId,
                primaryGuestId: finalGuestId,
                source: "WALK_IN",
                status: (payload.Status ||
                  payload.status ||
                  "CONFIRMED") as any,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                adults: payload.Adults || payload.adults || 1,
                children: payload.Children || payload.children || 0,
                ratePlanId: finalRatePlanId,
                ratePlanSnapshot: { baseRate, currency, nights, total: amount },
                confirmationNumber: `RES-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
                currency,
                corporateAccountId: corporateAccountId || null,
                createdBy: actorId,
                version: aggregateVersion,
              },
            });

            await tx.reservationRoom.create({
              data: {
                reservationId: aggregateId,
                roomTypeId: roomType.id,
                roomId: room ? room.id : null,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                adults: payload.Adults || payload.adults || 1,
                children: payload.Children || payload.children || 0,
                ratePlanId: finalRatePlanId,
                rateAmount: baseRate,
                currency,
                status: "ACTIVE",
              },
            });

            const propertyBusinessDateStr = (property?.businessDate ?? new Date()).toISOString().split('T')[0];
            const checkInStr = checkInDate.toISOString().split('T')[0];
            if (
              room &&
              (payload.Status || payload.status || "CONFIRMED") === "CONFIRMED" &&
              checkInStr === propertyBusinessDateStr
            ) {
              await tx.room.update({
                where: { id: room.id },
                data: { status: "RESERVED" },
              });
            }

            await tx.reservationGuest.create({
              data: {
                reservationId: aggregateId,
                guestId: finalGuestId,
                isPrimary: true,
              },
            });

            // 7D.1: Create Folio
            const folioNumber =
              "FOL-" +
              Math.floor(Math.random() * 1000000)
                .toString()
                .padStart(6, "0");
            const newFolio = await tx.folio.create({
              data: {
                id: isUuid(payload.FolioId || payload.folioId)
                  ? payload.FolioId || payload.folioId
                  : undefined,
                reservationId: aggregateId,
                propertyId,
                guestId: finalGuestId,
                folioNumber,
                type: "ROOM",
                status: "OPEN",
                currency: currency,
                totalCharges: 0,
                totalPayments: 0,
                balance: 0,
                version: 1,
              },
            });
          } else if (eventType === "CHECK_IN") {
            const reservation = await tx.reservation.findUnique({
              where: { id: aggregateId },
            });
            if (!reservation)
              throw new Error(`Reservation ${aggregateId} not found`);

            await tx.reservation.update({
              where: { id: aggregateId },
              data: { status: "CHECKED_IN" },
            });
            if (payload.roomId) {
              await tx.room.update({
                where: { id: payload.roomId },
                data: { status: "OCCUPIED" },
              });
            }
          } else if (eventType === "CHECK_OUT") {
            // Desktop checkouts are queued while offline, so enforce the same
            // financial rule again when the event reaches the cloud. This must
            // happen inside the transaction before changing reservation/room state.
            const folios = await tx.folio.findMany({
              where: { reservationId: aggregateId, propertyId },
              select: { balance: true },
            });
            const totalBalance = folios.reduce(
              (sum: number, folio: any) => sum + Number(folio.balance),
              0,
            );
            if (totalBalance > 0.01) throw new Error("PAYMENT_REQUIRED");
            if (totalBalance < -0.01) throw new Error("REFUND_REQUIRED");

            await tx.reservation.update({
              where: { id: aggregateId },
              data: { status: "CHECKED_OUT" },
            });
            if (payload.roomId) {
              await tx.room.update({
                where: { id: payload.roomId },
                data: { status: "DIRTY" },
              });
            }
          } else if (eventType === "ROOM_CREDIT") {
            const amount = Number(payload.amount);
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Credit amount must be positive");
            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");
            const credit = await tx.folioCredit.create({
              data: {
                folioId: aggregateId,
                reservationId: folio.reservationId,
                propertyId,
                amount,
                remainingAmount: amount,
                currency: payload.currency || "NGN",
                method: "OTHER",
                status: "AVAILABLE",
                notes: payload.description || "Room downgrade credit",
                receivedBy: actorId,
                deviceId: device.id,
                operationId: payload.operationId || id,
                idempotencyKey,
                businessDate: authoritativeBusinessDate,
              },
            });
            await tx.financialAuditLog.create({
              data: {
                operationId: payload.operationId || id,
                propertyId,
                reservationId: folio.reservationId,
                folioId: aggregateId,
                creditId: credit.id,
                operationType: "ROOM_DOWNGRADE_CREDIT",
                amount,
                currency: payload.currency || folio.currency || "NGN",
                operatorId: actorId,
                deviceId: device.id,
                businessDate: authoritativeBusinessDate,
                reason: payload.description || "Room downgrade credit",
                balanceBefore: folio.balance,
                balanceAfter: folio.balance,
                approvalStatus: "NOT_REQUIRED",
                idempotencyKey: `audit:${idempotencyKey}`,
                metadata: { eventType, source: "DESKTOP" },
              },
            });
            if (Number(folio.balance) > 0) {
              const debitAmount = Math.min(Number(folio.balance), amount);
              await applyAvailableFolioCredit(tx, {
                folioId: aggregateId,
                propertyId,
                reservationId: folio.reservationId,
                amount: debitAmount,
                currency: payload.currency || folio.currency || "NGN",
                source: "SYSTEM_AUTO_APPLY",
                description: "Auto-applied credit to outstanding debit",
                appliedBy: actorId,
                deviceId: device.id,
                operationKey: `AUTO_APPLY_${idempotencyKey}`,
                businessDate: authoritativeBusinessDate,
              });
            }
          } else if (
            eventType === "ROOM_CHARGE" ||
            eventType === "POST_CHARGE"
          ) {
            const existingCharge = await tx.folioItem.findFirst({
              where: { posTransactionId: idempotencyKey },
            });
            if (existingCharge) {
              const e = new Error("IDEMPOTENCY_DUPLICATE");
              throw e;
            }

            const amount = Number(payload.amount);
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Charge amount must be positive");
            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");
            await tx.folioItem.create({
              data: {
                folioId: aggregateId,
                businessDate: authoritativeBusinessDate,
                type: "CHARGE",
                source: payload.source || "ROOM_CHARGE",
                description: payload.description,
                quantity: 1,
                unitAmount: amount,
                amount: amount,
                currency: payload.currency || "NGN",
                baseAmount: amount,
                postedBy: actorId,
                deviceId: device.id,
                isLatePosting: true,
                posTransactionId: idempotencyKey,
              },
            });

            await tx.folio.update({
              where: { id: aggregateId },
              data: {
                totalCharges: { increment: amount },
                balance: { increment: amount },
              },
            });

            const creditAmount = Number(payload.creditApplicationAmount || 0);
            if (creditAmount > 0) {
              if (!Number.isFinite(creditAmount) || creditAmount > amount)
                throw new Error("Invalid credit application amount");
              let remainingToApply = creditAmount;
              const credits = await tx.folioCredit.findMany({
                where: {
                  folioId: aggregateId,
                  propertyId,
                  status: { in: ["AVAILABLE", "PARTIALLY_APPLIED"] },
                  remainingAmount: { gt: 0 },
                },
                orderBy: { createdAt: "asc" },
              });
              for (const credit of credits) {
                if (remainingToApply <= 0) break;
                const applied = Math.min(
                  remainingToApply,
                  Number(credit.remainingAmount),
                );
                const updated = await tx.folioCredit.updateMany({
                  where: { id: credit.id, remainingAmount: { gte: applied } },
                  data: {
                    remainingAmount: { decrement: applied },
                    status:
                      applied >= Number(credit.remainingAmount)
                        ? "EXHAUSTED"
                        : "PARTIALLY_APPLIED",
                  },
                });
                if (updated.count !== 1) continue;
                const application = await tx.folioCreditApplication.create({
                  data: {
                    creditId: credit.id,
                    folioId: aggregateId,
                    amount: applied,
                    currency: payload.currency || "NGN",
                    source: payload.source || "OTHER",
                    description: payload.description || "Applied guest credit",
                    idempotencyKey: `${payload.creditApplicationKey || `CREDIT_APPLICATION:${idempotencyKey}`}:${credit.id}`,
                    appliedBy: actorId,
                    deviceId: device.id,
                    businessDate: authoritativeBusinessDate,
                  },
                });
                await tx.folio.update({
                  where: { id: aggregateId },
                  data: { balance: { decrement: applied } },
                });
                await tx.financialAuditLog.create({
                  data: {
                    operationId:
                      payload.creditApplicationKey ||
                      `CREDIT_APPLICATION:${idempotencyKey}`,
                    propertyId,
                    reservationId: folio.reservationId,
                    folioId: aggregateId,
                    creditId: credit.id,
                    creditApplicationId: application.id,
                    transactionId: idempotencyKey,
                    operationType: "CREDIT_APPLICATION",
                    amount: applied,
                    currency: payload.currency || folio.currency || "NGN",
                    operatorId: actorId,
                    deviceId: device.id,
                    businessDate: authoritativeBusinessDate,
                    reason: payload.description || "Applied guest credit",
                    balanceBefore: credit.remainingAmount,
                    balanceAfter: Number(credit.remainingAmount) - applied,
                    approvalStatus: "NOT_REQUIRED",
                    idempotencyKey: `audit:${payload.creditApplicationKey || `CREDIT_APPLICATION:${idempotencyKey}`}:${credit.id}`,
                    metadata: { eventType, source: "DESKTOP" },
                  },
                });
                remainingToApply -= applied;
              }
            }
          } else if (
            eventType === "ADVANCE_DEPOSIT_REQUEST" ||
            eventType === "CREDIT_ADJUSTMENT_REQUEST"
          ) {
            const amount = Number(payload.amount);
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Deposit amount must be positive");
            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");
            const approvalKey = `approval:${idempotencyKey}`;
            const existingApproval = await tx.approvalRequest.findUnique({
              where: { idempotencyKey: approvalKey },
            });
            const approval =
              existingApproval ||
              (await tx.approvalRequest.create({
                data: {
                  propertyId,
                  type:
                    eventType === "CREDIT_ADJUSTMENT_REQUEST"
                      ? "CREDIT_ADJUSTMENT"
                      : "ADVANCE_DEPOSIT",
                  status: "PENDING",
                  requestedBy: actorId,
                  amount,
                  currency: payload.currency || folio.currency || "NGN",
                  reason:
                    payload.description ||
                    payload.notes ||
                    "Financial operation requires approval",
                  idempotencyKey: approvalKey,
                  details: {
                    folioId: aggregateId,
                    reservationId: folio.reservationId,
                    amount,
                    method: payload.method || "OTHER",
                    operationType:
                      eventType === "CREDIT_ADJUSTMENT_REQUEST"
                        ? "CREDIT_ADJUSTMENT"
                        : "ADVANCE_DEPOSIT",
                    reference: payload.reference || null,
                    notes: payload.notes || null,
                    operatorId: actorId,
                    deviceId: device.id,
                    sourceEventId: id,
                    sourceEventKey: idempotencyKey,
                  },
                },
              }));
            await tx.financialAuditLog.create({
              data: {
                operationId: idempotencyKey,
                approvalId: approval.id,
                propertyId,
                reservationId: folio.reservationId,
                folioId: aggregateId,
                operationType:
                  eventType === "CREDIT_ADJUSTMENT_REQUEST"
                    ? "CREDIT_ADJUSTMENT"
                    : "ADVANCE_DEPOSIT",
                amount,
                currency: payload.currency || folio.currency || "NGN",
                operatorId: actorId,
                deviceId: device.id,
                businessDate: authoritativeBusinessDate,
                reason:
                  payload.description ||
                  payload.notes ||
                  "Financial operation requires approval",
                balanceBefore: folio.balance,
                balanceAfter: folio.balance,
                approvalStatus: "PENDING_APPROVAL",
                idempotencyKey: `audit:${idempotencyKey}`,
                metadata: { eventType, source: "DESKTOP" },
              },
            });
            resultStatus = "PENDING_APPROVAL";
          } else if (eventType === "ADVANCE_DEPOSIT") {
            const amount = Number(payload.amount);
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Deposit amount must be positive");

            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");
            if (folio.status !== "OPEN")
              throw new Error("Cannot add a deposit to a closed folio");

            let methodStr = String(payload.method || "CASH").toUpperCase();
            const validMethods = [
              "CASH",
              "BANK_TRANSFER",
              "POS",
              "CARD",
              "CARD_OFFLINE",
              "PAYMENT_GATEWAY",
              "MOBILE_PAYMENT",
              "CHEQUE",
              "ROOM_CHARGE",
              "OTHER",
            ];
            if (!validMethods.includes(methodStr)) methodStr = "OTHER";

            await tx.folioCredit.create({
              data: {
                folioId: aggregateId,
                reservationId: folio.reservationId,
                propertyId,
                amount,
                remainingAmount: amount,
                currency: payload.currency || folio.currency || "NGN",
                method: methodStr as any,
                status: "AVAILABLE",
                reference: payload.reference || null,
                notes: payload.notes || null,
                receivedBy: actorId,
                deviceId: device.id,
                operationId: payload.operationId || id,
                idempotencyKey,
                businessDate: authoritativeBusinessDate,
              },
            });

            await tx.payment.create({
              data: {
                folioId: aggregateId,
                propertyId,
                reservationId: folio.reservationId,
                method: methodStr as any,
                amount: amount,
                currency: payload.currency || "NGN",
                baseAmount: amount,
                status: "COMPLETED",
                idempotencyKey: `dep_pay_${idempotencyKey}`,
                receivedBy: actorId,
                frontdeskSessionId: payload.frontdeskSessionId || null,
                terminalId: payload.terminalId || device.id,
                reference: payload.reference || null,
              },
            });

            if (payload.frontdeskSessionId && methodStr === "CASH") {
              const session = await tx.frontdeskSession.findUnique({
                where: { id: payload.frontdeskSessionId },
              });
              if (session && session.status === "OPEN") {
                await tx.cashAccount.update({
                  where: { id: session.cashAccountId },
                  data: { balance: { increment: amount } },
                });
                await tx.posCashMovement.create({
                  data: {
                    propertyId,
                    deviceId: device.id,
                    frontdeskSessionId: session.id,
                    userId: actorId,
                    amount,
                    currency: payload.currency || "NGN",
                    type: "PAYMENT",
                    sourceAccountId: session.cashAccountId,
                    destinationAccountId: session.cashAccountId,
                    reasonCode: "ADVANCE_DEPOSIT",
                    receiptReference: payload.reference || null,
                    operationId: `FD-DEPOSIT-${idempotencyKey}`,
                    businessDate: session.businessDate,
                  },
                });
              }
            }

            if (Number(folio.balance) > 0) {
              const debitAmount = Math.min(Number(folio.balance), amount);
              await applyAvailableFolioCredit(tx, {
                folioId: aggregateId,
                propertyId,
                reservationId: folio.reservationId,
                amount: debitAmount,
                currency: payload.currency || folio.currency || "NGN",
                source: "SYSTEM_AUTO_APPLY",
                description: "Auto-applied credit to outstanding debit",
                appliedBy: actorId,
                deviceId: device.id,
                operationKey: `AUTO_APPLY_${idempotencyKey}`,
                businessDate: authoritativeBusinessDate,
              });
            }
          } else if (eventType === "POST_PAYMENT") {
            // Folio-level payment — idempotent via posTransactionId uniqueness
            const amount = Number(payload.amount);
            if (!amount || amount <= 0)
              throw new Error("Payment amount must be positive");

            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");

            // Idempotency: if a FolioItem already exists with this event's idempotencyKey, skip
            const existing = await tx.folioItem.findFirst({
              where: { posTransactionId: idempotencyKey },
            });
            if (!existing) {
              if (amount > Number(folio.balance) + 0.01)
                throw new Error("Payment amount exceeds outstanding balance");
              await tx.folioItem.create({
                data: {
                  folioId: aggregateId,
                  businessDate: authoritativeBusinessDate,
                  type: "PAYMENT",
                  source: "MANUAL",
                  description:
                    payload.description ||
                    `${payload.method || "PAYMENT"} payment`,
                  quantity: 1,
                  unitAmount: -amount,
                  amount: -amount,
                  currency: payload.currency || "NGN",
                  baseAmount: amount,
                  postedBy: actorId,
                  deviceId: device.id,
                  isLatePosting: true,
                  posTransactionId: idempotencyKey,
                },
              });

              // Also create the corresponding Payment record so the web UI can display payment method and receipts
              let methodStr = (payload.method || "CASH").toUpperCase();
              const validMethods = [
                "CASH",
                "BANK_TRANSFER",
                "POS",
                "CARD",
                "CARD_OFFLINE",
                "PAYMENT_GATEWAY",
                "MOBILE_PAYMENT",
                "CHEQUE",
                "ROOM_CHARGE",
                "OTHER",
              ];
              if (!validMethods.includes(methodStr)) methodStr = "OTHER";

              await tx.payment.create({
                data: {
                  folioId: aggregateId,
                  propertyId,
                  reservationId: folio.reservationId,
                  method: methodStr as any,
                  amount: amount,
                  currency: payload.currency || "NGN",
                  baseAmount: amount,
                  status: "COMPLETED",
                  idempotencyKey: `pay_${idempotencyKey}`,
                  receivedBy: actorId,
                  frontdeskSessionId: payload.frontdeskSessionId || null,
                  terminalId: payload.terminalId || device.id,
                  reference: payload.reference || null,
                  authorizationCode: payload.authorizationCode || null,
                },
              });

              if (payload.frontdeskSessionId && methodStr === "CASH") {
                const session = await tx.frontdeskSession.findUnique({
                  where: { id: payload.frontdeskSessionId },
                });
                if (!session || session.status !== "OPEN")
                  throw new Error("Front desk session is not open");
                await tx.cashAccount.update({
                  where: { id: session.cashAccountId },
                  data: { balance: { increment: amount } },
                });
                await tx.posCashMovement.create({
                  data: {
                    propertyId,
                    deviceId: device.id,
                    frontdeskSessionId: session.id,
                    userId: actorId,
                    amount,
                    currency: payload.currency || "NGN",
                    type: "PAYMENT",
                    sourceAccountId: session.cashAccountId,
                    destinationAccountId: session.cashAccountId,
                    reasonCode: "FOLIO_PAYMENT",
                    receiptReference: payload.reference || null,
                    operationId: `FD-PAYMENT-${idempotencyKey}`,
                    businessDate: session.businessDate,
                  },
                });
              }

              await tx.folio.update({
                where: { id: aggregateId },
                data: {
                  totalPayments: { increment: amount },
                  balance: { decrement: amount },
                },
              });
            }
          } else if (eventType === "CITY_LEDGER_SETTLEMENT") {
            const amount = Number(payload.amount ?? payload.Amount);
            const accountId = payload.accountId || payload.AccountId;
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Settlement amount must be positive");
            if (!accountId)
              throw new Error(
                "accountId is required for CITY_LEDGER_SETTLEMENT",
              );

            const folio = await tx.folio.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!folio) throw new Error("Folio not found or unauthorized");

            const existing = await tx.cityLedgerEntry.findFirst({
              where: { folioId: aggregateId, type: "TRANSFER_IN", amount },
            });
            if (!existing) {
              await tx.cityLedgerEntry.create({
                data: {
                  accountId,
                  propertyId,
                  reservationId: folio.reservationId,
                  folioId: aggregateId,
                  amount,
                  currency: payload.currency || "NGN",
                  type: "TRANSFER_IN",
                  reason:
                    "Auto-routed to City Ledger upon checkout (Offline sync)",
                  createdBy: actorId,
                },
              });
              await tx.folio.update({
                where: { id: aggregateId },
                data: {
                  totalPayments: { increment: amount },
                  balance: { decrement: amount },
                },
              });
            }
          } else if (eventType === "REFUND_REQUESTED") {
            const amount = Math.abs(Number(payload.amount ?? payload.Amount));
            const paymentId =
              payload.paymentId || payload.PaymentId || aggregateId;
            const payment = await tx.payment.findUnique({
              where: { id: paymentId },
              include: {
                folio: { include: { items: true } },
                reservation: true,
              },
            });
            if (!payment || payment.propertyId !== propertyId)
              throw new Error("Payment not found or unauthorized");
            if (!Number.isFinite(amount) || amount <= 0)
              throw new Error("Refund amount must be positive");
            const requestedMethod = String(
              payload.requestedMethod ||
                payload.refundMethod ||
                "ORIGINAL_PAYMENT",
            ).toUpperCase();
            if (
              !["CASH", "BANK_TRANSFER", "ORIGINAL_PAYMENT"].includes(
                requestedMethod,
              )
            )
              throw new Error("Invalid refund method");
            const category = String(
              payload.category || "MANUAL_ADJUSTMENT",
            ).toUpperCase();
            const reducedStayNights = Number(
              payload.reducedStayNights ?? payload.ReducedStayNights,
            );
            if (category === "REDUCED_STAY") {
              const roomChargeTotal = payment.folio.items
                .filter(
                  (item) =>
                    item.source === "ROOM_CHARGE" &&
                    item.type === "CHARGE" &&
                    !item.voidedAt,
                )
                .reduce((sum, item) => sum + Number(item.amount), 0);
              const estimate = getReducedStayEstimate({
                checkIn: payment.reservation?.checkIn,
                checkOut: payment.reservation?.checkOut,
                status: payment.reservation?.status,
                roomChargeTotal,
              });
              if (
                !Number.isInteger(reducedStayNights) ||
                reducedStayNights <= 0 ||
                reducedStayNights > estimate.availableNights ||
                Math.abs(
                  amount - reducedStayNights * estimate.nightlyRoomAmount,
                ) > 0.01
              )
                throw new Error("Invalid reduced-stay refund calculation");
            }
            const existingRequest = await tx.refundRequest.findUnique({
              where: { idempotencyKey },
            });
            if (!existingRequest) {
              const requesterId = isUuid(event.operatorId)
                ? event.operatorId
                : device.id;
              const bankAccountNumber = String(
                payload.bankAccountNumber || "",
              ).replace(/\s+/g, "");
              const request = await tx.refundRequest.create({
                data: {
                  organizationId: property.organizationId,
                  propertyId,
                  reservationId: payment.reservationId,
                  folioId: payment.folioId,
                  paymentId,
                  requestedAmount: amount,
                  currency: payload.currency || payment.currency,
                  requestedMethod,
                  bankAccountName:
                    requestedMethod === "BANK_TRANSFER"
                      ? payload.bankAccountName || null
                      : null,
                  bankAccountNumberEncrypted:
                    requestedMethod === "BANK_TRANSFER" && bankAccountNumber
                      ? encrypt(bankAccountNumber)
                      : null,
                  bankAccountLast4:
                    requestedMethod === "BANK_TRANSFER" && bankAccountNumber
                      ? bankAccountNumber.slice(-4)
                      : null,
                  bankName:
                    requestedMethod === "BANK_TRANSFER"
                      ? payload.bankName || null
                      : null,
                  bankCode:
                    requestedMethod === "BANK_TRANSFER"
                      ? payload.bankCode || null
                      : null,
                  category,
                  reason: payload.reason || "Offline refund request",
                  supportingNotes:
                    [
                      payload.supportingNotes || null,
                      category === "REDUCED_STAY"
                        ? `Reduced stay nights: ${reducedStayNights}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join("\n") || null,
                  requestedById: requesterId,
                  idempotencyKey,
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
              });
              await tx.approvalRequest.create({
                data: {
                  propertyId,
                  type: "REFUND",
                  status: "PENDING",
                  requestedBy: requesterId,
                  amount,
                  currency: request.currency,
                  reason: request.reason,
                  expiresAt: request.expiresAt,
                  details: {
                    refundRequestId: request.id,
                    category: request.category,
                    requestedAmount: amount,
                    requestedMethod,
                    stepOrder: 1,
                  },
                },
              });
            }
          } else if (eventType === "LATE_ARRIVAL") {
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status !== "CONFIRMED")
              throw new Error(
                `Cannot record late arrival for a ${res.status} reservation`,
              );
            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                lateArrivalExpected: true,
                lateArrivalNotes: payload.notes || null,
                lateArrivalAt: new Date(),
                lateArrivalBy: isUuid(event.operatorId)
                  ? event.operatorId
                  : null,
              },
            });
          } else if (eventType === "NO_SHOW") {
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: {
                noShowPolicy: true,
                folios: {
                  include: {
                    items: true,
                    payments: { where: { status: "COMPLETED" } },
                  },
                },
              },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status !== "CONFIRMED")
              throw new Error(
                `Cannot assess a ${res.status} reservation as no-show`,
              );
            const cutoff = new Date(res.checkIn);
            const [cutoffHour, cutoffMinute] = String(
              res.noShowPolicy?.cutoffTime || "02:00",
            )
              .split(":")
              .map(Number);
            cutoff.setUTCHours(
              24 + (Number.isFinite(cutoffHour) ? cutoffHour : 2),
              Number.isFinite(cutoffMinute) ? cutoffMinute : 0,
              0,
              0,
            );
            cutoff.setTime(
              cutoff.getTime() +
                (res.noShowPolicy?.gracePeriodMinutes || 0) * 60_000,
            );
            if (new Date() < cutoff)
              throw new Error(
                `No-show cutoff has not passed; eligible after ${cutoff.toISOString()}`,
              );
            const bookedValue =
              Number((res.ratePlanSnapshot as any)?.total || 0) ||
              res.folios
                .flatMap((folio) => folio.items)
                .filter(
                  (item) =>
                    item.type === "CHARGE" &&
                    item.source === "ROOM_CHARGE" &&
                    !item.voidedAt,
                )
                .reduce((sum, item) => sum + Number(item.amount), 0);
            const totalPaid = res.folios
              .flatMap((folio) => folio.payments)
              .reduce((sum, payment) => sum + Number(payment.amount), 0);
            const assessment = calculateNoShowAssessment({
              checkIn: res.checkIn,
              checkOut: res.checkOut,
              bookedValue,
              totalPaid,
              chargeType: res.noShowPolicy?.chargeType || "FIRST_NIGHT",
              chargeValue: Number(res.noShowPolicy?.chargeValue || 0),
              refundableUnusedNights:
                res.noShowPolicy?.refundableUnusedNights ?? true,
            });
            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                status: "NO_SHOW",
                noShowAt: new Date(),
                noShowBy: isUuid(event.operatorId) ? event.operatorId : null,
                noShowAssessedAt: new Date(),
                noShowChargeAmount: assessment.noShowCharge,
                noShowRefundableAmount: assessment.refundableAmount,
              },
            });
            await tx.reservationRoom.updateMany({
              where: { reservationId: aggregateId, status: "ACTIVE" },
              data: { status: "NO_SHOW" },
            });
          } else if (eventType === "REINSTATE") {
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: { noShowPolicy: true },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status !== "NO_SHOW")
              throw new Error(`Cannot reinstate a ${res.status} reservation`);
            if (res.noShowPolicy?.allowReinstatement === false)
              throw new Error("Reinstatement is disabled by property policy");
            const activeRefund = await tx.refundRequest.findFirst({
              where: {
                reservationId: aggregateId,
                status: {
                  in: [
                    "PENDING_APPROVAL",
                    "APPROVED",
                    "PROCESSING",
                    "COMPLETED",
                  ],
                },
              },
            });
            if (activeRefund)
              throw new Error("Refund workflow prevents reinstatement");
            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                status: "CONFIRMED",
                reinstatedAt: new Date(),
                reinstatedBy: isUuid(event.operatorId)
                  ? event.operatorId
                  : null,
                reinstatementReason: payload.reason || "Offline reinstatement",
              },
            });
            const reinstatedRooms = await tx.reservationRoom.findMany({
              where: { reservationId: aggregateId, status: "NO_SHOW" },
            });
            await tx.reservationRoom.updateMany({
              where: { reservationId: aggregateId, status: "NO_SHOW" },
              data: { status: "ACTIVE" },
            });
            const propertyBusinessDateStr = (authoritativeBusinessDate || new Date()).toISOString().split('T')[0];
            for (const reservationRoom of reinstatedRooms) {
              if (reservationRoom.roomId) {
                const checkInStr = reservationRoom.checkIn.toISOString().split('T')[0];
                if (checkInStr === propertyBusinessDateStr) {
                  await tx.room.update({
                    where: { id: reservationRoom.roomId },
                    data: { status: "RESERVED" },
                  });
                }
              }
            }
          } else if (eventType === "CANCEL") {
            // Idempotent — if already cancelled, treat as success
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: {
                reservationRooms: { where: { status: "ACTIVE" } },
                folios: {
                  include: { payments: { include: { refunds: true } } },
                },
              },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status === "CHECKED_OUT")
              throw new Error("Cannot cancel a checked-out reservation");

            if (res.status !== "CANCELLED") {
              await tx.reservation.update({
                where: { id: aggregateId },
                data: { status: "CANCELLED" },
              });

              // Mark active reservation rooms as cancelled
              await tx.reservationRoom.updateMany({
                where: { reservationId: aggregateId, status: "ACTIVE" },
                data: { status: "CANCELLED" },
              });

              // Free the room only if it still belongs to this reservation
              if (payload.roomId) {
                const roomStillBelongs = res.reservationRooms.some(
                  (rr: any) => rr.roomId === payload.roomId,
                );
                if (roomStillBelongs) {
                  // Only mark AVAILABLE if no other active reservation owns it
                  const otherActive = await tx.reservationRoom.findFirst({
                    where: {
                      roomId: payload.roomId,
                      status: "ACTIVE",
                      reservationId: { not: aggregateId },
                    },
                  });
                  if (!otherActive) {
                    await tx.room.update({
                      where: { id: payload.roomId },
                      data: { status: "AVAILABLE" },
                    });
                  }
                }
              }
            }
            await queueCancellationRefunds(
              tx,
              res,
              propertyId,
              property.organizationId,
              isUuid(event.operatorId) ? event.operatorId : device.id,
              payload.reason || "Offline reservation cancellation",
            );
          } else if (eventType === "REASSIGN_ROOM") {
            const { newRoomId, oldRoomId, newRoomNumber } = payload;
            if (!newRoomId)
              throw new Error("newRoomId is required for REASSIGN_ROOM");

            // Validate the reservation exists in this property
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: {
                reservationRooms: { where: { status: "ACTIVE" } },
                folios: { where: { type: "ROOM" }, include: { items: true } },
              },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status === "CHECKED_OUT" || res.status === "CANCELLED")
              throw new Error(
                `Cannot reassign room for a ${res.status} reservation`,
              );

            // Validate new room belongs to this property
            const newRoom = await tx.room.findFirst({
              where: { id: newRoomId, propertyId },
            });
            if (!newRoom) throw new Error("New room not found or unauthorized");

            // Validate new room not already occupied by another active reservation
            const newRoomConflict = await tx.reservationRoom.findFirst({
              where: {
                roomId: newRoomId,
                status: "ACTIVE",
                reservationId: { not: aggregateId },
              },
            });
            if (newRoomConflict)
              throw new Error(
                "New room is already assigned to another active reservation",
              );

            // Deactivate all current active room assignments for this reservation
            await tx.reservationRoom.updateMany({
              where: { reservationId: aggregateId, status: "ACTIVE" },
              data: { status: "INACTIVE" },
            });

            // Create new assignment
            const activeRoom = res.reservationRooms[0];
            const oldRate = Number(activeRoom?.rateAmount || 0);
            const newRate = Number(
              (
                await tx.roomType.findUnique({
                  where: { id: newRoom.roomTypeId },
                  select: { baseRate: true },
                })
              )?.baseRate || oldRate,
            );
            const pricingStart = new Date(activeRoom?.checkIn || res.checkIn);
            if (res.status === "CHECKED_IN") {
              const tomorrow = new Date();
              tomorrow.setUTCHours(0, 0, 0, 0);
              tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
              if (tomorrow > pricingStart)
                pricingStart.setTime(tomorrow.getTime());
            }
            const nights = Math.max(
              0,
              Math.ceil(
                (new Date(activeRoom?.checkOut || res.checkOut).getTime() -
                  pricingStart.getTime()) /
                  86400000,
              ),
            );
            const upgradeAmount = Math.max(0, newRate - oldRate) * nights;
            await tx.reservationRoom.create({
              data: {
                reservationId: aggregateId,
                roomTypeId: newRoom.roomTypeId,
                roomId: newRoomId,
                checkIn: activeRoom?.checkIn || res.checkIn,
                checkOut: activeRoom?.checkOut || res.checkOut,
                adults: activeRoom?.adults || res.adults,
                children: activeRoom?.children || res.children,
                ratePlanId: activeRoom?.ratePlanId,
                rateAmount: newRate,
                currency: activeRoom?.currency || "NGN",
                status: "ACTIVE",
              },
            });

            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                ratePlanSnapshot: {
                  ...((res.ratePlanSnapshot as any) || {}),
                  baseRate: newRate,
                  total:
                    Number((res.ratePlanSnapshot as any)?.total || 0) +
                    (newRate - oldRate) * nights,
                },
              },
            });

            // NOTE: The upgrade rate difference (newRate - oldRate) is NOT charged
            // immediately. The Night Audit posts room charges based on the current
            // reservationRoom.rateAmount, so the new rate will be picked up
            // automatically on the next audit run. Charging here would cause
            // double-billing when the Night Audit also runs.

            const downgradeCredit = Math.max(0, oldRate - newRate) * nights;
            if (downgradeCredit > 0 && res.folios[0]) {
              const creditKey = `ROOM_DOWNGRADE:${aggregateId}:${newRoomId}:${new Date(activeRoom?.checkOut || res.checkOut).toISOString().slice(0, 10)}`;
              const existingCredit = await tx.folioItem.findFirst({
                where: {
                  folioId: res.folios[0].id,
                  posTransactionId: creditKey,
                },
              });
              if (!existingCredit) {
                await tx.folioItem.create({
                  data: {
                    folioId: res.folios[0].id,
                    businessDate: authoritativeBusinessDate,
                    type: "PAYMENT",
                    source: "ROOM_DOWNGRADE_CREDIT",
                    description: `Room downgrade credit - ${nights} night${nights === 1 ? "" : "s"}`,
                    quantity: 1,
                    unitAmount: -downgradeCredit,
                    amount: -downgradeCredit,
                    currency: res.currency,
                    baseAmount: downgradeCredit,
                    postedBy: actorId,
                    posTransactionId: creditKey,
                  },
                });
                await tx.folio.update({
                  where: { id: res.folios[0].id },
                  data: {
                    totalPayments: { increment: downgradeCredit },
                    balance: { decrement: downgradeCredit },
                  },
                });
              }
            }

            // Room assignment is tracked via reservationRoom; no field on reservation to update here

            // Release old room if it was this reservation's room
            if (oldRoomId && oldRoomId !== newRoomId) {
              const stillOwned = await tx.reservationRoom.findFirst({
                where: {
                  roomId: oldRoomId,
                  status: "ACTIVE",
                  reservationId: { not: aggregateId },
                },
              });
              if (!stillOwned) {
                await tx.room.update({
                  where: { id: oldRoomId },
                  data: { status: "AVAILABLE" },
                });
              }
            }
            // Occupy new room based on reservation status
            const propertyBusinessDateStr = (authoritativeBusinessDate || new Date()).toISOString().split('T')[0];
            const checkInStr = res.checkIn.toISOString().split('T')[0];
            const isToday = checkInStr === propertyBusinessDateStr;
            
            let newStatus = "AVAILABLE";
            if (res.status === "CHECKED_IN") {
              newStatus = "OCCUPIED";
            } else if (res.status === "CONFIRMED" && isToday) {
              newStatus = "RESERVED";
            }

            await tx.room.update({
              where: { id: newRoomId },
              data: { status: newStatus as any },
            });
          } else if (eventType === "EXTEND_STAY") {
            const newCheckOut = new Date(payload.newCheckOutDate);
            if (isNaN(newCheckOut.getTime()))
              throw new Error("Invalid newCheckOutDate");

            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: { reservationRooms: { where: { status: "ACTIVE" } } },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status === "CHECKED_OUT" || res.status === "CANCELLED")
              throw new Error(`Cannot extend a ${res.status} reservation`);

            if (newCheckOut <= res.checkIn)
              throw new Error("New checkout must be after check-in");
            if (newCheckOut <= res.checkOut)
              throw new Error(
                "New checkout must be after the current checkout date",
              );

            // Conflict check: any other reservation in the same room during extension period
            const activeRoom = res.reservationRooms[0];
            if (activeRoom?.roomId) {
              const conflict = await tx.reservationRoom.findFirst({
                where: {
                  roomId: activeRoom.roomId,
                  status: { notIn: ["INACTIVE", "CANCELLED", "NO_SHOW"] },
                  reservationId: { not: aggregateId },
                  AND: [
                    { checkIn: { lt: newCheckOut } },
                    { checkOut: { gt: res.checkOut } },
                  ],
                },
              });
              if (conflict)
                throw new Error(
                  "Room is not available for the extended period",
                );
            }

            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                checkOut: newCheckOut,
                ratePlanSnapshot: {
                  ...((res.ratePlanSnapshot as any) || {}),
                  nights: Math.ceil(
                    (newCheckOut.getTime() - res.checkIn.getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                  total:
                    Number(
                      activeRoom?.rateAmount ||
                        (res.ratePlanSnapshot as any)?.baseRate ||
                        0,
                    ) *
                    Math.ceil(
                      (newCheckOut.getTime() - res.checkIn.getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                },
              },
            });

            if (activeRoom) {
              await tx.reservationRoom.update({
                where: { id: activeRoom.id },
                data: { checkOut: newCheckOut },
              });
            }
          } else if (eventType === "KEYCARD_ENCODE") {
            const reservation = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: { reservationRooms: { where: { status: "ACTIVE" } } },
            });
            if (!reservation)
              throw new Error("Reservation not found or unauthorized");

            const roomId =
              payload.roomId || reservation.reservationRooms[0]?.roomId;
            if (!roomId)
              throw new Error("Keycard encode event has no room assignment");

            let doorLock = await tx.doorLock.findFirst({ where: { roomId } });
            if (!doorLock) {
              doorLock = await tx.doorLock.create({
                data: {
                  propertyId,
                  roomId,
                  lockCode: `ENCODER-${roomId}`,
                  provider: "DELUNS_ENCODER",
                  status: "ONLINE",
                },
              });
            }

            const encodeData = payload.encodeData || {};
            const credential = await tx.lockCredential.create({
              data: {
                reservationId: aggregateId,
                roomId,
                lockId: doorLock.id,
                credentialType: "rfid",
                status: "ACTIVE",
                validFrom: new Date(),
                validUntil: new Date(reservation.checkOut),
                cardSerialNumber: encodeData.cardSnr || null,
                metadata: encodeData,
              },
            });

            await tx.lockOperation.create({
              data: {
                propertyId,
                reservationId: aggregateId,
                roomId,
                lockId: doorLock.id,
                credentialId: credential.id,
                idempotencyKey: `KEYCARD_ENCODE:${aggregateId}:${payload.operationId || id}`,
                operation: "ENCODE_CARD",
                status: "COMPLETED",
                requestedAt: new Date(),
                startedAt: new Date(),
                completedAt: new Date(),
                metadata: { initiatedBy: actorId, responseData: encodeData },
              },
            });
          } else if (eventType === "EDIT") {
            const res = await tx.reservation.findUnique({
              where: { id: aggregateId, propertyId },
              include: {
                reservationRooms: { orderBy: { createdAt: "desc" }, take: 1 },
              },
            });
            if (!res) throw new Error("Reservation not found or unauthorized");
            if (res.status === "CHECKED_OUT" || res.status === "CANCELLED")
              throw new Error(`Cannot edit a ${res.status} reservation`);
            if (res.status === "CHECKED_IN")
              throw new Error("Cannot edit a CHECKED_IN reservation");

            const p = payload;
            const newCheckIn = p.checkIn ? new Date(p.checkIn) : res.checkIn;
            const newCheckOut = p.checkOut
              ? new Date(p.checkOut)
              : res.checkOut;

            if (newCheckOut <= newCheckIn)
              throw new Error("Check-out must be after check-in");

            // Availability check when dates or room changed
            const newRoomId = p.roomId || res.reservationRooms[0]?.roomId;
            if (newRoomId && (p.checkIn || p.checkOut || p.roomId)) {
              const overlap = await tx.reservationRoom.findFirst({
                where: {
                  roomId: newRoomId,
                  reservationId: { not: aggregateId },
                  status: { notIn: ["INACTIVE", "CANCELLED", "NO_SHOW"] },
                  AND: [
                    { checkIn: { lt: newCheckOut } },
                    { checkOut: { gt: newCheckIn } },
                  ],
                },
              });
              if (overlap)
                throw new Error("Room is not available for the new dates");
            }

            // Recalculate rate if dates or room type changed using RoomType.baseRate
            let newRateAmount: number | undefined = res.reservationRooms[0]
              ?.rateAmount
              ? Number(res.reservationRooms[0].rateAmount)
              : undefined;
            const newRoomTypeId =
              p.roomTypeId || res.reservationRooms[0]?.roomTypeId;
            if (newRoomTypeId && (p.roomTypeId || p.checkIn || p.checkOut)) {
              const rt = await tx.roomType.findFirst({
                where: { id: newRoomTypeId, propertyId },
              });
              if (rt) {
                // ReservationRoom.rateAmount is the nightly rate. The total is
                // represented by the folio room-charge items and snapshot.
                newRateAmount = Number(rt.baseRate);
              }
            }

            await tx.reservation.update({
              where: { id: aggregateId },
              data: {
                primaryGuestId: p.guestId ?? res.primaryGuestId,
                checkIn: newCheckIn,
                checkOut: newCheckOut,
                adults: p.adults ?? res.adults,
                children: p.children ?? res.children,
                specialRequests: p.specialRequests ?? res.specialRequests,
                ...(newRateAmount !== undefined && newRoomTypeId
                  ? {
                      ratePlanSnapshot: {
                        ...((res.ratePlanSnapshot as any) || {}),
                        baseRate: newRateAmount,
                        nights: Math.ceil(
                          (newCheckOut.getTime() - newCheckIn.getTime()) /
                            (1000 * 60 * 60 * 24),
                        ),
                        total:
                          newRateAmount *
                          Math.ceil(
                            (newCheckOut.getTime() - newCheckIn.getTime()) /
                              (1000 * 60 * 60 * 24),
                          ),
                      },
                    }
                  : {}),
              },
            });

            if (res.reservationRooms[0]) {
              await tx.reservationRoom.update({
                where: { id: res.reservationRooms[0].id },
                data: {
                  roomId: newRoomId,
                  roomTypeId: newRoomTypeId,
                  checkIn: newCheckIn,
                  checkOut: newCheckOut,
                  adults: p.adults ?? res.reservationRooms[0].adults,
                  children: p.children ?? res.reservationRooms[0].children,
                  rateAmount: newRateAmount,
                },
              });
            }

            const folio = await tx.folio.findFirst({
              where: { reservationId: aggregateId, propertyId },
            });
            if (folio && (p.checkIn || p.checkOut || p.roomTypeId)) {
              // We no longer recreate room charges here in the incremental model.
            }
          } else if (eventType === "EDIT_GUEST" && aggregateType === "GUEST") {
            const guestId = payload.guestId;
            if (guestId) {
              const existingGuest = await tx.guest.findUnique({
                where: { id: guestId },
              });
              if (existingGuest && existingGuest.propertyId === propertyId) {
                await tx.guest.update({
                  where: { id: guestId },
                  data: {
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    email: payload.email,
                    phone: payload.phone,
                  },
                });
              }
            }
          } else if (
            eventType === "ROOM_STATUS_UPDATE" &&
            aggregateType === "ROOM"
          ) {
            const room = await tx.room.findUnique({
              where: { id: aggregateId },
            });
            if (!room) throw new Error("Room not found or unauthorized");

            const newStatus = payload.newStatus;
            if (room.status !== newStatus) {
              await tx.room.update({
                where: { id: aggregateId },
                data: { status: newStatus },
              });

              await tx.roomStatusHistory.create({
                data: {
                  roomId: aggregateId,
                  propertyId: room.propertyId,
                  previousStatus: room.status,
                  newStatus: newStatus,
                  source: payload.source || "OFFLINE_SYNC",
                  changedBy: actorId,
                },
              });
            }
          } else if (aggregateType === "HOUSEKEEPING_TASK") {
            if (eventType === "CREATE") {
              const roomId = payload.RoomId || payload.roomId;
              if (!isUuid(roomId))
                throw new Error("Housekeeping task is missing a valid roomId");
              const room = await tx.room.findFirst({
                where: { id: roomId, propertyId },
              });
              if (!room)
                throw new Error(
                  "Housekeeping task room not found or unauthorized",
                );
              const taskType = payload.TaskType || payload.taskType || "CLEANING";
              await tx.housekeepingTask.create({
                data: {
                  id: aggregateId,
                  propertyId,
                  roomId,
                  type: taskType,
                  priority: payload.Priority || payload.priority || "NORMAL",
                  status: String(
                    payload.Status || payload.status || "CLEANING",
                  ).replace(/^(PENDING|ASSIGNED|CLEAN)$/i, "CLEANING") as any,
                  businessDate: authoritativeBusinessDate,
                  assignedTo: isUuid(
                    payload.AssignedToUserId || payload.assignedToUserId,
                  )
                    ? payload.AssignedToUserId || payload.assignedToUserId
                    : null,
                },
              });

              // When a CLEANING or STAYOVER task is created the room must
              // immediately become DIRTY so it never shows as AVAILABLE while
              // housekeeping is pending. Only skip this if the room is already
              // OCCUPIED (checked-in guest with a stayover task) — in that case
              // keep OCCUPIED but still record the housekeepingStatus.
              if (taskType === "CLEANING" || taskType === "STAYOVER") {
                const currentRoom = await tx.room.findUnique({
                  where: { id: roomId },
                  select: { status: true },
                });
                const newRoomStatus =
                  currentRoom?.status === "OCCUPIED" ? "OCCUPIED" : "DIRTY";
                await tx.room.update({
                  where: { id: roomId },
                  data: {
                    status: newRoomStatus as any,
                    housekeepingStatus: "CLEANING",
                  },
                });
              }
            } else if (eventType === "UPDATE_STATUS") {
              const currentStatus = String(
                payload.Status || payload.status || "CLEANING",
              ).replace(/^(PENDING|ASSIGNED|CLEAN)$/i, "CLEANING");
              const updateData: any = { status: currentStatus as any };
              if (currentStatus === "IN_PROGRESS") {
                updateData.startedAt = new Date();
              } else if (currentStatus === "COMPLETED") {
                updateData.completedAt = new Date();
              }
              await tx.housekeepingTask.update({
                where: { id: aggregateId },
                data: updateData,
              });
              const task = await tx.housekeepingTask.findUnique({
                where: { id: aggregateId },
                include: { room: { select: { status: true } } }
              });
              if (task) {
                let roomStatus =
                  currentStatus === "CLEANING"
                    ? "CLEANING"
                    : currentStatus === "CLEAN"
                      ? "CLEAN"
                      : currentStatus === "INSPECTED"
                        ? "AVAILABLE"
                        : currentStatus === "MAINTENANCE_REQUIRED"
                          ? "MAINTENANCE"
                          : undefined;

                if (task.room?.status === "OCCUPIED" && (roomStatus === "CLEANING" || roomStatus === "AVAILABLE")) {
                  roomStatus = "OCCUPIED"; // Or undefined, to not change it
                }

                await tx.room.update({
                  where: { id: task.roomId },
                  data: {
                    housekeepingStatus: currentStatus as any,
                    ...(roomStatus ? { status: roomStatus as any } : {}),
                  },
                });
              }
            }
          } else if (aggregateType === "MAINTENANCE_TICKET") {
            if (eventType === "CREATE") {
              // Ensure a category exists, else use a default or fail gracefully
              let cat = await tx.maintenanceCategory.findFirst({
                where: { propertyId },
              });
              if (!cat) {
                cat = await tx.maintenanceCategory.create({
                  data: {
                    propertyId,
                    name: "General",
                    description: "General Maintenance",
                  },
                });
              }
              await tx.maintenanceTicket.create({
                data: {
                  id: aggregateId,
                  propertyId,
                  roomId: payload.RoomId || payload.roomId,
                  location: payload.RoomNumber || payload.roomNumber || null,
                  categoryId: cat.id,
                  priority: (payload.Priority ||
                    payload.priority ||
                    "NORMAL") as any,
                  status: (payload.Status || payload.status || "OPEN") as any,
                  title: "Desktop Maintenance Ticket",
                  description:
                    payload.IssueDescription || payload.issueDescription || "",
                  reportedBy: isUuid(payload.ReportedBy || payload.reportedBy)
                    ? payload.ReportedBy || payload.reportedBy
                    : actorId,
                },
              });
            } else if (eventType === "RESOLVE") {
              await tx.maintenanceTicket.update({
                where: { id: aggregateId },
                data: { status: "RESOLVED" },
              });
            }
          } else if (aggregateType === "LAUNDRY_ORDER") {
            if (eventType === "LAUNDRY_ORDER_CREATED") {
              let finalGuestId = payload.guestId;
              const cType = payload.customerType || "IN_HOUSE";

              if (cType === "WALK_IN" && payload.guest) {
                const phone = payload.guest.Phone || payload.guest.phone;
                if (phone) {
                  const existingGuest = await tx.guest.findFirst({
                    where: {
                      phone: phone,
                      organizationId: property?.organizationId || "",
                      propertyId: propertyId,
                    },
                  });
                  if (existingGuest) {
                    finalGuestId = existingGuest.id;
                  } else {
                    const newGuest = await tx.guest.create({
                      data: {
                        id: finalGuestId,
                        organizationId: property?.organizationId || "",
                        propertyId,
                        firstName:
                          payload.guest.FirstName ||
                          payload.guest.firstName ||
                          "Walk-In",
                        lastName:
                          payload.guest.LastName ||
                          payload.guest.lastName ||
                          "Guest",
                        phone: phone,
                        email:
                          payload.guest.Email || payload.guest.email || null,
                      },
                    });
                    finalGuestId = newGuest.id;
                  }
                }
              }

              const orderItemsData = (payload.items || []).map((i: any) => ({
                itemId: i.itemId,
                quantity: i.quantity,
                unitPrice: i.unitPrice || 0,
                totalPrice: i.totalPrice || 0,
              }));

              await tx.laundryOrder.create({
                data: {
                  id: aggregateId,
                  propertyId,
                  customerType: cType,
                  reservationId:
                    cType === "IN_HOUSE" ? payload.reservationId : null,
                  roomId: cType === "IN_HOUSE" ? payload.roomId : null,
                  guestId: finalGuestId,
                  serviceType: payload.serviceType || "STANDARD",
                  specialNotes: payload.specialNotes || null,
                  totalAmount: payload.totalAmount || 0,
                  currency: "NGN", // Hardcoded currency for sync safety as per LodgeCore standard
                  status: payload.status || "PENDING",
                  createdAt: payload.requestedAt
                    ? new Date(payload.requestedAt)
                    : new Date(),
                  items: {
                    create: orderItemsData,
                  },
                },
              });

              await tx.laundryOrderStatusHistory.create({
                data: {
                  laundryOrderId: aggregateId,
                  newStatus: payload.status || "PENDING",
                  changedBy: actorId,
                  notes: "Order placed offline",
                },
              });
            } else if (eventType === "LAUNDRY_STATUS_UPDATED") {
              const order = await tx.laundryOrder.findUnique({
                where: { id: aggregateId },
                include: {
                  reservation: {
                    include: {
                      folios: { where: { type: "ROOM", status: "OPEN" } },
                    },
                  },
                },
              });
              if (!order) throw new Error("Laundry order not found");

              const newStatus = payload.status;
              if (order.status !== newStatus) {
                const updateData: any = { status: newStatus };
                if (newStatus === "COLLECTED") {
                  updateData.collectedAt = new Date();
                  updateData.collectedBy = actorId;
                } else if (newStatus === "READY") {
                  updateData.readyAt = new Date();
                } else if (newStatus === "DELIVERED") {
                  updateData.deliveredAt = new Date();
                  updateData.deliveredBy = actorId;

                  // ATOMIC FOLIO POSTING for DELIVERED
                  if (!order.folioItemId) {
                    let activeFolio;
                    if (order.customerType === "IN_HOUSE") {
                      const reservation = order.reservation;
                      if (!reservation)
                        throw new Error("IN_HOUSE order has no reservation");
                      activeFolio =
                        reservation.folios.length > 0
                          ? reservation.folios[0]
                          : await tx.folio.create({
                              data: {
                                reservationId: reservation.id,
                                propertyId: order.propertyId,
                                guestId: order.guestId,
                                folioNumber: `FOL-${Date.now()}`,
                                type: "ROOM",
                                status: "OPEN",
                                currency: order.currency,
                              },
                            });
                    } else if (order.customerType === "WALK_IN") {
                      const existingFolios = await tx.folio.findMany({
                        where: {
                          propertyId: order.propertyId,
                          guestId: order.guestId,
                          type: "WALK_IN",
                          status: "OPEN",
                        },
                        take: 1,
                      });
                      activeFolio =
                        existingFolios.length > 0
                          ? existingFolios[0]
                          : await tx.folio.create({
                              data: {
                                propertyId: order.propertyId,
                                guestId: order.guestId,
                                folioNumber: `FOL-${Date.now()}`,
                                type: "WALK_IN",
                                status: "OPEN",
                                currency: order.currency,
                              },
                            });
                    }

                    if (activeFolio && Number(order.totalAmount) > 0) {
                      const idempotencyKey = `${order.id}_DELIVERY_FOLIO_CHARGE`;
                      const existingCharge = await tx.folioItem.findFirst({
                        where: { posTransactionId: idempotencyKey },
                      });

                      let folioItem;
                      if (!existingCharge) {
                        folioItem = await tx.folioItem.create({
                          data: {
                            folioId: activeFolio.id,
                            businessDate: authoritativeBusinessDate,
                            type: "CHARGE",
                            source: "LAUNDRY",
                            description: `Laundry Service - ${order.serviceType}`,
                            quantity: 1,
                            unitAmount: order.totalAmount,
                            amount: order.totalAmount,
                            currency: order.currency,
                            baseAmount: order.totalAmount,
                            postedBy: actorId,
                            posTransactionId: idempotencyKey,
                          },
                        });

                        await tx.folio.update({
                          where: { id: activeFolio.id },
                          data: {
                            totalCharges: { increment: order.totalAmount },
                            balance: { increment: order.totalAmount },
                          },
                        });
                        await applyAvailableFolioCredit(tx, {
                          folioId: activeFolio.id,
                          propertyId: order.propertyId,
                          guestId: activeFolio.guestId,
                          reservationId: activeFolio.reservationId,
                          amount: Number(order.totalAmount),
                          currency: order.currency,
                          source: "LAUNDRY",
                          description: `Applied guest credit to Laundry Service - ${order.serviceType}`,
                          appliedBy: actorId,
                          operationKey: idempotencyKey,
                          businessDate: authoritativeBusinessDate,
                        });
                      } else {
                        folioItem = existingCharge;
                      }
                      updateData.folioItemId = folioItem.id;
                    }
                  }
                }

                await tx.laundryOrder.update({
                  where: { id: aggregateId },
                  data: updateData,
                });

                await tx.laundryOrderStatusHistory.create({
                  data: {
                    laundryOrderId: aggregateId,
                    previousStatus: order.status,
                    newStatus: newStatus,
                    changedBy: actorId,
                    notes: `Status updated to ${newStatus} via offline sync`,
                  },
                });
              }
            }
          } else {
            throw new Error(`Unknown eventType: ${eventType}`);
          }

          // 3. Save Immutable HotelEvent (Subject to unique constraint on aggregateVersion)
          await tx.hotelEvent.create({
            data: {
              id,
              idempotencyKey,
              propertyId,
              deviceId: device.id,
              operatorId: actorId,
              aggregateType,
              aggregateId,
              aggregateVersion,
              eventType,
              occurredAt: new Date(occurredAt || Date.now()),
              sequence,
              payload,
            },
          });
        });

        results.push({ id, status: resultStatus, idempotencyKey });

        // Post-transaction notifications for mobile hub parity
        if (aggregateType === "RESERVATION") {
          try {
            let notificationType = null;
            if (eventType === "CREATE" || eventType === "WALK_IN")
              notificationType = "NEW_RESERVATION";
            else if (eventType === "CHECK_IN") notificationType = "CHECK_IN";
            else if (eventType === "CHECK_OUT") notificationType = "CHECK_OUT";
            else if (eventType === "CANCEL") notificationType = "CANCEL";

            if (notificationType && property.organizationId) {
              await NotificationEngine.emit({
                type: notificationType,
                organizationId: property.organizationId,
                propertyId: property.id,
                entityType: "reservation",
                entityId: aggregateId,
                idempotencyKey: `sync_${notificationType}_${aggregateId}_${Date.now()}`,
              });
            }
          } catch (notifErr) {
            console.error(
              `[Push Sync] Failed to emit notification for ${eventType}:`,
              notifErr,
            );
          }
        } else if (
          aggregateType === "FOLIO" &&
          (eventType === "POST_PAYMENT" || eventType === "ADVANCE_DEPOSIT")
        ) {
          try {
            if (property.organizationId) {
              const amount = Number(payload.amount);
              await NotificationEngine.emit({
                type: "PAYMENT_RECEIVED",
                organizationId: property.organizationId,
                propertyId: property.id,
                entityType: "folio",
                entityId: aggregateId,
                metadata: {
                  amount: amount > 0 ? amount : -amount,
                  currency: payload.currency || "NGN",
                  method:
                    payload.method ||
                    (eventType === "ADVANCE_DEPOSIT" ? "TOP-UP" : "PAYMENT"),
                },
                idempotencyKey: `sync_PAYMENT_${idempotencyKey || id}`,
              });
            }
          } catch (notifErr) {
            console.error(
              `[Push Sync] Failed to emit notification for ${eventType}:`,
              notifErr,
            );
          }
        }
      } catch (err: any) {
        if (err.message === "IDEMPOTENCY_DUPLICATE") {
          // The duplicate marker may be reconstructed by Prisma/transaction
          // wrappers without carrying the original event object. A duplicate
          // is still safely idempotent in that case; only classify it as a
          // conflict when the relation is actually present.
          if (err.existingEvent?.syncConflict) {
            results.push({
              id,
              status: "CONFLICT",
              idempotencyKey,
              error: "Already flagged as conflict.",
            });
          } else {
            results.push({ id, status: "SYNCED", idempotencyKey });
          }
        } else if (
          err.message === "CONCURRENCY_CONFLICT" ||
          err.code === "P2002"
        ) {
          // If P2002, it means another thread inserted the same aggregateVersion for this aggregate.
          let expectedVersion = err.currentVersion || aggregateVersion;

          if (err.code === "P2002") {
            // Fetch the true actual version from DB to populate the conflict correctly
            try {
              if (aggregateType === "FOLIO") {
                const f = await prisma.folio.findUnique({
                  where: { id: rawAggregateId },
                });
                if (f) expectedVersion = f.version;
              } else if (aggregateType === "RESERVATION") {
                const r = await prisma.reservation.findUnique({
                  where: { id: rawAggregateId },
                });
                if (r) expectedVersion = r.version;
              }
            } catch (e) {}
          }
          // We must record the HotelEvent and SyncConflict outside the failed business transaction
          try {
            await prisma.$transaction(async (tx2) => {
              const parsedPayload = JSON.parse(payloadJson || "{}");
              const ev = await tx2.hotelEvent.upsert({
                where: { id },
                update: {
                  idempotencyKey,
                  payload: parsedPayload
                },
                create: {
                  id,
                  idempotencyKey,
                  propertyId,
                  deviceId: device.id,
                  operatorId: isUuid(operatorId) ? operatorId : device.id,
                  aggregateType,
                  aggregateId: rawAggregateId,
                  aggregateVersion,
                  eventType,
                  occurredAt: new Date(occurredAt || Date.now()),
                  sequence,
                  payload: parsedPayload,
                },
              });

              await tx2.syncConflict.upsert({
                where: { hotelEventId: ev.id },
                update: {
                  expectedVersion: expectedVersion,
                  receivedVersion: aggregateVersion,
                  status: "PENDING"
                },
                create: {
                  propertyId,
                  hotelEventId: ev.id,
                  aggregateType,
                  aggregateId: rawAggregateId,
                  expectedVersion: expectedVersion,
                  receivedVersion: aggregateVersion,
                  conflictReason:
                    "Optimistic Concurrency Failure: Edge node operated on stale state.",
                  status: "PENDING",
                },
              });
            });
            results.push({
              id,
              status: "CONFLICT",
              idempotencyKey,
              error: "Concurrency conflict. Manager resolution required.",
            });
          } catch (conflictErr: any) {
            console.error(
              `Error saving conflict for event ${id}:`,
              conflictErr,
            );
            results.push({
              id,
              status: "FAILED",
              idempotencyKey,
              error: "Failed to record conflict state.",
            });
          }
        } else {
          console.error(`Error processing event ${id}:`, err);
          results.push({
            id,
            status: "FAILED",
            idempotencyKey,
            error: err.message,
          });
        }
      }
    }

    return NextResponse.json(
      {
        status: "SUCCESS",
        results,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error(`[sync/frontdesk-push] request=${requestId} failed`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
