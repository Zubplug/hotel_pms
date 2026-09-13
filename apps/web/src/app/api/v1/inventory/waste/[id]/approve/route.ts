import { NextResponse } from 'next/server';
import { WasteService } from '@/lib/inventory/WasteService';
import { auth } from '@/lib/auth';
import crypto from 'crypto';

export const POST = auth(async (req: any, { params }: any) => {
  if (!req.auth) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const actorId = req.auth.user.id;
  const wasteId = params.id;

  try {
    const body = await req.json();
    const action = body.action; // 'APPROVE' | 'REJECT'
    const operationId = body.operationId || crypto.randomUUID(); // For idempotency

    let result;
    if (action === 'APPROVE') {
      result = await WasteService.approveWaste(wasteId, actorId, operationId);
    } else if (action === 'REJECT') {
      result = await WasteService.rejectWaste(wasteId, actorId);
    } else {
      throw new Error('Invalid action. Must be APPROVE or REJECT');
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Waste Approve POST error:', error);
    return NextResponse.json({ error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
});
