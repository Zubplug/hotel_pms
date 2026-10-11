'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  Hotel,
  Clock,
  Volume2,
  VolumeX,
  CreditCard,
  Banknote,
  AlertCircle,
  ChevronRight,
  Flame,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import {
  unlockAudio,
  playRoomServiceChime,
  isAudioMuted,
  setAudioMuted,
  getAudioState,
} from '@/lib/pos/soundEffects';

interface RoomServiceAlertModalProps {
  orders: any[];
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: (orderId: string) => Promise<void>;
  onReject?: (orderId: string, reason: string) => Promise<void>;
  onSelectOrder?: (order: any) => void;
  currency?: string;
}

const REJECT_REASONS = [
  'Kitchen is currently closed.',
  'Item(s) are out of stock.',
  'Order received too late for service.',
  'Unable to deliver to this room at this time.',
  'Please contact the front desk for assistance.',
];

export function RoomServiceAlertModal({
  orders,
  isOpen,
  onClose,
  onAcknowledge,
  onReject,
  onSelectOrder,
  currency = 'NGN',
}: RoomServiceAlertModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioState, setAudioState] = useState<'running' | 'suspended' | 'muted' | 'unavailable'>('running');

  // Reject confirmation state
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    setAudioState(getAudioState());
  }, [isOpen]);

  // Reset reject panel when changing order
  useEffect(() => {
    setShowRejectConfirm(false);
    setRejectReason(REJECT_REASONS[0]);
  }, [selectedIndex]);

  if (!isOpen || orders.length === 0) return null;

  const currentOrder = orders[Math.min(selectedIndex, orders.length - 1)] || orders[0];
  const items = currentOrder.items || [];
  const roomLabel = currentOrder.tableNumber || currentOrder.displayName || 'Guest Room';
  const isRoomCharge = currentOrder.folioId || currentOrder.notes?.toLowerCase().includes('charge to room');

  const handleMuteToggle = () => {
    const nextMuted = !isAudioMuted();
    setAudioMuted(nextMuted);
    setAudioState(getAudioState());
  };

  const handleTestAudio = async () => {
    await unlockAudio();
    await playRoomServiceChime();
    setAudioState(getAudioState());
  };

  const handleAcknowledge = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onAcknowledge(currentOrder.id);
      if (orders.length <= 1) {
        onClose();
      } else {
        setSelectedIndex(prev => Math.max(0, Math.min(prev, orders.length - 2)));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (isRejecting || !onReject) return;
    setIsRejecting(true);
    try {
      await onReject(currentOrder.id, rejectReason);
      setShowRejectConfirm(false);
      if (orders.length <= 1) {
        onClose();
      } else {
        setSelectedIndex(prev => Math.max(0, Math.min(prev, orders.length - 2)));
      }
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={() => unlockAudio()}
      >
        {/* Header with pulsating alert status */}
        <div className="p-4 bg-gradient-to-r from-amber-600/30 via-purple-600/20 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute -inset-1 rounded-full bg-amber-500 animate-ping opacity-75" />
              <div className="relative w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  New Room Service Order
                </span>
                {orders.length > 1 && (
                  <span className="text-xs font-semibold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                    {orders.length} Pending
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                <Hotel className="w-5 h-5 text-purple-400" />
                {roomLabel}
              </h2>
            </div>
          </div>

          {/* Sound Controls & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMuteToggle}
              title={audioState === 'muted' ? 'Unmute Sound' : 'Mute Sound'}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
            >
              {audioState === 'muted' ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>
            <button
              onClick={handleTestAudio}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium transition"
            >
              Test Chime
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audio state banner if browser suspended autoplay */}
        {audioState === 'suspended' && (
          <div className="px-4 py-2 bg-indigo-950/80 border-b border-indigo-800/50 flex items-center justify-between text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Browser audio is paused. Click anywhere to activate incoming chimes.</span>
            </div>
            <button
              onClick={handleTestAudio}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs transition"
            >
              Enable Sound
            </button>
          </div>
        )}

        {/* Multi-Order Tabs */}
        {orders.length > 1 && (
          <div className="flex gap-2 p-2 px-4 bg-slate-950/60 border-b border-slate-800 overflow-x-auto">
            {orders.map((ord, idx) => (
              <button
                key={ord.id}
                onClick={() => setSelectedIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  idx === selectedIndex
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <span>{ord.tableNumber || `Room #${idx + 1}`}</span>
                <span className="opacity-75 text-[10px]">({ord.orderNumber})</span>
              </button>
            ))}
          </div>
        )}

        {/* Order Details Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(currentOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-slate-400 font-mono">
                {currentOrder.orderNumber}
              </span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              {isRoomCharge ? (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <CreditCard className="w-3 h-3" />
                  Charge to Folio
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  <Banknote className="w-3 h-3" />
                  Pay on Delivery
                </span>
              )}
            </div>
          </div>

          {/* Special Guest Notes */}
          {currentOrder.notes && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <span className="font-bold text-amber-400">Guest Instructions: </span>
              {currentOrder.notes}
            </div>
          )}

          {/* Line Items List */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Ordered Items ({items.length})
            </h4>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              {items.map((item: any, i: number) => (
                <div key={item.id || i} className="p-3 flex items-start justify-between text-sm">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 flex items-center justify-center text-xs font-bold">
                        {item.quantity}×
                      </span>
                      {item.productName}
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-xs text-slate-400 pl-7 space-x-1">
                        {item.modifiers.map((m: any, mi: number) => (
                          <span key={mi} className="bg-slate-800/80 px-1.5 py-0.5 rounded text-[11px] text-slate-300">
                            +{m.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-slate-500 italic pl-7">{item.notes}</p>
                    )}
                  </div>
                  <span className="font-semibold text-slate-200 whitespace-nowrap">
                    {currency} {Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary Total */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between text-sm">
            <span className="text-slate-400">Total Amount Payable</span>
            <span className="text-lg font-bold text-amber-400 font-mono">
              {currency} {Number(currentOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* ── Reject Confirmation Panel (inline, slides in) ───────────── */}
          {showRejectConfirm && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                <XCircle className="w-4 h-4 shrink-0" />
                Decline this order — select a reason
              </div>
              <div className="space-y-1.5">
                {REJECT_REASONS.map(r => (
                  <label key={r} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="rejectReason"
                      value={r}
                      checked={rejectReason === r}
                      onChange={() => setRejectReason(r)}
                      className="mt-0.5 accent-rose-500 shrink-0"
                    />
                    <span className={`text-xs leading-relaxed transition ${rejectReason === r ? 'text-rose-200 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                      {r}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The guest will see this reason on their order tracking page. The order will be marked cancelled.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowRejectConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
                >
                  Go Back
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={isRejecting}
                  className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRejecting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Declining…
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      Confirm Decline
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (onSelectOrder) onSelectOrder(currentOrder);
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition"
          >
            Open in Register
          </button>

          <div className="flex items-center gap-2">
            {/* Decline button — only shown if onReject is wired */}
            {onReject && !showRejectConfirm && (
              <button
                onClick={() => setShowRejectConfirm(true)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                Decline
              </button>
            )}

            {!showRejectConfirm && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-xs font-semibold transition"
              >
                Review Later
              </button>
            )}

            {!showRejectConfirm && (
              <button
                onClick={handleAcknowledge}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-slate-950" />
                    Acknowledge &amp; Fire to Kitchen
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
