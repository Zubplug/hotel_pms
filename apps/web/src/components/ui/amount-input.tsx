'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn, formatAmountInput, parseAmountInput } from '@/lib/utils';

type AmountInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  decimals?: number;
  currency?: string;
};

export function AmountInput({ value, onValueChange, decimals = 2, currency = '₦', className, ...props }: AmountInputProps) {
  return (
    <div className="relative">
      {currency && <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">{currency}</span>}
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={formatAmountInput(value, decimals)}
        onChange={event => onValueChange(parseAmountInput(event.target.value))}
        className={cn(currency && 'pl-8', className)}
      />
    </div>
  );
}
