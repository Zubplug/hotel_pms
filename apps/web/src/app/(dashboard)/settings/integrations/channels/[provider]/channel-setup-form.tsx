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
import { saveChannelConnection } from '../../actions';

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
  return <ChannexSetupForm provider={provider} router={router} />;
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
