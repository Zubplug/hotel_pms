'use client';

import React, { useEffect, useState } from 'react';

interface ClientOnlyDateProps {
  date: Date;
  format: 'date' | 'time';
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

export function ClientOnlyDate({ date, format, locale = 'en-US', options }: ClientOnlyDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className="opacity-0">--</span>;
  }

  if (format === 'time') {
    return <>{date.toLocaleTimeString(locale, options)}</>;
  }

  return <>{date.toLocaleDateString(locale, options)}</>;
}
