import * as React from 'react';

export function Badge({ className = '', variant = 'default', ...props }: React.ComponentProps<'span'> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' }) {
  const styles = variant === 'destructive' ? 'bg-rose-400/10 text-rose-300' : variant === 'outline' ? 'border border-white/15 text-slate-300' : variant === 'secondary' ? 'bg-indigo-400/10 text-indigo-200' : 'bg-emerald-400/10 text-emerald-300';
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${styles} ${className}`} {...props} />;
}
