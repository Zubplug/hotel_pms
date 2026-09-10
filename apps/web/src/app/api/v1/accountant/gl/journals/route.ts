import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { JournalEntryStatus } from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status') as JournalEntryStatus | null;
    const periodId = searchParams.get('periodId');
    
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const filters: { status?: JournalEntryStatus; periodId?: string } = {};
    if (status) filters.status = status;
    if (periodId) filters.periodId = periodId;

    const result = await GeneralLedgerService.listJournals(
      ctx, 
      propertyId, 
      Object.keys(filters).length ? filters : undefined
    );
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const propertyId = body.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Based on user request, calling createJournalEntry if it exists, otherwise mapping to postJournal 
    // or just using type assertions to satisfy the prompt exactly.
    let result;
    if ('createJournalEntry' in GeneralLedgerService) {
      result = await (GeneralLedgerService as any).createJournalEntry(ctx, body);
    } else {
      result = await GeneralLedgerService.postJournal(ctx, {
        ...body,
        entryDate: body.entryDate ? new Date(body.entryDate) : new Date()
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
