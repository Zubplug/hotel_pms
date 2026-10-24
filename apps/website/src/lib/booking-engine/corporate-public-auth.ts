import crypto from 'node:crypto';

export function hashCorporateApplicationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function resolvePublicCorporateApplication(db: any, input: { applicationId: string; token: string; organizationId: string; propertyId: string }) {
  const application = await db.corporateBookingApplication.findFirst({ where: { id: input.applicationId, accessTokenHash: hashCorporateApplicationToken(input.token), organizationId: input.organizationId, propertyId: input.propertyId, status: 'PENDING', expiresAt: { gt: new Date() } } });
  if (!application) throw new Error('CORPORATE_APPLICATION_UNAVAILABLE');
  return application;
}
