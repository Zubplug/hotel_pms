import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { SupplierInvoiceService } from '@/lib/services/supplier-invoice-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });
    }

    const body = await req.json();
    const { payment } = body;

    if (!payment) {
      return NextResponse.json({ error: 'Missing payment object' }, { status: 400 });
    }

    if (payment.paymentDate) {
      payment.paymentDate = new Date(payment.paymentDate);
    }

    const ctx = await requireOrganizationContext(session.user.id);
    const result = await SupplierInvoiceService.recordPayment(ctx, id, payment);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
