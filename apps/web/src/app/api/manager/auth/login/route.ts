import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { successResponse, errorResponse } from '@/lib/api-response';

const JWT_SECRET = process.env.AUTH_SECRET || 'fallback-secret-for-development';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('BAD_REQUEST', 'Email and password are required', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { 
        roles: { 
          include: { 
            role: { include: { permissions: { include: { permission: true } } } } 
          } 
        } 
      }
    });

    if (!user || !user.passwordHash) {
      return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return errorResponse('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    // Role extraction exactly as in lib/auth.ts
    let capabilities: string[] = [];
    const propertyIds: string[] = [];
    
    if (user.roles) {
      user.roles.forEach(ur => {
        if (ur.propertyId) propertyIds.push(ur.propertyId);
        ur.role.permissions.forEach(rp => {
          if (rp.permission?.name) {
            capabilities.push(rp.permission.name);
          }
        });
      });
    }
    
    capabilities = Array.from(new Set(capabilities));
    const primaryRole = user.roles?.[0]?.role?.name || 'STAFF';

    const defaultCapabilities: string[] = [];
    if (user.isSuperAdmin || primaryRole === 'SUPER_ADMIN' || primaryRole === 'ADMIN' || primaryRole === 'DIRECTOR' || primaryRole === 'EXECUTIVE') {
      defaultCapabilities.push(
        'ACCESS_FRONT_DESK', 'ACCESS_POS', 'ACCESS_HOUSEKEEPING', 'ACCESS_CASH_MANAGEMENT', 
        'ACCESS_INVENTORY', 'ACCESS_MANAGEMENT', 'ACCESS_NIGHT_AUDIT', 'ACCESS_SYNC_CENTER', 'ACCESS_MAINTENANCE',
        'ACCESS_REFUNDS', 'LIMIT_REFUND_UNLIMITED', 'ACCESS_VOID', 'ACCESS_DISCOUNTS', 'AUTHORIZE_VOID', 'AUTHORIZE_POST_KITCHEN_VOID',
        'AUTHORIZE_DISCOUNT', 'APPROVE_DRAWER_VARIANCE', 'OVERRIDE_NIGHT_AUDIT', 'POST_CITY_LEDGER', 'ACCESS_REPORTS'
      );
    } else if (primaryRole === 'MANAGER') {
      defaultCapabilities.push(
        'ACCESS_FRONT_DESK', 'ACCESS_POS', 'ACCESS_HOUSEKEEPING', 'ACCESS_CASH_MANAGEMENT', 
        'ACCESS_INVENTORY', 'ACCESS_MANAGEMENT', 'ACCESS_NIGHT_AUDIT', 'ACCESS_SYNC_CENTER', 'ACCESS_MAINTENANCE',
        'ACCESS_REFUNDS', 'LIMIT_REFUND_250K', 'ACCESS_VOID', 'ACCESS_DISCOUNTS', 'AUTHORIZE_VOID',
        'AUTHORIZE_DISCOUNT', 'APPROVE_DRAWER_VARIANCE', 'OVERRIDE_NIGHT_AUDIT', 'POST_CITY_LEDGER', 'ACCESS_REPORTS'
      );
    }

    if (primaryRole !== 'MANAGER' && primaryRole !== 'ADMIN' && primaryRole !== 'SUPER_ADMIN' && primaryRole !== 'DIRECTOR' && primaryRole !== 'EXECUTIVE' && !user.isSuperAdmin) {
       return errorResponse('FORBIDDEN', 'Only managers, admins, and directors can access this app', 403);
    }

    capabilities = Array.from(new Set([...capabilities, ...defaultCapabilities]));

    // Generate JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      staffId: user.staffId,
      isSuperAdmin: user.isSuperAdmin,
      role: primaryRole,
      capabilities,
      sessionVersion: user.sessionVersion || 1,
      propertyId: propertyIds.length > 0 ? propertyIds[0] : null,
      allowedProperties: propertyIds
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
    console.error('[Manager Auth API POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Authentication failed', 500);
  }
}
