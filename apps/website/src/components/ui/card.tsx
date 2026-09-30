import * as React from 'react';

export function Card({ className = '', ...props }: React.ComponentProps<'div'>) { return <div className={`rounded-xl border border-white/10 bg-white/[.035] text-sm text-slate-200 ${className}`} {...props} />; }
export function CardHeader({ className = '', ...props }: React.ComponentProps<'div'>) { return <div className={`p-5 ${className}`} {...props} />; }
export function CardTitle({ className = '', ...props }: React.ComponentProps<'div'>) { return <div className={`font-semibold text-white ${className}`} {...props} />; }
export function CardContent({ className = '', ...props }: React.ComponentProps<'div'>) { return <div className={`px-5 pb-5 ${className}`} {...props} />; }
