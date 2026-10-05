import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { randomBytes, createHash } from 'crypto';
import { requirePlanLimit } from '@/lib/auth/entitlement';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, terminalType } = body;
    // Provisioning is commonly done by pasting IDs from the admin UI. Trim
    // those values before they reach Prisma's UUID columns; otherwise one
    // leading space produces the opaque "invalid character" UUID error.
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId.trim() : '';
    const outletId = typeof body.outletId === 'string' ? body.outletId.trim() : '';
    const terminalName = typeof body.terminalName === 'string' ? body.terminalName.trim() : '';

    if (!normalizedEmail || !password || !propertyId || !outletId || !terminalName) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(propertyId)) {
      return NextResponse.json({ success: false, error: `Invalid Property ID: "${propertyId}" is not a UUID` }, { status: 400 });
    }
    if (!uuidPattern.test(outletId)) {
      return NextResponse.json({ success: false, error: `Invalid Outlet ID: "${outletId}" is not a UUID` }, { status: 400 });
    }

    // 1. Authenticate Admin (Simplified for MVP, would normally use bcrypt on admin credentials)
    const adminUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }
    // Note: In real app, verify password hash here
    // For now we assume if they exist and are super admin / admin, they can provision
    
    const adminStaff = await prisma.staff.findFirst({
      where: { userId: adminUser.id }
    });
    
    if (!adminStaff) {
      return NextResponse.json({ success: false, error: 'Staff record not found for admin user' }, { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Invalid Property ID: Property not found' }, { status: 400 });
    }

    // Serialize entitlement count + terminal creation at organization scope.
    // Without this lock, two retries can both observe capacity and create
    // duplicate terminals before either transaction is visible to the other.
    const deviceCredential = randomBytes(32).toString('hex');
    const deviceCredentialHash = createHash('sha256').update(deviceCredential).digest('hex');
    const terminal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${adminStaff.organizationId} FOR UPDATE`;

      const duplicate = await tx.posTerminal.findFirst({
        where: {
          organisationId: adminStaff.organizationId,
          propertyId,
          outletId,
          name: terminalName,
          registrationState: { not: 'REVOKED' },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new Error('An active terminal with this name already exists for this outlet. Reuse it or revoke it before provisioning again.');
      }

      const terminalCount = await tx.posTerminal.count({
        where: { organisationId: adminStaff.organizationId, registrationState: { not: 'REVOKED' } },
      });
      await requirePlanLimit(adminStaff.organizationId, 'maxTerminals', terminalCount);

      return tx.posTerminal.create({
        data: {
          terminalCode: `TERM-${Math.floor(1000 + Math.random() * 9000)}`,
          name: terminalName,
          terminalType: (terminalType === 'STATIONARY' || !terminalType) ? 'RESTAURANT_POS' : terminalType,
          organisationId: adminStaff.organizationId,
          propertyId,
          outletId,
          deviceCredentialHash,
          registrationState: 'REGISTERED',
          licenseState: 'VALID',
          licenseExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        },
      });
    });

    // 3. Snapshot datasets
    const staff = await prisma.staff.findMany({
      where: { organizationId: adminStaff.organizationId },
      select: { id: true, firstName: true, lastName: true }
    });

    const categories = await prisma.productCategory.findMany({ where: { outletId } });
    const products = await prisma.posProduct.findMany({ where: { propertyId } });
    const outlet = await prisma.posOutlet.findUnique({ where: { id: outletId } });
    const entitlements = await prisma.entitlement.findMany({
      where: {
        organizationId: adminStaff.organizationId,
        OR: [{ propertyId }, { propertyId: null }],
      },
      select: { productCode: true, status: true, startsAt: true, expiresAt: true, quantity: true },
    });
    const now = new Date();
    const activeEntitlements = entitlements.filter((item) =>
      item.status === 'ACTIVE'
      && item.startsAt <= now
      && (item.expiresAt === null || item.expiresAt > now),
    );

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
          enabledModules: activeEntitlements
            .map((item) => item.productCode)
            .filter((code) => ['MODULE_PMS', 'MODULE_OPERATIONS', 'MODULE_ENTERPRISE'].includes(code)),
          entitlements,
          entitlementsCapturedAt: now,
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
  } catch (error: unknown) {
    console.error('Provisioning error:', error);
    if (error instanceof Error && error.message.startsWith('An active terminal with this name')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
