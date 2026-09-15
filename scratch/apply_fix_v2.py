import re

with open('/Users/mac/hotel_pms/scratch/night-audit-backup.ts', 'r') as f:
    content = f.read()

# 1. Stale Recovery
old_stale = """    if (existing?.status === 'IN_PROGRESS' || existing?.status === 'POSTING') {
      throw new Error('CONFLICT:Night Audit is already in progress for this business date.');
    }"""
new_stale = """    if (existing?.status === 'IN_PROGRESS' || existing?.status === 'POSTING') {
      const isStale = existing.updatedAt && (existing.updatedAt.getTime() < Date.now() - 45 * 60 * 1000);
      if (isStale) {
        const recovered = await tx.nightAudit.updateMany({
          where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
          data: { status: 'FAILED', notes: 'Auto-recovered stale audit run', completedAt: new Date(), updatedAt: new Date() }
        });
        if (recovered.count === 0) {
           throw new Error('CONFLICT:Night Audit is currently being recovered by another process.');
        }
        await tx.auditLog.create({
          data: {
             organizationId: property.organizationId,
             propertyId,
             userId,
             userEmail: userEmail || 'unknown@system.local',
             userRole,
             action: 'NIGHT_AUDIT_STALE_RECOVERED',
             resource: 'NightAudit',
             resourceId: existing.id,
             newValue: { previousStatus: existing.status, lastUpdated: existing.updatedAt },
             ipAddress: reqIp,
             userAgent: reqUserAgent,
             requestId: crypto.randomUUID(),
          }
        });
        existing.status = 'FAILED';
      } else {
        throw new Error('CONFLICT:Night Audit is already in progress for this business date.');
      }
    }"""
content = content.replace(old_stale, new_stale)

# 2. Heartbeat
old_batch = """    for (let i = 0; i < eligibleReservations.length; i += BATCH_SIZE) {
      const batch = eligibleReservations.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (reservation: any) => {"""
new_batch = """    let lastHeartbeat = Date.now();
    for (let i = 0; i < eligibleReservations.length; i += BATCH_SIZE) {
      const batch = eligibleReservations.slice(i, i + BATCH_SIZE);

      if (Date.now() - lastHeartbeat > 15000) {
        await prisma.nightAudit.update({
          where: { id: auditRun.id },
          data: { updatedAt: new Date() }
        }).catch((e) => console.error('[Night Audit] Heartbeat failed:', e));
        lastHeartbeat = Date.now();
      }

      await Promise.all(batch.map(async (reservation: any) => {"""
content = content.replace(old_batch, new_batch)

# 3. Housekeeping idempotency
old_hk = """            const existingTask = await tx.housekeepingTask.findFirst({
              where: {
                propertyId,
                roomId: room.id,
                type: { in: ['STAYOVER', 'CHECKOUT'] },
                status: { notIn: ['INSPECTED', 'CANCELLED'] },
              },
              orderBy: { createdAt: 'desc' },
            });"""
new_hk = """            const existingTask = await tx.housekeepingTask.findUnique({
              where: { idempotencyKey: hkIdempotencyKey }
            });"""
content = content.replace(old_hk, new_hk)

with open('/Users/mac/hotel_pms/scratch/chunk4_old.ts', 'r') as f:
    old_chunk4 = f.read()

with open('/Users/mac/hotel_pms/scratch/chunk4_new.ts', 'r') as f:
    new_chunk4 = f.read()
    
# Replace exact text
content = content.replace(old_chunk4, new_chunk4)

with open('/Users/mac/hotel_pms/apps/web/src/lib/night-audit.ts', 'w') as f:
    f.write(content)

