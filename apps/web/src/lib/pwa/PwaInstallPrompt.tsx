'use client';

import { Download, Share, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isPwaEligiblePath } from './route-policy';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_KEY = 'lodgecore-pwa-install-dismissed-until';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  const userAgent = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAppleMobile && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
}

function getDismissedUntil(): number {
  try {
    return Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
  } catch {
    return 0;
  }
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP === 'true') return;
    if (typeof window === 'undefined' || !isPwaEligiblePath(pathname || window.location.pathname)) return;
    if (!window.isSecureContext || isStandalone()) return;
    if ((window as Window & { chrome?: { webview?: unknown } }).chrome?.webview) return;

    if (getDismissedUntil() > Date.now()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), 1200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari does not expose beforeinstallprompt. Offer the same prompt
    // with the platform-specific manual installation instructions instead.
    if (isIosSafari()) window.setTimeout(() => setVisible(true), 1200);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [pathname]);

  if (!visible || (!installEvent && !showIosHelp && !isIosSafari())) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_FOR_MS));
    } catch {
      // Private browsing may deny storage; dismissal still applies in memory.
    }
    setVisible(false);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (!installEvent) {
      setShowIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setVisible(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] sm:left-auto sm:right-5 sm:max-w-sm" role="dialog" aria-label="Install LodgeCore">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl shadow-slate-950/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Install LodgeCore</p>
                <p className="mt-1 text-sm leading-5 text-slate-300">Open the online management workspace quickly from your device.</p>
              </div>
              <button type="button" onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {showIosHelp ? (
              <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs leading-5 text-slate-300">
                Tap <Share className="mx-1 inline h-3.5 w-3.5 text-sky-300" /> <span className="font-semibold text-white">Share</span>, then choose <span className="font-semibold text-white">Add to Home Screen</span>.
              </div>
            ) : (
              <button type="button" onClick={() => void install()} className="mt-3 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                {installEvent ? 'Install app' : 'How to install'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
