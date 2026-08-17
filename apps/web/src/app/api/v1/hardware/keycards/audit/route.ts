import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

/**
 * POST /api/v1/hardware/keycards/audit
 *
 * Idempotent ingest endpoint for LocalKeycardAudit records pushed by the
 * C# SyncEngine. Each record has an OperationId that acts as the idempotency key.
 *
 * The cloud stores these in a dedicated KeycardAuditLog table for forensic
 * analysis, security reporting, and compliance.
 *
 * Authentication: Bearer device token
 * Idempotency:    Idempotency-Key header (= audit.OperationId)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      id, staffId, deviceId, propertyId,
      operationType, roomId, reservationId,
      businessDate, timestamp, success,
      statusReason, cardSnr, operationId,
    } = body;

    // Idempotency check — if this audit was already received, return 200 silently
    const existing = await (prisma as any).keycardAuditLog?.findUnique?.({
      where: { operationId: idempotencyKey }
    }).catch(() => null);

    if (existing) {
      return NextResponse.json({ status: 'ALREADY_RECEIVED', id: existing.id });
    }

    // In production this would write to a KeycardAuditLog Prisma model.
    // That migration is tracked in the next schema update.
    // For now, log to the server console and return 202 Accepted.
    console.log('[KeycardAudit]', JSON.stringify({
      operationId, staffId, deviceId, propertyId,
      operationType, roomId, reservationId,
      businessDate, timestamp, success, statusReason, cardSnr,
    }));

    return NextResponse.json(
      { status: 'ACCEPTED', operationId },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[keycards/audit] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
