import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { FixedAssetService } from '@/lib/services/fixed-asset-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { disposalDate, disposalAmount, disposalReason } = body;

    if (!disposalDate || disposalAmount === undefined || !disposalReason) {
      return NextResponse.json({ error: 'Missing required disposal fields' }, { status: 400 });
    }

    const ctx = await requireOrganizationContext(session.user.id);

    const input = {
      disposalDate: new Date(disposalDate),
      disposalAmount: Number(disposalAmount),
      disposalReason
    };

    const result = await FixedAssetService.recordDisposal(ctx, (await params).id, input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
