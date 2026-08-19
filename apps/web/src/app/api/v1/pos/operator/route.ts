import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const session = await prisma.posSession.findUnique({
      where: { id: sessionId },
    });
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // If an operator token was provided, that is the active operator
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let staffIdToFetch = null;

    if (token) {
      try {
        const { verifyOperatorToken } = await import('@/lib/pos/operatorAuth');
        const payload = await verifyOperatorToken(token);
        if (payload && payload.staffId) {
          staffIdToFetch = payload.staffId;
        }
      } catch (err) {
        console.warn('Invalid operator token provided, falling back to session opener');
      }
    }

    // Fallback: the operator is the staff member who opened the session
    if (!staffIdToFetch) {
      const user = await prisma.user.findUnique({
        where: { id: session.openedBy }
      });
      if (user && user.staffId) {
        staffIdToFetch = user.staffId;
      }
    }

    let staff = null;
    if (staffIdToFetch) {
      staff = await prisma.staff.findUnique({
        where: { id: staffIdToFetch }
      });
    }

    return NextResponse.json({ 
      data: {
        staff: staff || { id: session.openedBy, firstName: 'System', lastName: 'User' }
      } 
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
