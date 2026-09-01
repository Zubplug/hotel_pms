import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { ApprovalService } from '@/lib/discounts/approval-service';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const session = await auth();
    const user = session?.user;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, percentage, reason } = await req.json();

    // Load the order to validate property access
    const order = await prisma.posOrder.findUnique({
      where: { id: params.orderId },
      include: { outlet: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Generate request hash
    const payload = `${order.outlet.propertyId}:${order.outletId}:${'web-terminal'}:${order.id}:${amount || 0}:${percentage || 0}:${reason}:${user.id}:`;
    const requestHash = crypto.createHash('sha256').update(payload).digest('hex');
    const idempotencyKey = `discount_${order.id}_${Date.now()}`;

    // Request the discount
    const approval = await ApprovalService.requestDiscount(user.id, {
      propertyId: order.outlet.propertyId,
      outletId: order.outletId,
      terminalId: 'web-terminal',
      amount,
      percentage,
      reason,
      idempotencyKey,
      requestHash,
      details: { orderId: order.id, orderTotal: Number(order.total) }
    });

    if (approval.status === 'APPROVED') {
      // Execute it immediately if auto-approved
      await ApprovalService.executeDiscount(approval.id, async (tx) => {
        // Calculate effective discount
        const subtotal = Number(order.subtotal);
        let effectiveDiscount = 0;
        if (amount > 0) effectiveDiscount = amount;
        else if (percentage > 0) effectiveDiscount = subtotal * (percentage / 100);

        // Update the order
        const updatedTotal = subtotal + Number(order.serviceCharge) - effectiveDiscount;
        await tx.posOrder.update({
          where: { id: order.id },
          data: { 
            discount: effectiveDiscount,
            total: updatedTotal
          }
        });
      });
      return NextResponse.json({ data: { success: true } });
    } else {
      return NextResponse.json({ data: { requiresApproval: true, approvalId: approval.id } });
    }
  } catch (error: any) {
    console.error('POS Discount Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to request discount' }, { status: 500 });
  }
}
