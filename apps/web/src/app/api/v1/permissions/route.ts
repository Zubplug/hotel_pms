import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only authorized staff can view permissions (MANAGE_ROLES recommended, but read-only could be open to admins)
    // For now, anyone with a valid session can view the dictionary.
    
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group permissions by resource for easier frontend consumption
    const grouped = permissions.reduce((acc: any, perm: any) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    return NextResponse.json({ data: grouped });
  } catch (error: any) {
    console.error('[permissions] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
