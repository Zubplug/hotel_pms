import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { SupplierInvoiceService } from '@/lib/services/supplier-invoice-service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { grnId, invoiceData } = body;
    
    if (!grnId || !invoiceData) {
      return NextResponse.json({ error: 'Missing grnId or invoiceData' }, { status: 400 });
    }

    // Convert string dates to Date objects in invoiceData
    if (invoiceData.invoiceDate) invoiceData.invoiceDate = new Date(invoiceData.invoiceDate);
    if (invoiceData.dueDate) invoiceData.dueDate = new Date(invoiceData.dueDate);

    const ctx = await requireOrganizationContext(session.user.id);
    const result = await SupplierInvoiceService.createFromGRN(ctx, grnId, invoiceData);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
