'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Cpu, Wifi, WifiOff, Key, Download, Copy, Check, Clock, RotateCw, CreditCard } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProperty } from '@/components/PropertyProvider';
import { EraseCardDialog } from '@/components/hardware/EraseCardDialog';

export default function HardwareSettingsPage() {
  const { propertyId } = useProperty();
  const [enrollToken, setEnrollToken] = useState<string | null>(null);
  const [tokenExpires, setTokenExpires] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hardwareAgents', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const res = await fetch(`/api/v1/hardware/agents?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch hardware agents');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 5000,
    enabled: !!propertyId,
  });

  const generateToken = async () => {
    if (!propertyId) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/hardware/agent/enrollment-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setEnrollToken(data.data.token);
        setTokenExpires(new Date(data.data.expiresAt));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const copyToken = () => {
    if (enrollToken) {
      navigator.clipboard.writeText(enrollToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetModal = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        setEnrollToken(null);
        setTokenExpires(null);
      }, 300);
    }
  };

  const handlePing = async (agentId: string) => {
    try {
      await fetch('/api/v1/hardware/commands/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, commandType: 'PING' }),
      });
      // Will resolve on next refetch
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hardware Devices</h1>
          <p className="text-muted-foreground">
            Manage local Windows agents and lock encoders connected to your properties.
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setWipeOpen(true)}>
            <CreditCard className="w-4 h-4" />
            Wipe / Erase Card
          </Button>

          <Dialog open={open} onOpenChange={resetModal}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Key className="w-4 h-4" />
                Enroll New Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enroll Windows Agent</DialogTitle>
              <DialogDescription>
                Generate a one-time enrollment token to connect a new LodgeCore Lock Agent PC.
              </DialogDescription>
            </DialogHeader>

            {!enrollToken ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  This token will allow a single PC to register with your property and securely exchange encryption keys.
                </p>
                <Button onClick={generateToken} disabled={generating} className="w-full">
                  {generating ? 'Generating...' : 'Generate Token'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-lg flex justify-between items-center break-all gap-4">
                  <code className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    {enrollToken}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copyToken} className="shrink-0">
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
                  <Clock className="w-4 h-4" />
                  <span>
                    Expires in {tokenExpires ? formatDistanceToNow(tokenExpires) : '15 minutes'}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>1. On your front desk Windows PC, open a command prompt.</p>
                  <p>2. Run <code className="bg-muted px-1 py-0.5 rounded">LodgeCore.LockAgent.exe --enroll</code></p>
                  <p>3. Paste the token above when prompted.</p>
                </div>
              </div>
            )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EraseCardDialog 
        open={wipeOpen} 
        onOpenChange={setWipeOpen} 
        propertyId={propertyId ?? ''} 
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <>
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </>
        )}

        {data?.map((agent: any) => {
          const isOnline = agent.status === 'ONLINE' && agent.lastHeartbeat && (new Date().getTime() - new Date(agent.lastHeartbeat).getTime() < 30000);
          const isReady = agent.hardwareStatus === 'READY';
          const isDegraded = agent.hardwareStatus === 'DEGRADED';
          
          return (
            <Card key={agent.id} className="relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1 h-full ${isOnline ? (isReady ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-blue-500') : 'bg-red-500'}`} />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    {agent.name}
                  </CardTitle>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant={isOnline ? 'default' : 'destructive'} className={isOnline ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0' : ''}>
                      {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                    {isOnline && (
                      <Badge variant="outline" className={`text-[10px] uppercase ${isReady ? 'text-emerald-500 border-emerald-200' : isDegraded ? 'text-amber-500 border-amber-200' : 'text-muted-foreground'}`}>
                        {agent.hardwareStatus || 'UNKNOWN'}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>{agent.property?.name}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Device ID</span>
                  <span className="font-mono text-xs">{agent.deviceId}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Version</span>
                  <span>v{agent.agentVersion || '1.0'} / SDK v{agent.sdkVersion || '4.7'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Last Seen</span>
                  <span>{agent.lastHeartbeat ? formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true }) : 'Never'}</span>
                </div>
                
                <div className="pt-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" onClick={() => handlePing(agent.id)} disabled={!isOnline} className="h-8">
                    <RotateCw className="w-3 h-3 mr-1" /> Ping Encoder
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {data?.length === 0 && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/20">
            <Cpu className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Hardware Devices</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1 mb-4">
              You haven't connected any Windows Lock Agents to this property yet. Install the LodgeCore Lock Agent on your front desk PC to get started.
            </p>
            <Button variant="outline" onClick={() => setOpen(true)}>Enroll First Agent</Button>
          </div>
        )}
      </div>
    </div>
  );
}
