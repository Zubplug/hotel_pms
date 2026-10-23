'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableSelectOption = { value: string; label: string; searchText?: string };

type SearchableSelectProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  emptyMessage?: string;
};

export function SearchableSelect({
  value: controlledValue,
  defaultValue = '',
  onChange,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options…',
  name,
  required,
  disabled,
  className,
  inputClassName,
  emptyMessage = 'No matching options',
}: SearchableSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const value = controlledValue ?? internalValue;
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => `${option.label} ${option.searchText || ''}`.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const choose = (nextValue: string) => {
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn('flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-sm transition hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-50', inputClassName)}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[100] overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <div role="listbox" className="mt-1 max-h-56 overflow-y-auto">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => choose(option.value)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-orange-50 focus:bg-orange-50 focus:outline-none">
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="h-4 w-4 shrink-0 text-orange-600" />}
              </button>
            )) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
