import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { PurchaseOrderPaymentService } from '@/lib/services/purchase-order-payment-service';


export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'MODULE_ACCOUNTING', ctx.propertyIds[0]);


    const { id: purchaseOrderId } = await context.params;
    const body = await req.json();

    const payment = await PurchaseOrderPaymentService.recordAdvancePayment(ctx, purchaseOrderId, {
      amount: Number(body.amount),
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      paymentMethod: String(body.paymentMethod || 'BANK_TRANSFER'),
      bankReference: body.bankReference ? String(body.bankReference) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
