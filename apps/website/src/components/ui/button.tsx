import * as React from 'react';

export function Button({ className = '', variant = 'default', size = 'default', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline'; size?: 'default' | 'sm' }) {
  const styles = variant === 'outline' ? 'border border-white/15 bg-transparent text-slate-200 hover:bg-white/[.06]' : 'bg-indigo-500 text-white hover:bg-indigo-400';
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm';
  return <button className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50 ${styles} ${sizes} ${className}`} {...props} />;
}
