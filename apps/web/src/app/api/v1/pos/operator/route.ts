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

    // In this MVP, the operator is the staff member who opened it
    // Find the staff linked to this user
    let staff = null;
    const user = await prisma.user.findUnique({
      where: { id: session.openedBy }
    });
    
    if (user && user.staffId) {
      staff = await prisma.staff.findUnique({
        where: { id: user.staffId }
      });
    }

    return NextResponse.json({ 
      data: {
        staff: staff || { id: user?.id, firstName: 'System', lastName: 'User', email: user?.email }
      } 
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
