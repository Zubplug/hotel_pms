import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { BILLING_SOURCES, getBillingDocument, getBillingScope } from '@/lib/services/billing-read-model';

const sourceSchema = z.enum(BILLING_SOURCES);

export async function GET(req: NextRequest, { params }: { params: Promise<{ source: string; id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { source, id } = await params;
    const parsedSource = sourceSchema.safeParse(source.toUpperCase());
    if (!parsedSource.success || !z.string().uuid().safeParse(id).success) return errorResponse('INVALID_FILTER', 'Invalid source document reference.', 400);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || session.user.propertyId;
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    const scope = await getBillingScope(session.user.id, propertyId);
    const document = await getBillingDocument(scope, parsedSource.data, id);
    if (!document) return errorResponse('NOT_FOUND', 'Source document not found.', 404);
    return successResponse(document);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Billing read access is not available for this property.', 403);
    return errorResponse('INTERNAL_ERROR', 'Billing document is unavailable.', 500);
  }
}
