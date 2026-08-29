import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outletId');
    const sessionId = searchParams.get('sessionId');
    const authHeader = req.headers.get('Authorization');

    if (!outletId || !sessionId || !authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const token = authHeader.split(' ')[1];

    // Validate operator token
    const payload = await verifyOperatorToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid operator' }, { status: 401 });
    }

    // Verify session
    const session = await prisma.posSession.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.outletId !== outletId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // Fetch Production Batches (KOTs) created by this operator in this session's business date
    const batches = await prisma.posProductionBatch.findMany({
      where: {
        firedByStaffId: payload.staffId,
        // This modal is the POS operator's kitchen-ticket view. Bar and
        // other production stations have their own displays and must not
        // appear here.
        station: 'KITCHEN',
        order: {
          outletId: outletId,
          sessionId: sessionId,
        }
      },
      include: {
        order: {
          select: {
            tableNumber: true,
            orderNumber: true,
            orderType: true
          }
        },
        items: true // Includes productName, quantity, modifiers
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map PosProductionBatch to the KOT format expected by the frontend
    const kots = batches.map(batch => ({
      id: batch.id,
      station: batch.station,
      kotNumber: `${batch.order.orderNumber}-${batch.batchNumber}`,
      status: batch.status,
      createdAt: batch.createdAt,
      order: {
        tableNumber: batch.order.tableNumber,
        orderNumber: batch.order.orderNumber,
        orderType: batch.order.orderType
      },
      items: batch.items.map(item => {
        let modifiersList: { name: string }[] = [];
        if (Array.isArray(item.modifiers)) {
          modifiersList = item.modifiers.map((m: any) => ({ name: m.name || String(m) }));
        } else if (item.modifiers && typeof item.modifiers === 'object') {
          // Fallback if modifiers is stored as a JSON object instead of an array
          modifiersList = Object.values(item.modifiers).map((m: any) => ({ name: m.name || String(m) }));
        }
        
        return {
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          modifiers: modifiersList
        };
      })
    }));

    return NextResponse.json({ data: kots });
  } catch (error: any) {
    console.error('Error fetching waiter tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
