import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { SupplierInvoiceService } from '@/lib/services/supplier-invoice-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    }

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filters: any = {};
    const status = searchParams.get('status');
    if (status) filters.status = status;
    
    const supplierId = searchParams.get('supplierId');
    if (supplierId) filters.supplierId = supplierId;
    
    const fromDate = searchParams.get('fromDate');
    if (fromDate) filters.fromDate = new Date(fromDate);
    
    const toDate = searchParams.get('toDate');
    if (toDate) filters.toDate = new Date(toDate);

    const result = await SupplierInvoiceService.list(ctx, propertyId, filters);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId, ...inputData } = body;
    
    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    }

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Convert string dates to Date objects
    if (inputData.invoiceDate) inputData.invoiceDate = new Date(inputData.invoiceDate);
    if (inputData.dueDate) inputData.dueDate = new Date(inputData.dueDate);
    if (inputData.receivedDate) inputData.receivedDate = new Date(inputData.receivedDate);

    const result = await SupplierInvoiceService.create(ctx, { propertyId, ...inputData });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
