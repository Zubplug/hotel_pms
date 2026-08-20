import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const terminalId = (await params).id;
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const deviceToken = authHeader.split(' ')[1];

    const terminal = await prisma.posTerminal.findUnique({
      where: { id: terminalId },
      include: { outlet: true }
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    if (terminal.registrationState !== 'REGISTERED') {
      return NextResponse.json({ error: `Terminal is ${terminal.registrationState.toLowerCase()}` }, { status: 403 });
    }

    const isTokenValid = await compare(deviceToken, terminal.deviceCredentialHash);
    if (!isTokenValid) {
      return NextResponse.json({ error: 'Invalid device token' }, { status: 401 });
    }

    // Update last sync time
    await prisma.posTerminal.update({
      where: { id: terminalId },
      data: { lastSyncAt: new Date(), lastSeenAt: new Date() }
    });

    // Fetch syncing data
    // 1. Staff (including PIN hashes)
    const staffAccess = await prisma.staffPosOutletAccess.findMany({
      where: { outletId: terminal.outletId },
      include: { staff: true }
    });

    const staff = staffAccess.map((sa: any) => sa.staff);

    // 2. Categories & Products
    const categories = await prisma.productCategory.findMany({
      where: { outletId: terminal.outletId, isActive: true },
      include: { products: { where: { isActive: true } } }
    });

    // 3. Tables/Floor Plans
    const floorPlans = await prisma.posFloorPlan.findMany({
      where: { outletId: terminal.outletId, isActive: true },
      include: { tables: { where: { isActive: true } } }
    });

    return NextResponse.json({
      data: {
        terminal: {
          id: terminal.id,
          terminalCode: terminal.terminalCode,
          name: terminal.name,
          terminalType: terminal.terminalType,
          licenseState: terminal.licenseState,
          autoLockSeconds: terminal.autoLockSeconds ?? terminal.outlet.autoLockSeconds
        },
        staff: staff.map((s: any) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          position: s.position,
          posPinHash: s.posPinHash, // SECURE: Only sent here
          posTokenVersion: s.posTokenVersion
        })),
        categories,
        floorPlans
      }
    });
  } catch (error: any) {
    console.error('Terminal Sync Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
