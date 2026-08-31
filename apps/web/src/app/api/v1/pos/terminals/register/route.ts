import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hash } from 'bcryptjs';
import crypto from 'crypto';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.propertyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const sessionPropertyId = session.user.propertyId;

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = body?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
    const { terminalCode, name, terminalType, propertyId, outletId } = body;

    if (!terminalCode || !name || !terminalType || !propertyId || !outletId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (propertyId !== sessionPropertyId) {
       return NextResponse.json({ error: 'Invalid property context' }, { status: 403 });
    }

    // Verify outlet exists and belongs to the right property/org
    const outlet = await prisma.posOutlet.findUnique({
      where: { id: outletId },
      include: { property: true }
    });

    if (!outlet || outlet.property.id !== propertyId) {
      return NextResponse.json({ error: 'Invalid outlet or property' }, { status: 400 });
    }

    // Generate a secure random device token
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = await hash(deviceToken, 10);

    const terminal = await prisma.posTerminal.create({
      data: {
        terminalCode,
        name,
        terminalType,
        organisationId: outlet.property.organizationId,
        propertyId,
        outletId,
        deviceCredentialHash: deviceTokenHash,
        registrationState: 'REGISTERED',
        licenseState: 'VALID',
      }
    });

    return NextResponse.json({
      data: {
        terminal: {
          id: terminal.id,
          terminalCode: terminal.terminalCode,
          name: terminal.name,
          terminalType: terminal.terminalType,
          registrationState: terminal.registrationState,
          licenseState: terminal.licenseState
        },
        // The token is ONLY returned this one time during provisioning
        deviceToken
      }
    });
  } catch (error: any) {
    console.error('Terminal Registration Error:', error);
    // Handle unique constraint violation for terminalCode
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Terminal code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
