'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-16 border-2 border-dashed rounded-xl bg-muted/10',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
        <span className="text-destructive text-2xl font-bold">!</span>
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
