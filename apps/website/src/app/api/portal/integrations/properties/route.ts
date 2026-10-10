import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@hotel-pms/db';

export async function GET() {
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const properties = await prisma.property.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      entitlements: {
        where: { organizationId: user.organizationId, status: 'ACTIVE', productCode: { in: ['ADDON_BOOKING_ENGINE', 'ADDON_CUSTOM_WEBSITE_API', 'ADDON_CUSTOM_WEBSITE_PMS'] } },
        select: { productCode: true },
      },
      bookingPaymentAccounts: {
        where: { isActive: true },
        select: { id: true, provider: true, mode: true, target: true, currency: true, secretCiphertext: true, webhookSecretCiphertext: true },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    properties: properties.map((property) => ({
      id: property.id,
      name: property.name,
      targets: property.entitlements.map((entitlement) => entitlement.productCode === 'ADDON_CUSTOM_WEBSITE_API' ? 'STANDALONE_API' : entitlement.productCode === 'ADDON_CUSTOM_WEBSITE_PMS' ? 'PMS_WEBSITE' : 'BOOKING_ENGINE'),
      account: property.bookingPaymentAccounts[0] ? {
        id: property.bookingPaymentAccounts[0].id,
        provider: property.bookingPaymentAccounts[0].provider,
        mode: property.bookingPaymentAccounts[0].mode,
        target: property.bookingPaymentAccounts[0].target,
        currency: property.bookingPaymentAccounts[0].currency,
        configured: Boolean(property.bookingPaymentAccounts[0].secretCiphertext && property.bookingPaymentAccounts[0].webhookSecretCiphertext),
      } : null,
    })),
  });
}
