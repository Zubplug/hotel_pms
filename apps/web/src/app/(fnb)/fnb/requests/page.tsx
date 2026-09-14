'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function FnbRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const load = async () => { 
    setLoading(true);
    const response = await fetch('/api/v1/pos/price-approvals?mine=true'); 
    const body = await response.json(); 
    if (response.ok) setRequests(body.data || []); 
    else setMessage(body.error || 'Unable to load requests'); 
    setLoading(false);
  };
  
  useEffect(() => { void load(); }, []);

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 text-slate-900 font-sans">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/fnb/menu" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Menu
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My Requests</h1>
            <p className="mt-1 text-sm text-slate-500">Track the approval status of your menu, modifier, and price change requests.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={load} className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all duration-200">
              Refresh
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
            {message}
          </div>
        )}

        {/* Data Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4 rounded-tl-2xl">Request Details</th>
                  <th className="px-6 py-4">Current Price</th>
                  <th className="px-6 py-4">Requested Price</th>
                  <th className="px-6 py-4 rounded-tr-2xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => { 
                  const details = request.details || {}; 
                  const stage = details.stage || 'ACCOUNTANT_REVIEW'; 
                  const name = details.productName || details.name || 'Unnamed item'; 
                  const current = details.oldPrice ?? null; 
                  const requested = details.newPrice ?? details.price ?? 0; 
                  const label = request.type === 'POS_MENU_CREATE' ? 'New Menu Item' : request.type === 'POS_MODIFIER_CREATE' ? 'New Modifier' : 'Price Change'; 
                  
                  const isApproved = request.status === 'APPROVED';
                  const isRejected = request.status === 'REJECTED';
                  const isPending = request.status === 'PENDING';

                  return (
                    <tr key={request.id} className="transition-colors duration-150 hover:bg-slate-50/80">
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{name}</span>
                          <span className="text-xs text-slate-500 mt-1">{label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-slate-500">
                        {current == null ? '—' : formatMoney(Number(current))}
                      </td>
                      <td className="px-6 py-4 align-top font-medium text-slate-900">
                        {formatMoney(Number(requested))}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          {isPending && (
                            <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                              <Clock className="mr-1 h-3 w-3" />
                              Pending
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Approved
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200 shadow-sm">
                              <XCircle className="mr-1 h-3 w-3" />
                              Rejected
                            </span>
                          )}
                          {isPending && (
                            <span className="text-[11px] text-slate-500 font-medium mt-1">
                              Waiting on: {stage.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ); 
                })}
                
                {!requests.length && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <ShieldCheck className="h-8 w-8 mb-3 text-slate-300" />
                        <p className="text-base font-medium text-slate-700">No pending or past requests.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="h-8 w-8 mb-3 animate-spin text-emerald-500" />
                        <p className="text-sm">Loading your requests...</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
