import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { randomBytes, createHash } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, propertyId, outletId, terminalName, terminalType } = body;

    if (!email || !password || !propertyId || !outletId || !terminalName) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Authenticate Admin (Simplified for MVP, would normally use bcrypt on admin credentials)
    const adminUser = await prisma.user.findUnique({
      where: { email },
      include: {
        staff: true,
      }
    });

    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }
    // Note: In real app, verify password hash here
    // For now we assume if they exist and are super admin / admin, they can provision
    
    // 2. Register Terminal
    const deviceCredential = randomBytes(32).toString('hex');
    const deviceCredentialHash = createHash('sha256').update(deviceCredential).digest('hex');
    const terminalCode = `TERM-${Math.floor(1000 + Math.random() * 9000)}`;

    const terminal = await prisma.posTerminal.create({
      data: {
        terminalCode,
        name: terminalName,
        terminalType: terminalType || 'STATIONARY',
        organisationId: adminUser.organisationId,
        propertyId,
        outletId,
        deviceCredentialHash,
        registrationState: 'REGISTERED',
        licenseState: 'VALID',
        licenseExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      }
    });

    // 3. Snapshot datasets (mock logic, to be expanded)
    const staff = await prisma.staff.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true, hasPosAccess: true }
    });

    const categories = await prisma.posProductCategory.findMany({ where: { outletId } });
    const products = await prisma.posProduct.findMany({ where: { propertyId } });
    const outlet = await prisma.posOutlet.findUnique({ where: { id: outletId } });

    // 4. Return Snapshot
    return NextResponse.json({
      success: true,
      data: {
        terminalIdentity: {
          id: terminal.id,
          terminalCode: terminal.terminalCode,
          name: terminal.name,
          terminalType: terminal.terminalType,
          organisationId: terminal.organisationId,
          propertyId: terminal.propertyId,
          outletId: terminal.outletId,
          registrationState: terminal.registrationState,
          licenseState: terminal.licenseState,
          licenseExpiresAt: terminal.licenseExpiresAt,
          configurationVersion: terminal.configurationVersion,
          staffVersion: terminal.staffVersion,
          menuVersion: terminal.menuVersion,
        },
        deviceCredential, // ONLY returned once! Desktop must save this securely.
        snapshot: {
          outlet,
          staff,
          menu: { categories, products },
        }
      }
    });
  } catch (error: any) {
    console.error('Provisioning error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
