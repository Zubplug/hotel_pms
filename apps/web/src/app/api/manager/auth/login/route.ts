import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

const JWT_SECRET = process.env.AUTH_SECRET;
if (!JWT_SECRET) {
  throw new Error('AUTH_SECRET is required for manager authentication');
}

const authUserSelect = (withPinFields: boolean) => ({
  id: true,
  staffId: true,
  email: true,
  passwordHash: true,
  isSuperAdmin: true,
  sessionVersion: true,
  ...(withPinFields
    ? {
        mobilePinHash: true,
        mobilePinFailedAttempts: true,
        mobilePinLockedUntil: true,
      }
    : {}),
  membership: { select: { organizationId: true, status: true, role: true } },
  roles: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, identifier, pin } = body;

    const pinLogin = typeof pin === 'string' && pin.length > 0;
    if (pinLogin && (!identifier || !/^\d{6}$/.test(pin))) {
      return errorResponse('BAD_REQUEST', 'Enter your email or phone number and a valid 6-digit PIN', 400);
    }

    if (!pinLogin && (!email || !password)) {
      return errorResponse('BAD_REQUEST', 'Email and password are required', 400);
    }

    let user: any = pinLogin
      ? await prisma.user.findUnique({
          where: { email: String(identifier).trim().toLowerCase() },
          select: authUserSelect(true),
        })
      : await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: authUserSelect(false),
    });

    // Phone is stored on Staff, while the authentication identity is User.
    if (!user && pinLogin) {
      const staff = await prisma.staff.findFirst({
        where: {
          isActive: true,
          OR: [{ phone: String(identifier).trim() }, { email: String(identifier).trim().toLowerCase() }],
        },
        select: { userId: true },
      });
      if (staff?.userId) {
        user = await prisma.user.findUnique({
          where: { id: staff.userId },
          select: authUserSelect(true),
        });
      }
    }

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    // Demo accounts are time-limited independently of the shared HQ demo
    // organization and property. Enforce expiry before either password or PIN
    // authentication succeeds so an expired account cannot obtain a new token.
    const demoAccount = await (prisma as any).demoAccount.findUnique({
      where: { userId: user.id },
      select: { status: true, expiresAt: true },
    });
    if (demoAccount && (demoAccount.status !== 'ACTIVE' || demoAccount.expiresAt <= new Date())) {
      return errorResponse('DEMO_EXPIRED', 'This demo account has expired. Request a new demo account to continue.', 410);
    }

    if (pinLogin) {
      if (user.mobilePinLockedUntil && user.mobilePinLockedUntil > new Date()) {
        return errorResponse('TOO_MANY_REQUESTS', 'PIN temporarily locked. Try again later or use your password.', 429);
      }
      if (!user.mobilePinHash) {
        return errorResponse('PIN_NOT_SET', 'Set up your mobile PIN using your password first.', 409);
      }

      const isPinValid = await bcrypt.compare(pin, user.mobilePinHash);
      if (!isPinValid) {
        const failedAttempts = user.mobilePinFailedAttempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            mobilePinFailedAttempts: failedAttempts >= 5 ? 0 : failedAttempts,
            mobilePinLockedUntil: failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          },
        });
        return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { mobilePinFailedAttempts: 0, mobilePinLockedUntil: null, lastLoginAt: new Date() },
      });
    } else {
      if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
        return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
      }
    }

    // Role extraction exactly as in lib/auth.ts
    let capabilities: string[] = [];
    const propertyIds: string[] = [];
    
    if (user.roles) {
      user.roles.forEach((ur: any) => {
        if (ur.propertyId) propertyIds.push(ur.propertyId);
        ur.role.permissions.forEach((rp: any) => {
          if (rp.permission?.name) {
            capabilities.push(rp.permission.name);
          }
        });
      });
    }
    
    capabilities = Array.from(new Set(capabilities));
    const primaryRole = user.roles?.[0]?.role?.name || user.membership?.role || 'STAFF';
    const allowedProperties = (await requireOrganizationContext(user.id)).propertyIds;

    const allowedRoles = [
      'MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 
      'EXECUTIVE', 'NIGHT_AUDITOR', 'FNB_MANAGER', 'ACCOUNTANT', 
      'GENERAL_CASHIER', 'PROCUREMENT_MANAGER', 'INVENTORY_MANAGER', 'STOCK_MANAGER'
    ];
    if (!allowedRoles.includes(primaryRole) && !user.isSuperAdmin) {
       return errorResponse('FORBIDDEN', 'Your role does not have access to the management portal', 403);
    }

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      staffId: user.staffId,
      isSuperAdmin: user.isSuperAdmin,
      role: primaryRole,
      capabilities,
      sessionVersion: user.sessionVersion || 1,
      propertyId: allowedProperties[0] ?? propertyIds[0] ?? null,
      allowedProperties
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    return successResponse({
      token,
      user: tokenPayload
    }, 200);

  } catch (error) {
    console.error('[Manager Auth API POST]', {
      error,
      code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
      meta: error instanceof Error && 'meta' in error ? (error as any).meta : undefined,
    });
    return errorResponse('INTERNAL_ERROR', 'Authentication failed', 500);
  }
}
