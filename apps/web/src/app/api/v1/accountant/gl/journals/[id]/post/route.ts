import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await requireOrganizationContext(session.user.id);
    
    // Call postJournalEntry as instructed
    const result = await (GeneralLedgerService as any).postJournalEntry(ctx, (await params).id);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
