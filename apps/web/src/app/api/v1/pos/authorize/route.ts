import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      propertyId, 
      deviceId, 
      sessionId, 
      requestedBy, 
      authorizedBy, 
      action, 
      reason, 
      operationId, 
      businessDate 
    } = body;

    if (!propertyId || !deviceId || !requestedBy || !authorizedBy || !action || !operationId || !businessDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const audit = await prisma.posAuthorizationAudit.create({
      data: { propertyId,
        deviceId,
        sessionId,
        requestedBy,
        authorizedBy,
        action,
        reason,
        operationId,
        businessDate: new Date(businessDate)
      }
    });

    return NextResponse.json({ data: audit });
  } catch (error: any) {
    console.error('POS Authorization Audit Sync Error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Audit record already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
