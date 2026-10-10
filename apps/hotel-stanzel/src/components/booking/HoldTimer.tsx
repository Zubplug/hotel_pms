'use client';

import { useEffect, useState, useRef } from 'react';

interface HoldTimerProps {
  expiresAt: string; // ISO 8601 from server — authoritative
  onExpired: () => void;
}

export function HoldTimer({ expiresAt, onExpired }: HoldTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [urgent, setUrgent] = useState(false);
  const calledExpired = useRef(false);

  useEffect(() => {
    calledExpired.current = false;

    function tick() {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      setUrgent(diff <= 120); // Turn red at 2 min remaining

      if (diff === 0 && !calledExpired.current) {
        calledExpired.current = true;
        onExpired();
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const expired = secondsLeft === 0;

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={expired ? 'Hold expired' : `Hold expires in ${display}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '0.625rem var(--space-5)',
        borderRadius: 'var(--radius-lg)',
        background: expired
          ? 'rgb(192 57 43 / 0.1)'
          : urgent
            ? 'rgb(201 169 110 / 0.12)'
            : 'rgb(26 60 52 / 0.07)',
        border: `1.5px solid ${expired ? '#c0392b' : urgent ? 'var(--color-gold)' : 'var(--color-border)'}`,
        transition: 'background 400ms var(--ease), border-color 400ms var(--ease)',
      }}
    >
      {/* Clock icon */}
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={expired ? '#c0392b' : urgent ? 'var(--color-gold)' : 'var(--color-green)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>

      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: expired ? '#c0392b' : urgent ? 'var(--color-gold-dark)' : 'var(--color-green)',
        letterSpacing: '0.06em',
      }}>
        {expired ? 'Hold expired' : `Hold expires in ${display}`}
      </span>
    </div>
  );
}
