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

const setupSchema = z.object({
  externalPropertyId: z.string().min(1, 'Property ID is required'),
  webhookSecret: z.string().min(1, 'Webhook Secret is required'),
  apiToken: z.string().min(1, 'API Token is required'),
});

type SetupFormValues = z.infer<typeof setupSchema>;

interface ChannelSetupFormProps {
  provider: string;
}

export function ChannelSetupForm({ provider }: ChannelSetupFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
  });

  const onSubmit = async (data: SetupFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await saveChannelConnection({
        provider: provider as 'CHANNEX', // We're hardcoding this for now since it's the only one
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
        <CardDescription>
          Enter your {provider} credentials to start syncing reservations. Your credentials will be securely encrypted.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground space-y-2 border">
            <h4 className="font-semibold text-foreground">How to configure {provider}</h4>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Log into {provider} and select your property to find your <strong>Property ID</strong>.</li>
              <li>Under Settings &gt; API Tokens, generate a new <strong>API Token</strong>.</li>
              <li>Under Webhooks, create a new webhook pointing to:<br/>
                <code className="text-xs bg-background p-1 rounded border mt-1 inline-block">
                  https://lodgecore.vercel.app/api/v1/webhooks/ota/{provider.toLowerCase()}
                </code>
              </li>
              <li>Copy the generated <strong>Webhook Secret</strong> from {provider}.</li>
            </ol>
          </div>

          <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="externalPropertyId">{provider} Property ID</Label>
            <Input
              id="externalPropertyId"
              placeholder="e.g. 9b8a4229-4059..."
              {...register('externalPropertyId')}
            />
            {errors.externalPropertyId && (
              <p className="text-sm text-destructive">{errors.externalPropertyId.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input
              id="webhookSecret"
              type="password"
              placeholder="Enter the webhook secret token..."
              {...register('webhookSecret')}
            />
            {errors.webhookSecret && (
              <p className="text-sm text-destructive">{errors.webhookSecret.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              You can find this in the {provider} dashboard when registering the webhook URL.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <Input
              id="apiToken"
              type="password"
              placeholder="Enter the API token for outbound sync..."
              {...register('apiToken')}
            />
            {errors.apiToken && (
              <p className="text-sm text-destructive">{errors.apiToken.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Used by LodgeCore to push availability and rates out to {provider}.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Connect Property'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
