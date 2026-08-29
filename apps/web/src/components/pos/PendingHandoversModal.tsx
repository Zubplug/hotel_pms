'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type PendingHandoversModalProps = {
  isOpen: boolean;
  onClose: () => void;
  provider: any;
  propertyId: string;
};

export function PendingHandoversModal({
  isOpen,
  onClose,
  provider,
  propertyId
}: PendingHandoversModalProps) {
  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadApprovedShifts();
    }
  }, [isOpen]);

  const loadApprovedShifts = async () => {
    setIsLoading(true);
    try {
      const res = await provider.pos.getMyApprovedShifts(propertyId);
      if (res && res.data) {
        setShifts(res.data);
      } else {
        toast.error(res?.error || 'Failed to load approved shifts');
      }
    } catch (e: any) {
      toast.error(e.message || 'An error occurred while loading shifts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateHandover = async (sessionId: string) => {
    setIsSubmitting(sessionId);
    try {
      // Find the token for the operator to authenticate the API request
      const token = localStorage.getItem('lodgecore_pos_operator_token');
      
      const res = await fetch('/api/v1/financial-control/handovers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          propertyId,
          posSessionIds: [sessionId]
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Handover initiated successfully. Please deliver your cash to the General Cashier.');
        // Remove this shift from the list locally to update UI
        setShifts(prev => prev.filter(s => s.id !== sessionId));
      } else {
        toast.error(data.error || 'Failed to initiate handover');
      }
    } catch (error: any) {
      toast.error('Network error. Failed to initiate handover.');
    } finally {
      setIsSubmitting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Pending Handovers</h2>
              <p className="text-slate-300 text-sm">Past approved shifts waiting to be handed over</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-slate-50 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p>Loading approved shifts...</p>
            </div>
          ) : shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
              <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-700">All Caught Up!</h3>
              <p className="mt-2 text-center max-w-sm">
                You have no approved shifts pending handover. Any recently closed shifts may still be under review by the manager.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-blue-700 text-sm mb-6">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                <p>
                  These shifts have been reviewed and approved by management. 
                  Please click <strong>Initiate Handover</strong> to formally transfer custody of the expected cash to the General Cashier.
                </p>
              </div>

              {shifts.map((shift) => (
                <div key={shift.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800">Shift</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold uppercase">
                          {shift.controlStatus === 'APPROVED_WITH_VARIANCE' ? 'Approved (Variance)' : 'Approved'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {new Date(shift.openedAt).toLocaleString()} - {new Date(shift.closedAt || shift.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Expected Cash</div>
                      <div className="text-xl font-black text-slate-900">
                        ₦{Number(shift.expectedCash || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <Button 
                      onClick={() => handleInitiateHandover(shift.id)}
                      disabled={isSubmitting === shift.id}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
                    >
                      {isSubmitting === shift.id ? 'Initiating...' : 'Initiate Handover'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
