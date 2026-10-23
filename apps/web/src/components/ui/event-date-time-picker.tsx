'use client';

import { CalendarDays, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
  required?: boolean;
  className?: string;
};

export function EventDateTimePicker({ value, onChange, dateOnly = false, required, className }: DateTimePickerProps) {
  const [date = '', time = ''] = value.split('T');
  const update = (nextDate: string, nextTime = time) => onChange(dateOnly ? nextDate : nextDate && nextTime ? `${nextDate}T${nextTime}` : nextDate || '');

  return (
    <div className={cn('grid gap-2', !dateOnly && 'sm:grid-cols-[1.35fr_1fr]', className)}>
      <label className="relative block">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-orange-600" />
        <input type="date" value={date} required={required} onChange={(event) => update(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" />
      </label>
      {!dateOnly && <label className="relative block">
        <Clock3 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-orange-600" />
        <input type="time" value={time} required={required} onChange={(event) => update(date, event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" />
      </label>}
    </div>
  );
}

export function EventTimePicker({ value, onChange, required, className }: { value: string; onChange: (value: string) => void; required?: boolean; className?: string }) {
  return <label className={cn('relative block', className)}><Clock3 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-orange-600" /><input type="time" value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" /></label>;
}
