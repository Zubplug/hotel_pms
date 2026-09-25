import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasEntitlement } from '@/lib/auth/entitlement';
import prisma from '@hotel-pms/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ChannelSetupForm } from './channel-setup-form';
import { ManualRateMapping, ManualRoomMapping, SyncRoomsButton, SyncRatesButton } from './sync-buttons';

export const metadata: Metadata = {
  title: 'Channel Configuration | LodgeCore',
};

export default async function ChannelProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const resolvedParams = await params;
  const providerSlug = resolvedParams.provider.toUpperCase();
  const session = await auth();
  if (!session?.user) redirect('/login');
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyId = ctx.propertyIds[0];

  let isEntitled = true;
  if (providerSlug === 'BEDS24') {
    isEntitled = await hasEntitlement(ctx.organizationId, 'ADDON_BEDS24');
  }

  let connection;
  try {
    connection = await (prisma as any).channelConnection.findUnique({
      where: {
        propertyId_provider: {
          propertyId,
          provider: providerSlug,
        }
      },
      include: {
        roomMappings: true,
        ratePlanMappings: true,
      }
    });
  } catch (error) {
    // If DB is offline or migration pending
    connection = null;
  }

  const isConnected = !!connection;
  const localRoomTypes = await prisma.roomType.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true } });
  const localRatePlans = await prisma.ratePlan.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings/integrations/channels">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight capitalize">
            {resolvedParams.provider.toLowerCase()} Configuration
          </h2>
          <p className="text-muted-foreground">
            Map LodgeCore rooms and rates to {resolvedParams.provider} external identifiers.
          </p>
        </div>
      </div>

      {!isEntitled ? (
        <Card className="border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-800 dark:text-orange-400">Premium Add-on Required</CardTitle>
            <CardDescription className="text-orange-700/80 dark:text-orange-400/80">
              Your organization does not have an active subscription for the Beds24 Channel Manager integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              Beds24 is a Tier-1 PMS add-on. Subscribe to unlock real-time two-way synchronization for rates, availability, and reservations across 60+ OTAs.
            </p>
            <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white">
              <Link href="/settings/billing">Upgrade Subscription</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !isConnected ? (
        <ChannelSetupForm provider={providerSlug} />
      ) : (
        <Tabs defaultValue="rooms" className="w-full">
          <TabsList>
            <TabsTrigger value="rooms">Room Mappings</TabsTrigger>
            <TabsTrigger value="rates">Rate Mappings</TabsTrigger>
            <TabsTrigger value="sync">Sync Logs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="rooms" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Room Type Mapping</CardTitle>
                  <CardDescription>Link external OTA room codes to internal LodgeCore room types.</CardDescription>
                </div>
                <SyncRoomsButton providerSlug={providerSlug} />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LodgeCore Room Type</TableHead>
                      <TableHead>External OTA ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connection?.roomMappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No room mappings configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      connection?.roomMappings.map((map: any) => (
                        <TableRow key={map.id}>
                          <TableCell className="font-medium">{map.lodgecoreRoomTypeId}</TableCell>
                          <TableCell>{map.externalRoomTypeId}</TableCell>
                          <TableCell>
                            <Badge variant={map.isActive ? 'default' : 'secondary'}>
                              {map.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <ManualRoomMapping mappingId={map.id} value={map.lodgecoreRoomTypeId} options={localRoomTypes} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Rate Plan Mapping</CardTitle>
                  <CardDescription>Link external OTA rate plans to internal LodgeCore rate plans.</CardDescription>
                </div>
                <SyncRatesButton providerSlug={providerSlug} />
              </CardHeader>
              <CardContent>
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LodgeCore Rate Plan</TableHead>
                      <TableHead>External OTA ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connection?.ratePlanMappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No rate plan mappings configured.
                        </TableCell>
                      </TableRow>
                    ) : (
                      connection?.ratePlanMappings.map((map: any) => (
                        <TableRow key={map.id}>
                          <TableCell className="font-medium">{map.lodgecoreRatePlanId}</TableCell>
                          <TableCell>{map.externalRatePlanId}</TableCell>
                          <TableCell>
                            <Badge variant={map.isActive ? 'default' : 'secondary'}>
                              {map.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <ManualRateMapping mappingId={map.id} value={map.lodgecoreRatePlanId} options={localRatePlans} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="sync" className="mt-6 space-y-4">
             <Card>
              <CardHeader>
                <CardTitle>Sync Event Logs</CardTitle>
                <CardDescription>View recent inbound and outbound channel sync events.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-md">
                  <p>Sync logs are available in the production database.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Settings</CardTitle>
                <CardDescription>Manage credentials and connection status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">Connection Status</p>
                    <p className="text-sm text-muted-foreground">{connection?.status || 'Unknown'}</p>
                  </div>
                  <Button variant="outline">Test Connection</Button>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium text-destructive">Disconnect Provider</p>
                    <p className="text-sm text-muted-foreground">Stop syncing all rates and reservations.</p>
                  </div>
                  <Button variant="destructive">Disconnect</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
