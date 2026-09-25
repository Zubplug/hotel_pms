import { auth } from '@/lib/auth';

export async function requireEventContext() {
  const session = await auth();
  if (!session?.user?.id || !session.user.propertyId) {
    throw new Error('Authentication and an assigned property are required.');
  }

  return {
    userId: session.user.id,
    propertyId: session.user.propertyId,
  };
}
