import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const role = String(user.role || '').toUpperCase();
    const canViewStockTransfers = user.isSuperAdmin || role === 'STOCK_MANAGER';
    const propertyId = req.nextUrl.searchParams.get('propertyId') || 'ALL_AUTHORIZED';
    const allowedPropertyIds = ctx.propertyIds;
    const targetProperties = propertyId === 'ALL_AUTHORIZED' ? [...allowedPropertyIds] : [propertyId];

    if (targetProperties.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }


    const [pendingApprovals, stockTransfers, purchaseOrders] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: {
          propertyId: { in: targetProperties },
          status: 'PENDING'
        },
        include: {
          property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.stockTransfer.findMany({
        where: {
          propertyId: { in: targetProperties },
          ...(canViewStockTransfers ? {
            OR: [
              { status: 'PENDING_APPROVAL' },
              { status: 'ISSUED' },
            ]
          } : { id: { in: [] } }),
        },
        include: {
          property: { select: { name: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true, posOutletId: true } },
          items: {
            include: { stockItem: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.purchaseOrder.findMany({
        where: {
          propertyId: { in: targetProperties },
          status: 'SUBMITTED',
          ...(user.isSuperAdmin ? {} : role === 'ACCOUNTANT'
            ? { OR: [{ approvalStage: 'ACCOUNTANT' }, { approvalStage: null }] }
            : role === 'GENERAL_MANAGER'
              ? { approvalStage: 'GENERAL_MANAGER' }
              : { propertyId: { in: [] } }),
        },
        include: {
          property: { select: { name: true } },
          supplier: { select: { name: true, contactName: true, phone: true, email: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    ]);

    // Format stock transfers to match the ApprovalRequest shape for the UI
    const mappedTransfers = stockTransfers.map(st => {
      const totalValue = st.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.stockItem.costPrice || 0), 0);
      return {
        id: st.id,
        propertyId: st.propertyId,
        property: st.property,
        type: 'STOCK_TRANSFER',
        source: 'STOCK_TRANSFER',
        status: 'PENDING', // Mapped visually to 'Pending' in UI
        amount: totalValue,
        currency: 'NGN',
        reason: st.notes || 'No reason provided',
        details: {
          reference: st.transferRef,
          productName: `Transfer: ${st.fromWarehouse.name} to ${st.toWarehouse.name}`,
          isOutletBound: Boolean(st.toWarehouse.posOutletId),
          originalStatus: st.status, // PENDING_APPROVAL or ISSUED
        },
        requestedAt: st.createdAt.toISOString()
      };
    });

    const stockItemIds = [...new Set(purchaseOrders.flatMap((purchaseOrder) => purchaseOrder.items.map((item) => item.stockItemId).filter((id): id is string => Boolean(id))))];
    const stockItems = stockItemIds.length ? await prisma.stockItem.findMany({ where: { id: { in: stockItemIds } }, select: { id: true, name: true, baseUnit: true } }) : [];
    const stockItemById = new Map(stockItems.map((item) => [item.id, item]));
    const mappedPurchaseOrders = purchaseOrders.map((po) => ({
      id: po.id,
      propertyId: po.propertyId,
      property: po.property,
      type: 'PURCHASE_ORDER',
      source: 'PURCHASE_ORDER',
      status: 'PENDING',
      amount: po.totalAmount,
      currency: po.currency,
      reason: po.notes || 'Purchase order awaiting approval',
      requestedBy: po.createdBy,
      requestedAt: po.createdAt.toISOString(),
      details: {
        reference: po.poNumber,
        productName: `Purchase order ${po.poNumber}`,
        approvalStage: po.approvalStage || 'ACCOUNTANT',
        supplier: po.supplier,
        items: po.items.map((item) => ({ ...item, stockItem: item.stockItemId ? stockItemById.get(item.stockItemId) || null : null })),
        totalAmount: po.totalAmount,
      },
    }));

    const requesterIds = [...new Set(pendingApprovals.map((approval) => approval.requestedBy).filter(Boolean))];
    const requesterStaff = requesterIds.length ? await prisma.staff.findMany({
      where: { OR: [{ id: { in: requesterIds } }, { userId: { in: requesterIds } }] },
      select: { id: true, userId: true, firstName: true, lastName: true, employeeId: true, position: true, department: true },
    }) : [];
    const requesterById = new Map(requesterStaff.flatMap((staff) => [
      [staff.id, staff] as const,
      ...(staff.userId ? [[staff.userId, staff] as const] : []),
    ]));
    // Approval records created by older workflows may store the assigned
    // approver as a Staff.id, while newer workflows store User.id. Resolve
    // both identities for the signed-in user before applying assignment scope.
    const currentStaff = await prisma.staff.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    const currentIdentityIds = new Set(
      [user.id, currentStaff?.id].filter((id): id is string => Boolean(id)),
    );

    const managementRoles = new Set([
      'GENERAL_MANAGER',
      'HOTEL_MANAGER',
      'MANAGER',
      'DIRECTOR',
      'CEO',
      'EXECUTIVE',
      'ADMIN',
      'NIGHT_AUDITOR',
    ]);
    const stageRoles: Record<string, Set<string>> = {
      ACCOUNTANT_REVIEW: new Set(['ACCOUNTANT', 'FINANCE_MANAGER']),
      GENERAL_CASHIER_REVIEW: new Set(['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER']),
      MANAGEMENT_REVIEW: managementRoles,
      GENERAL_MANAGER_REVIEW: managementRoles,
      PROPERTY_MANAGER_REVIEW: managementRoles,
      MANAGER_REVIEW: managementRoles,
    };
    const roleAliases: Record<string, Set<string>> = {
      GENERAL_MANAGER: new Set(['GENERAL_MANAGER', 'HOTEL_MANAGER', 'MANAGER']),
      HOTEL_MANAGER: new Set(['HOTEL_MANAGER', 'MANAGER']),
      MANAGER: new Set(['MANAGER']),
    };
    const canViewApproval = (approval: (typeof pendingApprovals)[number]) => {
      if (user.isSuperAdmin) return true;

      const details = (approval.details || {}) as Record<string, unknown>;
      const assignedUserId = details.approverId || details.currentApproverId || details.assignedTo;
      if (assignedUserId) {
        const assigned = String(assignedUserId);
        // Some legacy payloads put a role name in assignedTo. That is a role
        // hint, not a user assignment, so let the stage/role checks below
        // decide visibility instead of hiding the request.
        const isRoleLabel = managementRoles.has(assigned.toUpperCase()) ||
          assigned.toUpperCase().endsWith('_REVIEW');
        if (!isRoleLabel && !currentIdentityIds.has(assigned)) return false;
      }

      const requester = requesterById.get(approval.requestedBy);
      if (approval.requestedBy === user.id || requester?.userId === user.id) return false;

      const requiredRole = details.approverRole || details.requiredRole;
      if (requiredRole) {
        const required = String(requiredRole).toUpperCase();
        const compatibleRoles = roleAliases[role] || new Set([role]);
        if (!compatibleRoles.has(required)) return false;
      }

      const stage = String(details.stage || details.approvalStage || '').toUpperCase();
      if (stage && stageRoles[stage]) return stageRoles[stage].has(role);

      // Legacy requests may not have a stage. Keep them with management users,
      // which matches the historic executive approval behavior.
      return managementRoles.has(role);
    };
    const scopedPendingApprovals = pendingApprovals.filter(canViewApproval);

    const discountRoomIds = pendingApprovals
      .filter((approval) => approval.type === 'DISCOUNT')
      .map((approval) => {
        const snapshot = (approval.snapshot || {}) as Record<string, unknown>;
        const details = (approval.details || {}) as Record<string, unknown>;
        return String(snapshot.reservationRoomId || details.reservationRoomId || '');
      })
      .filter(Boolean);
    const reviewRooms = discountRoomIds.length ? await prisma.reservationRoom.findMany({
      where: { id: { in: discountRoomIds } },
      select: {
        id: true,
        reservationId: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        rateAmount: true,
        currency: true,
        status: true,
        room: { select: { number: true, name: true, roomType: { select: { name: true, code: true } } } },
        reservation: {
          select: {
            confirmationNumber: true,
            checkIn: true,
            checkOut: true,
            status: true,
            source: true,
            adults: true,
            children: true,
            specialRequests: true,
            primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true, companyName: true, isVip: true, vipLevel: true } },
          },
        },
      },
    }) : [];
    const reviewRoomById = new Map(reviewRooms.map((room) => [room.id, room]));
    const enrichedApprovals = scopedPendingApprovals.map((approval) => {
      const staff = requesterById.get(approval.requestedBy);
      const requestedByName = staff
        ? `${staff.firstName || ''} ${staff.lastName || ''}`.replace(/\s+/g, ' ').trim()
        : null;
      const requesterDetails = {
        requestedByName: requestedByName || null,
        requesterEmployeeId: staff?.employeeId || null,
        requesterPosition: staff?.position || staff?.department || null,
      };
      if (approval.type !== 'DISCOUNT') {
        return { ...approval, source: 'APPROVAL_REQUEST', details: { ...((approval.details || {}) as Record<string, unknown>), ...requesterDetails } };
      }
      const snapshot = (approval.snapshot || {}) as Record<string, unknown>;
      const details = (approval.details || {}) as Record<string, unknown>;
      const roomId = String(snapshot.reservationRoomId || details.reservationRoomId || '');
      const reviewRoom = reviewRoomById.get(roomId);
      const guest = reviewRoom?.reservation?.primaryGuest;
      const guestName = guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.replace(/\s+/g, ' ').trim() : null;
      return {
        ...approval,
        source: 'APPROVAL_REQUEST',
        details: {
          ...details,
          ...requesterDetails,
          review: reviewRoom || null,
          guestName: guestName || null,
          roomNumber: reviewRoom?.room?.number || null,
          roomType: reviewRoom?.room?.roomType?.name || null,
          confirmationNumber: reviewRoom?.reservation?.confirmationNumber || null,
          checkIn: reviewRoom?.reservation?.checkIn || reviewRoom?.checkIn || null,
          checkOut: reviewRoom?.reservation?.checkOut || reviewRoom?.checkOut || null,
          guestEmail: guest?.email || null,
          isVip: Boolean(guest?.isVip),
        },
      };
    });

    const [cashExpenses, reimbursementClaims, employeeLoans, salaryAdvances] = await Promise.all([
      prisma.cashExpense.findMany({
        where: { propertyId: { in: targetProperties }, status: 'PENDING_APPROVAL', currentApprovalStage: 'GENERAL_MANAGER' },
        orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, propertyId: true, expenseReference: true, amount: true, currency: true, category: true, description: true, payee: true, requestedBy: true, currentApprovalStage: true, requestedAt: true, createdAt: true },
      }),
      prisma.expenseClaim.findMany({
        where: { propertyId: { in: targetProperties }, status: 'GENERAL_MANAGER_REVIEW' },
        orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, propertyId: true, claimNumber: true, amount: true, currency: true, category: true, description: true, staff: { select: { firstName: true, lastName: true, employeeId: true } }, createdAt: true },
      }),
      prisma.employeeLoan.findMany({
        where: { propertyId: { in: targetProperties }, status: 'MANAGER_REVIEW' },
        orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, propertyId: true, loanNumber: true, principalAmount: true, reason: true, staff: { select: { firstName: true, lastName: true, employeeId: true } }, createdAt: true },
      }),
      prisma.salaryAdvance.findMany({
        where: { propertyId: { in: targetProperties }, status: 'MANAGER_REVIEW' },
        orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, propertyId: true, amount: true, reason: true, staff: { select: { firstName: true, lastName: true, employeeId: true } }, createdAt: true },
      }),
    ]);

    const mappedExpenses = cashExpenses.map((item) => ({
      id: item.id, propertyId: item.propertyId, source: 'EXPENSE', type: 'EXPENSE', status: 'PENDING',
      amount: Number(item.amount), currency: item.currency, reason: item.description,
      requestedBy: item.requestedBy, requestedAt: item.requestedAt.toISOString(),
      details: { reference: item.expenseReference, category: item.category, payee: item.payee, stage: item.currentApprovalStage },
    }));
    const mappedClaims = reimbursementClaims.map((item) => ({
      id: item.id, propertyId: item.propertyId, source: 'EMPLOYEE_REIMBURSEMENT', type: 'EMPLOYEE_REIMBURSEMENT', status: 'PENDING',
      amount: Number(item.amount), currency: item.currency, reason: item.description,
      requestedBy: item.staff.employeeId || `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), requestedAt: item.createdAt.toISOString(),
      details: { claimNumber: item.claimNumber, category: item.category, staffName: `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), stage: 'GENERAL_MANAGER_REVIEW' },
    }));
    const mappedLoans = employeeLoans.map((item) => ({
      id: item.id, propertyId: item.propertyId, source: 'EMPLOYEE_BENEFIT', type: 'EMPLOYEE_BENEFIT', status: 'PENDING',
      amount: Number(item.principalAmount), currency: 'NGN', reason: item.reason,
      requestedBy: item.staff.employeeId || `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), requestedAt: item.createdAt.toISOString(),
      details: { benefitType: 'LOAN', loanNumber: item.loanNumber, staffName: `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), stage: 'MANAGER_REVIEW' },
    }));
    const mappedAdvances = salaryAdvances.map((item) => ({
      id: item.id, propertyId: item.propertyId, source: 'EMPLOYEE_BENEFIT', type: 'EMPLOYEE_BENEFIT', status: 'PENDING',
      amount: Number(item.amount), currency: 'NGN', reason: item.reason,
      requestedBy: item.staff.employeeId || `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), requestedAt: item.createdAt.toISOString(),
      details: { benefitType: 'ADVANCE', staffName: `${item.staff.firstName || ''} ${item.staff.lastName || ''}`.trim(), stage: 'MANAGER_REVIEW' },
    }));

    const combined = [...enrichedApprovals, ...mappedTransfers, ...mappedPurchaseOrders, ...mappedExpenses, ...mappedClaims, ...mappedLoans, ...mappedAdvances]
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      .slice(0, 100);

    return successResponse(combined, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Approvals GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching approvals', 500);
  }
}
