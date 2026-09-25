'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { saveChannelConnection, verifyBeds24InviteCode } from '../../actions';

const channexSchema = z.object({
  externalPropertyId: z.string().min(1, 'Property ID is required'),
  webhookSecret: z.string().min(1, 'Webhook Secret is required'),
  apiToken: z.string().min(1, 'API Token is required'),
});

type ChannexFormValues = z.infer<typeof channexSchema>;

interface ChannelSetupFormProps {
  provider: string;
}

export function ChannelSetupForm({ provider }: ChannelSetupFormProps) {
  const router = useRouter();
  
  if (provider === 'BEDS24') {
    return <Beds24SetupForm router={router} />;
  }

  return <ChannexSetupForm provider={provider} router={router} />;
}

// --- BEDS24 FORM ---
function Beds24SetupForm({ router }: { router: any }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [inviteCode, setInviteCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [encryptedToken, setEncryptedToken] = useState('');
  const [properties, setProperties] = useState<{id: string, name: string}[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleVerify = async () => {
    if (!inviteCode) return toast.error('Invite code required');
    setIsVerifying(true);
    try {
      const res = await verifyBeds24InviteCode(inviteCode);
      if (res.success && res.properties) {
        setEncryptedToken(res.encryptedRefreshToken!);
        setProperties(res.properties);
        setStep(2);
        toast.success('Authenticated successfully');
      } else {
        toast.error(res.error || 'Authentication failed');
      }
    } catch (e) {
      toast.error('Unexpected error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProperty) return toast.error('Select a property');
    setIsSaving(true);
    try {
      const res = await saveChannelConnection({
        provider: 'BEDS24',
        externalPropertyId: selectedProperty,
        credentialsRef: encryptedToken,
      });
      if (res.success) {
        toast.success('Beds24 connected!');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save');
      }
    } catch (e) {
      toast.error('Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Connect Beds24</CardTitle>
        <CardDescription>
          Enter your Beds24 Invite Code to authenticate. Ensure the invite code has the `properties`, `bookings`, and `inventory` scopes enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="space-y-2">
            <Label>Beds24 Invite Code</Label>
            <Input 
              type="password" 
              placeholder="e.g. 1a2b3c4d5e..." 
              value={inviteCode} 
              onChange={e => setInviteCode(e.target.value)} 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Generate this in Beds24: Settings &gt; Apps &amp; Integrations &gt; API v2.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 p-2 rounded border border-green-200">
              <span>✓ Successfully Authenticated</span>
            </div>
            <div className="space-y-2">
              <Label>Select Property</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProperty}
                onChange={e => setSelectedProperty(e.target.value)}
              >
                <option value="" disabled>Select a property...</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        {step === 1 ? (
          <Button onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? 'Authenticating...' : 'Authenticate'}
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={isSaving || !selectedProperty}>
            {isSaving ? 'Connecting...' : 'Connect Property'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// --- CHANNEX FORM ---
function ChannexSetupForm({ provider, router }: { provider: string; router: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<ChannexFormValues>({
    resolver: zodResolver(channexSchema),
  });

  const onSubmit = async (data: ChannexFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await saveChannelConnection({
        provider: 'CHANNEX',
        ...data,
      });
      if (result.success) {
        toast.success(`${provider} connection configured successfully.`);
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to save configuration');
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Connect to {provider}</CardTitle>
        <CardDescription>Enter your credentials to start syncing reservations.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Property ID</Label>
            <Input {...register('externalPropertyId')} />
          </div>
          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <Input type="password" {...register('webhookSecret')} />
          </div>
          <div className="space-y-2">
            <Label>API Token</Label>
            <Input type="password" {...register('apiToken')} />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Connect'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
