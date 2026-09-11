import { NextRequest } from 'next/server';
import { handleOtaWebhook } from '@/lib/integrations/ota/webhook-handler';

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ provider: string }> }
) {
  // Delegate the logic to the robust webhook handler we built
  const { provider } = await params;
  return handleOtaWebhook(req, provider);
}
