'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { goBack } from '@/lib/frontdesk-navigation';
import { ArrowLeft, Wallet, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { GuestCreditRefundDialog } from '@/components/accountant/GuestCreditRefundDialog';
import { format } from 'date-fns';

export default function FrontDeskGuestCreditsPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();

  const { data: creditsData, isLoading: creditsLoading } = useQuery({
    queryKey: ['frontdesk', 'guestCredits', propertyId],
    queryFn: async () => {
      return provider.guestCredits.list(propertyId);
    },
    enabled: !!propertyId,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      {/* Premium command header */}
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-emerald-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-[-130px] left-1/3 h-64 w-64 rounded-full bg-teal-400/10 blur-[70px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3">
            <button onClick={() => goBack(router, '/frontdesk')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Back to previous screen"><ArrowLeft className="h-4 w-4" /></button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-emerald-300">Guest Credits</span>
          </div>
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-emerald-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/15"><Wallet className="h-3.5 w-3.5" /></span> Guest Accounts</div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Guest Credits</h1>
              <p className="mt-2 text-sm text-slate-400">View available credits and process refunds for guests.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
        {creditsLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
          </div>
        ) : (() => {
          const credits: any[] = Array.isArray(creditsData) ? creditsData : ((creditsData as any)?.data ?? []);
          return credits.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">No Guest Credits</h3>
              <p className="text-slate-500">No guests with available credit (Refund Owed) at this property.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {credits.map((credit: any) => (
                <div key={credit.guestId} className="group bg-white rounded-3xl p-6 border border-emerald-200 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all flex flex-col h-full">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500 rounded-t-3xl" />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-lg">
                        {credit.guestName?.[0] ?? '?'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{credit.guestName}</h3>
                        <p className="text-xs text-slate-500">{credit.guestPhone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">Available Credit</p>
                      <p className="text-xl font-extrabold text-emerald-600">
                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: credit.currency || 'NGN', maximumFractionDigits: 0 }).format(credit.availableAmount)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mb-4">
                    Last activity: {credit.lastActivityAt ? format(new Date(credit.lastActivityAt), 'MMM d, yyyy') : '—'}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-100">
                    {(credit.creditEntryIds?.[0] || credit.creditEntryId) && (
                      <div className="mb-2 flex justify-end">
                        <GuestCreditRefundDialog
                          entryId={credit.creditEntryIds?.[0] || credit.creditEntryId}
                          guestId={credit.guestId}
                          propertyId={propertyId}
                          guestName={credit.guestName}
                          amount={Number(credit.availableAmount || 0)}
                          currency={credit.currency || 'NGN'}
                        />
                      </div>
                    )}
                    <Button
                      onClick={() => router.push(`/frontdesk/reservations/walk-in?guestId=${encodeURIComponent(credit.guestId)}`)}
                      className="w-full rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create New Reservation
                    </Button>
                    {!isOnline && <p className="text-xs text-amber-600 mt-1 text-center">Offline: reservation and credit application will sync later</p>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
