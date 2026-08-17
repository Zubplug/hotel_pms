import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { jwtVerify } from 'jose';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET missing');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    
    let decoded;
    try {
      const { payload } = await jwtVerify(token, secret);
      decoded = payload;
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!decoded.staffId) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
    }

    // Revoke all tokens for this staff member by incrementing posTokenVersion
    await prisma.staff.update({
      where: { id: decoded.staffId as string },
      data: {
        posTokenVersion: { increment: 1 }
      }
    });

    return NextResponse.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error('POS Auth Logout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
