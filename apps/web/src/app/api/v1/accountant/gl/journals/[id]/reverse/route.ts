import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body.reason) return NextResponse.json({ error: 'Missing reason' }, { status: 400 });

    const ctx = await requireOrganizationContext(session.user.id);
    
    let result;
    if ('reverseJournalEntry' in GeneralLedgerService) {
      result = await (GeneralLedgerService as any).reverseJournalEntry(ctx, (await params).id, body.reason);
    } else {
      result = await GeneralLedgerService.reverseJournal(
        ctx, 
        (await params).id, 
        body.reversalDate ? new Date(body.reversalDate) : new Date(), 
        body.reason
      );
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
