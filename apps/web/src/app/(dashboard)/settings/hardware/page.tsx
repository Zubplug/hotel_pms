'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function HardwareSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hardwareAgents'],
    queryFn: async () => {
      const res = await fetch('/api/v1/hardware/agents');
      if (!res.ok) throw new Error('Failed to fetch hardware agents');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hardware Devices</h1>
        <p className="text-muted-foreground">
          Manage local Windows agents and lock encoders connected to your properties.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <>
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </>
        )}

        {data?.map((agent: any) => {
          // Determine if it's currently online based on heartbeat within the last 30 seconds
          const isOnline = agent.status === 'ONLINE' && agent.lastHeartbeat && (new Date().getTime() - new Date(agent.lastHeartbeat).getTime() < 30000);
          
          return (
            <Card key={agent.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    {agent.name}
                  </CardTitle>
                  <Badge variant={isOnline ? 'default' : 'destructive'} className={isOnline ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0' : ''}>
                    {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                    {isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <CardDescription>{agent.property.name}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Device ID</span>
                  <span className="font-mono text-xs">{agent.deviceId}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Agent Version</span>
                  <span>{agent.agentVersion || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">SDK Version</span>
                  <span>{agent.sdkVersion || 'Unknown'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <span>{agent.lastHeartbeat ? formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true }) : 'Never'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {data?.length === 0 && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/20">
            <Cpu className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Hardware Devices</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              You haven't connected any Windows Lock Agents to your properties yet. Install the LodgeCore Lock Agent on your front desk PC to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
