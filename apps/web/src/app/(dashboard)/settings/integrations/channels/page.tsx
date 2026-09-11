import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = {
  title: 'Channel Manager Integrations | LodgeCore',
};

export default async function ChannelsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyId = ctx.propertyIds[0]; // Assuming single property context for settings page

  // Try to safely fetch if the schema is migrated
  let connections: any[] = [];
  try {
    connections = await (prisma as any).channelConnection.findMany({
      where: { propertyId },
      include: {
        roomMappings: true,
        ratePlanMappings: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    // Fallback if DB migration hasn't been run locally yet
    console.warn('ChannelConnection table not found or error fetching:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Channel Integrations</h2>
          <p className="text-muted-foreground">
            Manage your OTA (Booking.com, Expedia, Agoda, etc.) and Channel Manager connections.
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Connect Provider
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="bg-muted p-4 rounded-full mb-4">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Active Integrations</h3>
          <p className="text-muted-foreground max-w-sm mb-6">
            You have not connected any OTAs or Channel Managers to this property yet. Connect Channex or Booking.com to sync availability and rates.
          </p>
          <Button>Get Started</Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">
                    {conn.provider === 'CHANNEX' ? 'Channex.io' : conn.provider}
                  </CardTitle>
                  <StatusBadge status={conn.status} />
                </div>
                <CardDescription>
                  Ext. Property ID: {conn.externalPropertyId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm mt-4">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Rooms Mapped:</div>
                    <div className="font-medium text-foreground">{conn.roomMappings?.length || 0}</div>
                    
                    <div>Rates Mapped:</div>
                    <div className="font-medium text-foreground">{conn.ratePlanMappings?.length || 0}</div>
                    
                    <div>Last Inbound:</div>
                    <div className="font-medium text-foreground">
                      {conn.lastInboundSync ? formatDistanceToNow(conn.lastInboundSync, { addSuffix: true }) : 'Never'}
                    </div>

                    <div>Last Outbound:</div>
                    <div className="font-medium text-foreground">
                      {conn.lastOutboundSync ? formatDistanceToNow(conn.lastOutboundSync, { addSuffix: true }) : 'Never'}
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={`/settings/integrations/channels/${conn.provider.toLowerCase()}`}>
                        Configure
                      </Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="w-full">
                      Sync Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'CONNECTED') {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle className="w-3 h-3 mr-1" /> Connected
      </Badge>
    );
  }
  if (status === 'ERROR' || status === 'DEGRADED') {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" /> {status}
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}
