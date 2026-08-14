import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

// POST /api/v1/hardware/agent/enroll
// Called once by the Windows agent during --enroll setup.
// Validates the enrollment token, creates the HardwareAgent, returns agentId + agentSecret.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { enrollmentToken, deviceId, name, agentVersion, sdkVersion, hostname, lockType, comPort } = body;

    if (!enrollmentToken || !deviceId || !name) {
      return errorResponse('VALIDATION_ERROR', 'enrollmentToken, deviceId, and name are required', 422);
    }

    // Find a valid, unused, non-expired token
    // We must check all non-used tokens for the hash match (bcrypt compare)
    const candidates = await prisma.agentEnrollmentToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // limit scan window
    });

    let matchedToken = null;
    for (const candidate of candidates) {
      const matches = await bcrypt.compare(enrollmentToken, candidate.tokenHash);
      if (matches) {
        matchedToken = candidate;
        break;
      }
    }

    if (!matchedToken) {
      return errorResponse('INVALID_TOKEN', 'Enrollment token is invalid, expired, or already used', 401);
    }

    // Check deviceId isn't already registered
    const existing = await prisma.hardwareAgent.findUnique({ where: { deviceId } });
    if (existing) {
      return errorResponse('DEVICE_EXISTS', 'A device with this ID is already registered', 409);
    }

    // Generate agentSecret — returned once in plain text, stored hashed
    const agentSecret = randomBytes(32).toString('hex');
    const agentSecretHash = await bcrypt.hash(agentSecret, 12);

    const agent = await prisma.hardwareAgent.create({
      data: {
        propertyId: matchedToken.propertyId,
        name,
        deviceId,
        status: 'OFFLINE',
        hardwareStatus: 'UNKNOWN',
        agentSecretHash,
        agentVersion,
        sdkVersion,
        hostname,
        sdkLockType: lockType ? parseInt(lockType) : null,
        comPort: comPort || null,
      },
    });

    // Mark token as used
    await prisma.agentEnrollmentToken.update({
      where: { id: matchedToken.id },
      data: { usedAt: new Date(), agentId: agent.id },
    });

    return successResponse(
      {
        agentId: agent.id,
        agentSecret, // Shown ONCE — agent must store in Windows Credential Manager
        propertyId: agent.propertyId,
        name: agent.name,
      },
      201,
    );
  } catch (err) {
    console.error('[Agent Enroll POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
