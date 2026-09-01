import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Key, X, Calendar, ArrowRight } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { ManagerOverrideModal } from '../pos/ManagerOverrideModal';
import { format, addYears } from 'date-fns';

type FrontDeskMasterCardModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FrontDeskMasterCardModal({ isOpen, onClose }: FrontDeskMasterCardModalProps) {
  const { provider } = useLodgeCoreProvider();
  
  const [mounted, setMounted] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addYears(new Date(), 10), 'yyyy-MM-dd'));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate(format(addYears(new Date(), 10), 'yyyy-MM-dd'));
      setShowOverride(false);
      setError('');
      setSuccess(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleCreateClick = () => {
    setShowOverride(true);
  };

  const handleAuthorized = async (managerId: string, managerPin: string, reason: string) => {
    setShowOverride(false);
    setIsLoading(true);
    setError('');

    try {
      // In a real app we'd want times too, but hardware agent parses Date.
      const res = await provider.keycards.encodeMasterCard({ 
          startDate: `${startDate}T00:00:00`,
          endDate: `${endDate}T23:59:59`,
          managerId,
          pin: managerPin,
          reason
      });
      if (res.success) {
        setSuccess(true);
        setTimeout(onClose, 2000);
      } else {
        setError(res.error?.message || 'Failed to encode Master Card');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-200 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Create Master Card</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 text-green-600">
              <Key className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Master Card Encoded!</h3>
            <p className="text-slate-500">The master card is now ready to use.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">
              A Master Card can open any door in the hotel. You can restrict how long this card is valid for by setting the dates below.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valid From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valid Until</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              onClick={handleCreateClick}
              disabled={isLoading || !startDate || !endDate}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Require Manager Approval <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </>
        )}
      </div>

      <ManagerOverrideModal
        isOpen={showOverride}
        actionName="Create Master Card"
        onAuthorized={handleAuthorized}
        onCancel={() => setShowOverride(false)}
      />
    </div>
  );

  return createPortal(content, document.body);
}
