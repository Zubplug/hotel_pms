import { NextRequest, NextResponse } from 'next/server';
import { issueEventInvoice, reviewEventInvoice } from '@/lib/events/accounting-actions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action === 'issue') {
      const invoice = await issueEventInvoice(id);
      return NextResponse.json({ data: { id: invoice.id, status: invoice.status, workflowStatus: invoice.workflowStatus } });
    }
    if (body.action === 'approve' || body.action === 'reject') {
      const invoice = await reviewEventInvoice(id, {
        approve: body.action === 'approve',
        discountAmount: body.discountAmount == null ? undefined : Number(body.discountAmount),
        discountReason: typeof body.discountReason === 'string' ? body.discountReason : undefined,
        lineDiscounts: body.lineDiscounts && typeof body.lineDiscounts === 'object' ? body.lineDiscounts : undefined,
        lineReasons: body.lineReasons && typeof body.lineReasons === 'object' ? body.lineReasons : undefined,
      });
      return NextResponse.json({ data: { id: invoice.id, status: invoice.status, workflowStatus: invoice.workflowStatus } });
    }
    return NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to process event invoice approval' }, { status: 400 });
  }
}
