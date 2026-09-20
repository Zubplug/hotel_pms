import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasFinancialRole, CASH_HANDOVER_ROLES } from '@/lib/financial-control-access';
import { ensureCashierControlAccountsForClient } from '@/lib/services/cash-account-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { ShiftControlService } from '@/lib/services/shift-control-service';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

const amountOf = (value: unknown) => Number(value ?? 0);

/**
 * Records a controlled transfer from a POS drawer to the General Cashier Safe.
 * The drawer is identified through its cash-payment movement account; this
 * keeps the cash subledger and the shift-control calculation aligned.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = String((actor.user as any).role || '').toUpperCase();
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole(role, CASH_HANDOVER_ROLES)) {
      return NextResponse.json({ error: 'Cash-control authorization required' }, { status: 403 });
    }

    const body = await request.json();
    const drawerId = String(body.drawerId || '');
    const amount = amountOf(body.amount);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const operationId = String(body.operationId || `cash-drop-${crypto.randomUUID()}`);

    if (!drawerId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'A drawer and a valid positive amount are required' }, { status: 400 });
    }

    const ctx = await requireOrganizationContext(actor.user.id);
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.posCashMovement.findUnique({ where: { operationId } });
      if (existing) return existing;

      const drawer = await tx.posSession.findUnique({
        where: { id: drawerId },
        include: { cashMovements: { orderBy: { createdAt: 'asc' } }, outlet: { select: { name: true } }, property: { select: { id: true, baseCurrency: true, businessDate: true, organizationId: true } } },
      });
      if (!drawer || !drawer.propertyId || !drawer.property || !ctx.propertyIds.includes(drawer.propertyId)) {
        throw new Error('Drawer not found or access denied');
      }
      if (await isNightAuditTransactionLocked(drawer.propertyId)) {
        throw new Error('Cash drops are temporarily locked while Night Audit is posting');
      }
      if (!['OPEN', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'HANDOVER_PENDING'].includes(drawer.controlStatus)) {
        throw new Error(`Cash drop is not allowed from a drawer in ${drawer.controlStatus} status`);
      }

      const sourceType = drawer.bankingModel === 'SERVER_BANKING' ? 'SERVER_BANK' : 'STATION_BANK';
      const sourceMovement = drawer.cashMovements.find(movement => movement.type === 'PAYMENT') || drawer.cashMovements[0];
      const sourceAccount = (drawer.outletId
        ? await tx.cashAccount.findFirst({ where: { propertyId: drawer.propertyId, outletId: drawer.outletId, type: sourceType, isActive: true } })
        : null) || (sourceMovement ? await tx.cashAccount.findUnique({ where: { id: sourceMovement.sourceAccountId } }) : null);
      if (!sourceAccount) throw new Error('The drawer cash account is unavailable');
      if (!sourceAccount || sourceAccount.propertyId !== drawer.propertyId || !sourceAccount.isActive) {
        throw new Error('The drawer cash account is unavailable');
      }
      if (!sourceAccount.glAccountId) throw new Error(`Map ${sourceAccount.name} to a GL account before recording a cash drop`);

      const controlAccounts = await ensureCashierControlAccountsForClient(ctx, tx, drawer.propertyId);
      const safeAccount = controlAccounts.find(account => account.type === 'SAFE');
      if (!safeAccount) throw new Error('General Cashier Safe is unavailable');
      if (!safeAccount.glAccountId) throw new Error('Map General Cashier Safe to a GL account before recording a cash drop');

      const available = await ShiftControlService.recalculateExpectedCash(tx, 'POS', drawer.id);
      if (amount > available + 0.005) {
        throw new Error(`Amount exceeds the drawer cash available of ${available.toFixed(2)}`);
      }

      const currency = drawer.property.baseCurrency || 'NGN';
      const reference = `DROP-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const movement = await tx.posCashMovement.create({
        data: {
          id: crypto.randomUUID(),
          propertyId: drawer.propertyId,
          deviceId: 'web-accountant-cash-bank',
          posSessionId: drawer.id,
          userId: ctx.userId,
          amount,
          currency,
          type: 'CASH_DROP',
          sourceAccountId: sourceAccount.id,
          destinationAccountId: safeAccount.id,
          reasonCode: 'ACCOUNTANT_CASH_DROP',
          notes: notes || null,
          receiptReference: reference,
          operationId,
          businessDate: drawer.businessDate,
          authorizedBy: ctx.userId,
        },
      });

      await tx.cashAccount.update({ where: { id: sourceAccount.id }, data: { balance: { decrement: amount } } });
      await tx.cashAccount.update({ where: { id: safeAccount.id }, data: { balance: { increment: amount } } });

      await GeneralLedgerService.postJournal(ctx, {
        propertyId: drawer.propertyId,
        entryDate: drawer.businessDate,
        description: `Cash drop from ${drawer.outlet?.name || drawer.outletId} to General Cashier Safe`,
        reference,
        sourceModule: 'CASH_MANAGEMENT',
        lines: [
          { accountId: safeAccount.glAccountId, debit: amount, credit: 0, description: 'Cash received into General Cashier Safe', sourceType: 'CASH_DROP', sourceId: movement.id },
          { accountId: sourceAccount.glAccountId, debit: 0, credit: amount, description: `Cash removed from ${sourceAccount.name}`, sourceType: 'CASH_DROP', sourceId: movement.id },
        ],
      }, tx);

      await tx.shiftControlAudit.create({
        data: {
          id: crypto.randomUUID(),
          propertyId: drawer.propertyId,
          posSessionId: drawer.id,
          action: 'CASH_DROP_RECORDED',
          fromStatus: drawer.controlStatus,
          toStatus: drawer.controlStatus,
          performedBy: ctx.userId,
          reason: notes || 'Accountant recorded cash drop',
          metadata: { movementId: movement.id, amount, reference },
          idempotencyKey: `cash-drop-audit-${operationId}`,
        },
      });

      return movement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error('[Accountant cash drop]', error);
    const message = error?.message || 'Unable to record cash drop';
    const status = message.includes('access denied') || message.includes('authorization') ? 403 : message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
