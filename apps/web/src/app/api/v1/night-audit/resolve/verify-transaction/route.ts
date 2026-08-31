import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = (session.user as any).role;
    const ALLOWED_ROLES = ['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to verify transactions', 403);
    }

    const body = await req.json();
    const { propertyId, transactionId, type, status, notes, idempotencyKey } = body;

    if (!propertyId || !transactionId || !type || !status) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    if (!['PAYMENT', 'POS_PAYMENT'].includes(type)) {
      return errorResponse('BAD_REQUEST', 'Invalid transaction type', 400);
    }

    if (!['VERIFIED', 'QUESTIONED'].includes(status)) {
      return errorResponse('BAD_REQUEST', 'Invalid verification status', 400);
    }

    if (status === 'QUESTIONED' && !notes?.trim()) {
      return errorResponse('BAD_REQUEST', 'Notes are required when questioning a transaction', 400);
    }

    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Prevent double submission using idempotencyKey by creating an AuditLog.
    // If it already exists, the unique constraint will fail, or we can check first.
    // Wait, AuditLog requires a lot of fields. Let's do the idempotency check in the transaction.

    await prisma.$transaction(async (tx) => {
      // 1. Lock the transaction
      let transactionRecord;
      if (type === 'PAYMENT') {
        const [row] = await tx.$queryRaw<any[]>`
          SELECT * FROM "Payment"
          WHERE id = ${transactionId}::uuid AND "propertyId" = ${propertyId}::uuid
          FOR UPDATE
        `;
        transactionRecord = row;
      } else {
        const [row] = await tx.$queryRaw<any[]>`
          SELECT p.* FROM "PosPayment" p
          JOIN "PosOrder" o ON p."orderId" = o.id
          JOIN "PosOutlet" out ON o."outletId" = out.id
          WHERE p.id = ${transactionId}::uuid AND out."propertyId" = ${propertyId}::uuid
          FOR UPDATE
        `;
        transactionRecord = row;
      }

      if (!transactionRecord) {
        throw new Error('NOT_FOUND: Transaction not found or access denied');
      }

      if (transactionRecord.verificationStatus !== 'UNVERIFIED') {
        throw new Error('CONFLICT: This transaction has already been processed');
      }

      // 2. Perform the update
      const updateData = {
        verificationStatus: status,
        verifiedAt: new Date(),
        verifiedById: session.user.id,
        verificationNotes: notes || null,
      };

      if (type === 'PAYMENT') {
        await tx.payment.update({
          where: { id: transactionId },
          data: updateData,
        });
      } else {
        await tx.posPayment.update({
          where: { id: transactionId },
          data: updateData,
        });
      }

      // 3. Create TransactionException if QUESTIONED
      if (status === 'QUESTIONED') {
        const property = await tx.property.findUnique({
          where: { id: propertyId },
          select: { businessDate: true }
        });
        
        await tx.transactionException.create({
          data: {
            paymentId: type === 'PAYMENT' ? transactionId : null,
            posPaymentId: type === 'POS_PAYMENT' ? transactionId : null,
            questionReason: notes || 'No reason provided',
            questionedById: session.user.id,
            propertyId: propertyId,
            businessDate: property?.businessDate || new Date()
          }
        });
      }

      // 4. Create AuditLog
      if (idempotencyKey) {
        await tx.financialAuditLog.create({
          data: {
            operationId: `VERIFY_${transactionId}`,
            propertyId: propertyId,
            transactionId: transactionId,
            operationType: 'TRANSACTION_VERIFICATION',
            operatorId: session.user.id,
            operatorRole: userRole,
            businessDate: new Date(), // Ideally we use property business date, fallback to now
            approvalStatus: status,
            idempotencyKey: idempotencyKey,
            reason: notes || null,
            metadata: { type }
          }
        });
      }
    });

    return successResponse({ message: 'Transaction verification recorded successfully' });
  } catch (error: any) {
    if (error.message.startsWith('NOT_FOUND:')) return errorResponse('NOT_FOUND', error.message.split(':')[1].trim(), 404);
    if (error.message.startsWith('CONFLICT:')) return errorResponse('CONFLICT', error.message.split(':')[1].trim(), 409);
    if (error.message.startsWith('BAD_REQUEST:')) return errorResponse('BAD_REQUEST', error.message.split(':')[1].trim(), 400);
    // If idempotency key violation
    if (error.code === 'P2002') return errorResponse('CONFLICT', 'Idempotency conflict: this request was already processed', 409);
    
    console.error('Failed to verify transaction:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to verify transaction', 500);
  }
}
