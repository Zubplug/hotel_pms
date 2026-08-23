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

    // Fetch KOTs created by this operator in this session's business date
    const kots = await prisma.posKot.findMany({
      where: {
        createdBy: payload.staffId,
        outletId: outletId,
        businessDate: session.businessDate,
      },
      include: {
        order: {
          select: {
            tableNumber: true,
            orderNumber: true,
            orderType: true
          }
        },
        items: {
          include: {
            modifiers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ data: kots });
  } catch (error: any) {
    console.error('Error fetching waiter tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
