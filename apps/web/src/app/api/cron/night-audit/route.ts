import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { executeNightAudit } from '@/lib/night-audit';
import { getPropertyBusinessDate } from '@/lib/date-utils';

const AUDIT_CUTOFF_HOUR = 4;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

function isPastCutoff(timezone: string, now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false
  }).format(now));
  return hour >= AUDIT_CUTOFF_HOUR;
}

async function runScheduledAudits(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const properties = await prisma.property.findMany({
    where: { isActive: true },
    select: { id: true, timezone: true, businessDate: true }
  });
  const results = [];

  for (const property of properties) {
    if (!property.businessDate || !isPastCutoff(property.timezone, now)) {
      results.push({ propertyId: property.id, status: 'NOT_DUE' });
      continue;
    }

    const localToday = getPropertyBusinessDate(property.timezone, now);
    if (property.businessDate >= localToday) {
      results.push({ propertyId: property.id, status: 'NOT_DUE' });
      continue;
    }

    try {
      const result = await executeNightAudit(property.id, null, 'system@lodgecore.local');
      results.push({ propertyId: property.id, status: 'COMPLETED', ...result });
    } catch (error: any) {
      console.error(`[Night Audit Cron] Property ${property.id} failed:`, error);
      if (!error.message?.includes('already in progress')) {
        await prisma.nightAudit.updateMany({
          where: {
            propertyId: property.id,
            businessDate: property.businessDate,
            status: 'IN_PROGRESS'
          },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            exceptions: { error: error.message }
          }
        });
      }
      results.push({ propertyId: property.id, status: 'BLOCKED', error: error.message });
    }
  }

  return NextResponse.json({ results, executedAt: now.toISOString() });
}

export async function GET(request: Request) {
  try {
    return await runScheduledAudits(request);
  } catch (error: any) {
    console.error('[Night Audit Cron] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
