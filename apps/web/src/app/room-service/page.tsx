'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShoppingCart, X, Plus, Minus, ChevronRight, ChevronLeft,
  Hotel, Clock, CheckCircle2, Loader2, CreditCard, Banknote,
  ChefHat, Bell, Star, Sparkles, Bed, Shirt, AlarmClock,
  RefreshCw, AlertTriangle, Send, Package,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Modifier { id: string; name: string; price: number; groupName?: string; groupRequired?: boolean; groupMaxSelect?: number }
interface Product { id: string; name: string; description?: string; price: number; taxRate: number; image?: string; hasModifiers: boolean; modifiers: Modifier[] }
interface Category { id: string; name: string; products: Product[] }
interface Amenity { id: string; name: string; category: string; description?: string; price: number; type: 'AMENITY' | 'SERVICE'; serviceType: string; icon: string }

interface CartItem {
  cartId: string;
  product: Product;
  quantity: number;
  selectedModifiers: Modifier[];
  notes: string;
  total: number;
}

type ViewState = 'menu' | 'cart' | 'payment' | 'tracking';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
}

function calcItemTotal(product: Product, mods: Modifier[], qty: number) {
  const base = product.price + mods.reduce((s, m) => s + m.price, 0);
  const tax = (base * product.taxRate) / 100;
  return (base + tax) * qty;
}

function generateCartId() {
  return `ci_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateOperationId() {
  return `rs_op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const AMENITY_ICON_MAP: Record<string, React.ReactNode> = {
  bath: <Sparkles className="w-5 h-5" />,
  bed: <Bed className="w-5 h-5" />,
  sparkles: <Sparkles className="w-5 h-5" />,
  cup: <Bell className="w-5 h-5" />,
  shirt: <Shirt className="w-5 h-5" />,
  alarm: <AlarmClock className="w-5 h-5" />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Modifier Picker Modal
// ─────────────────────────────────────────────────────────────────────────────
function ModifierModal({
  product,
  onConfirm,
  onCancel,
}: {
  product: Product;
  onConfirm: (mods: Modifier[], notes: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Modifier[]>([]);
  const [notes, setNotes] = useState('');

  const groups = React.useMemo(() => {
    const g: Record<string, Modifier[]> = {};
    product.modifiers.forEach(m => {
      const key = m.groupName || 'Options';
      if (!g[key]) g[key] = [];
      g[key].push(m);
    });
    return g;
  }, [product.modifiers]);

  const toggle = (mod: Modifier) => {
    setSelected(prev =>
      prev.some(s => s.id === mod.id)
        ? prev.filter(s => s.id !== mod.id)
        : [...prev, mod]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#1a1a2e] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{product.name}</h3>
          {product.description && <p className="text-sm text-white/60 mt-1">{product.description}</p>}
          <p className="text-amber-400 font-bold mt-1">{fmtCurrency(product.price)}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {Object.entries(groups).map(([groupName, mods]) => (
            <div key={groupName}>
              <p className="text-xs font-bold text-amber-400/80 uppercase tracking-wider mb-2">{groupName}</p>
              <div className="space-y-2">
                {mods.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => toggle(mod)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      selected.some(s => s.id === mod.id)
                        ? 'bg-amber-500/20 border-amber-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/70'
                    }`}
                  >
                    <span className="text-sm font-medium">{mod.name}</span>
                    {mod.price > 0 && <span className="text-xs text-amber-400">+{fmtCurrency(mod.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Special Instructions</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g. no onions, extra spicy…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-amber-500/60 min-h-[80px]"
            />
          </div>
        </div>
        <div className="p-4 flex gap-3 border-t border-white/10">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/5 transition">Cancel</button>
          <button
            onClick={() => onConfirm(selected, notes)}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 hover:from-amber-400 transition"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracking Stepper
// ─────────────────────────────────────────────────────────────────────────────
const ORDER_STEPS = [
  { key: 'SUBMITTED', label: 'Order Received', desc: 'Your order has been sent to the kitchen.' },
  { key: 'IN_SERVICE', label: 'Being Prepared', desc: 'The kitchen is preparing your order.' },
  { key: 'CLOSED',    label: 'On the Way',     desc: 'Your order is on its way to your room.' },
];

function OrderTracker({ orderId, onNewOrder }: { orderId: string; onNewOrder: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/room-service/orders/${orderId}`);
      if (!res.ok) { setError('Could not reach the server.'); return; }
      const json = await res.json();
      const o = json?.data?.order;
      if (o) setOrder(o);
      // Stop polling once the order reaches a terminal state
      if (o?.status === 'CLOSED' || o?.status === 'CANCELLED') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      setError('Connection error. Please refresh.');
    }
  }, [orderId]);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStatus]);

  const currentStepIdx = ORDER_STEPS.findIndex(s => s.key === order?.status);
  const activeIdx = currentStepIdx >= 0 ? currentStepIdx : 0;

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/30">
            <ChefHat className="w-10 h-10 text-slate-950" />
          </div>
          <h2 className="text-2xl font-black text-white">Order Tracking</h2>
          {order && (
            <p className="text-white/50 text-sm mt-1">Order {order.orderNumber}</p>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-6 text-rose-300 text-sm text-center">
            {error}
            <button onClick={fetchStatus} className="block mx-auto mt-2 text-xs underline">Try again</button>
          </div>
        )}

        {!order && !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        )}

        {order && (
          <>
            {/* ── CANCELLED / REJECTED state ───────────────────────────── */}
            {order.status === 'CANCELLED' ? (
              <>
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 mb-6 text-center">
                  <div className="text-4xl mb-3">😔</div>
                  <p className="text-rose-300 font-bold text-base mb-2">Order Could Not Be Fulfilled</p>
                  {(() => {
                    // Strip the internal staff prefix from the notes field
                    const raw: string = order.notes || '';
                    const match = raw.match(/\[REJECTED[^\]]*\]:\s*(.+)/);
                    const reason = match ? match[1].trim() : 'We were unable to process your order at this time.';
                    return (
                      <p className="text-white/50 text-sm leading-relaxed">{reason}</p>
                    );
                  })()}
                  <p className="text-white/30 text-xs mt-3">Please contact the front desk for further assistance.</p>
                </div>
                <button
                  onClick={onNewOrder}
                  className="w-full py-4 rounded-2xl border border-amber-500/30 text-amber-400 font-semibold text-sm hover:bg-amber-500/10 transition"
                >
                  Place Another Order
                </button>
              </>
            ) : (
              <>
                {/* Steps */}
                <div className="space-y-3 mb-8">
                  {ORDER_STEPS.map((step, idx) => {
                    const isCompleted = idx < activeIdx;
                    const isActive = idx === activeIdx;
                    return (
                      <div key={step.key} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                        isActive ? 'bg-amber-500/15 border border-amber-500/40' :
                        isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20' :
                        'bg-white/4 border border-white/8 opacity-40'
                      }`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted ? 'bg-emerald-500' :
                          isActive ? 'bg-amber-500 animate-pulse' :
                          'bg-white/10'
                        }`}>
                          {isCompleted
                            ? <CheckCircle2 className="w-5 h-5 text-white" />
                            : isActive
                              ? <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                              : <span className="text-white/40 text-sm font-bold">{idx + 1}</span>
                          }
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isActive ? 'text-amber-300' : isCompleted ? 'text-emerald-300' : 'text-white/40'}`}>
                            {step.label}
                          </p>
                          {isActive && <p className="text-xs text-white/50 mt-0.5">{step.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Order summary mini */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Your Order</p>
                  {(order.items || []).map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm text-white/80 py-1">
                      <span>{item.quantity}× {item.productName}</span>
                      <span>{fmtCurrency(Number(item.total))}</span>
                    </div>
                  ))}
                  <div className="border-t border-white/10 mt-3 pt-3 flex justify-between font-bold text-white">
                    <span>Total</span>
                    <span className="text-amber-400">{fmtCurrency(Number(order.total))}</span>
                  </div>
                </div>

                {order.status === 'CLOSED' && (
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-2">🍽️</div>
                    <p className="text-emerald-400 font-bold">Your order has been delivered!</p>
                    <p className="text-white/40 text-sm mt-1">Thank you for staying with us. Enjoy your meal!</p>
                  </div>
                )}

                <button
                  onClick={onNewOrder}
                  className="w-full py-4 rounded-2xl border border-amber-500/30 text-amber-400 font-semibold text-sm hover:bg-amber-500/10 transition"
                >
                  Place Another Order
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component (inner — uses useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────
function RoomServicePageInner() {
  const searchParams = useSearchParams();
  // New signed-token URL format: /room-service?t=<token>&rn=<roomNo>
  // Legacy format still accepted: /room-service?p=<propertyId>&r=<roomId>&rn=<roomNo>
  const qrToken   = searchParams.get('t') || '';
  const propertyId = searchParams.get('p') || searchParams.get('propertyId') || '';
  const roomId     = searchParams.get('r') || searchParams.get('roomId') || '';
  const roomNo     = searchParams.get('rn') || searchParams.get('roomNo') || '';

  // Determine if we have enough info to load the room
  const hasToken  = !!qrToken;
  const hasLegacy = !!(propertyId && (roomId || roomNo));

  // ── Data State ─────────────────────────────────────────────────────
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [preferredOutletId, setPreferredOutletId] = useState('');

  // ── UI State ────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewState>('menu');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>([]);
  const [modifierTarget, setModifierTarget] = useState<Product | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'ROOM_CHARGE' | 'PAY_ON_DELIVERY'>('ROOM_CHARGE');
  const [guestNotes, setGuestNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState('');
  const operationIdRef = useRef(generateOperationId());
  const categoryBarRef = useRef<HTMLDivElement>(null);

  // ── Load Room & Menu ────────────────────────────────────────────────
  useEffect(() => {
    if (!hasToken && !hasLegacy) {
      setLoadError('Invalid QR code — missing or unsigned room information.');
      setIsLoading(false);
      return;
    }
    const load = async () => {
      try {
        // 1. Fetch room info first (we need the real propertyId from the verified token)
        const roomInfoParams = new URLSearchParams();
        if (qrToken) {
          roomInfoParams.set('t', qrToken);
        } else {
          roomInfoParams.set('propertyId', propertyId);
          if (roomId) roomInfoParams.set('roomId', roomId);
          if (roomNo) roomInfoParams.set('roomNo', roomNo);
        }
        if (roomNo) roomInfoParams.set('rn', roomNo);

        const roomRes  = await fetch(`/api/v1/room-service/room-info?${roomInfoParams.toString()}`);
        const roomJson = await roomRes.json();

        if (!roomRes.ok) {
          setLoadError(roomJson?.error?.message || 'Room not found. Please contact the front desk.');
          setIsLoading(false);
          return;
        }

        const roomData = roomJson?.data;
        setRoomInfo(roomData);

        // 2. Now we have the verified propertyId from the server — use it for the menu call
        const verifiedPropertyId = roomData?.property?.id || propertyId;
        if (!verifiedPropertyId) {
          setIsLoading(false);
          return; // no menu, but room info loaded fine
        }

        const menuRes  = await fetch(`/api/v1/room-service/menu?propertyId=${verifiedPropertyId}`);
        const menuJson = await menuRes.json();
        const menuData = menuJson?.data;
        setCategories(menuData?.categories || []);
        setAmenities(menuData?.amenities || []);
        setPreferredOutletId(menuData?.preferredOutletId || '');

        // Default payment to ROOM_CHARGE only if guest is checked in
        if (!roomData?.stay?.isCheckedIn) setPaymentMethod('PAY_ON_DELIVERY');
      } catch {
        setLoadError('Could not load menu. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken, propertyId, roomId, roomNo, hasToken, hasLegacy]);

  // ── Cart Operations ─────────────────────────────────────────────────
  const addToCart = useCallback((product: Product, mods: Modifier[], notes: string) => {
    const total = calcItemTotal(product, mods, 1);
    setCart(prev => {
      // Try to merge with existing identical item (same product, same mods, no notes)
      if (!notes && mods.length === 0) {
        const existing = prev.find(i => i.product.id === product.id && i.selectedModifiers.length === 0 && !i.notes);
        if (existing) {
          return prev.map(i => i.cartId === existing.cartId
            ? { ...i, quantity: i.quantity + 1, total: calcItemTotal(product, mods, i.quantity + 1) }
            : i
          );
        }
      }
      return [...prev, { cartId: generateCartId(), product, quantity: 1, selectedModifiers: mods, notes, total }];
    });
  }, []);

  const updateQty = useCallback((cartId: string, delta: number) => {
    setCart(prev => prev.flatMap(item => {
      if (item.cartId !== cartId) return [item];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return [];
      return [{ ...item, quantity: newQty, total: calcItemTotal(item.product, item.selectedModifiers, newQty) }];
    }));
  }, []);

  const toggleAmenity = useCallback((amenity: Amenity) => {
    setSelectedAmenities(prev =>
      prev.some(a => a.id === amenity.id)
        ? prev.filter(a => a.id !== amenity.id)
        : [...prev, amenity]
    );
  }, []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.total, 0);

  // ── Submission ──────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (isSubmitting) return;
    if (cart.length === 0 && selectedAmenities.length === 0) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/room-service/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Send signed token when available; API falls back to raw IDs for legacy cards
          ...(qrToken ? { token: qrToken } : { propertyId, roomId: roomInfo?.room?.id || roomId }),
          outletId: preferredOutletId || undefined,
          paymentMethod,
          notes: guestNotes.trim() || undefined,
          operationId: operationIdRef.current,
          items: cart.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
            notes: i.notes || undefined,
            modifiers: i.selectedModifiers.map(m => ({ id: m.id, name: m.name })),
          })),
          amenities: selectedAmenities.map(a => ({
            id: a.id,
            name: a.name,
            serviceType: a.serviceType,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json?.error?.message || 'Failed to place order. Please try again.');
        return;
      }
      const orderId = json?.data?.order?.id;
      if (orderId) setPlacedOrderId(orderId);
      setView('tracking');
      setCart([]);
      setSelectedAmenities([]);
      setGuestNotes('');
      operationIdRef.current = generateOperationId(); // Reset for next order
    } catch {
      setSubmitError('Network error — please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Filtered Products ───────────────────────────────────────────────
  const allProducts = categories.flatMap(c => c.products.map(p => ({ ...p, _cat: c.name })));
  const displayedProducts = activeCategory === 'all'
    ? allProducts
    : categories.find(c => c.id === activeCategory)?.products.map(p => ({ ...p, _cat: '' })) || [];

  // Strip building/floor prefix from room number: "1.3.302" → "302"
  const formatRoomNo = (raw: string) => {
    if (!raw) return '';
    const parts = raw.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : raw;
  };
  const displayRoomNo = formatRoomNo(roomInfo?.room?.number || roomNo);

  // ── Loading / Error State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Hotel className="w-8 h-8 text-amber-400 animate-pulse" />
        </div>
        <p className="text-white/60 text-sm font-medium">Loading your room menu…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Something went wrong</h2>
        <p className="text-white/50 text-sm max-w-xs">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-3 rounded-2xl bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Order Tracking View ─────────────────────────────────────────────
  if (view === 'tracking' && placedOrderId) {
    return (
      <OrderTracker
        orderId={placedOrderId}
        onNewOrder={() => {
          setPlacedOrderId('');
          setView('menu');
        }}
      />
    );
  }

  // ── Main Layout ─────────────────────────────────────────────────────
  return (
    // Full-screen dark shell — fills edge-to-edge on any screen width,
    // preventing the white gap visible on non-mobile viewports.
    <div className="min-h-screen w-full bg-[#0d0d1a]">
      <div className="min-h-screen bg-[#0d0d1a] text-white font-sans flex flex-col max-w-[480px] mx-auto relative">
        {/* Gradient Top */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-amber-500/10 via-purple-500/5 to-transparent pointer-events-none" />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="relative z-10 px-5 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-400/70 uppercase tracking-widest mb-0.5">Room Service</p>
              <h1 className="text-2xl font-black text-white">
                Room {displayRoomNo}
              </h1>
              {roomInfo?.stay?.guestName && (
                <p className="text-white/40 text-sm mt-0.5">Welcome, {roomInfo.stay.guestName.split(' ')[0]}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Hotel className="w-6 h-6 text-amber-400" />
              </div>
              {roomInfo?.stay?.isCheckedIn && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">In-house</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-white/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Delivery in 25–40 mins · Room delivery available 24/7</span>
          </div>
        </header>

      {/* ── Category Bar ──────────────────────────────────────────────── */}
      {view === 'menu' && (
        <div ref={categoryBarRef} className="relative z-10 flex gap-2 px-5 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/8 text-white/60 border border-white/10'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/8 text-white/60 border border-white/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
          {amenities.length > 0 && (
            <button
              onClick={() => setActiveCategory('amenities')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeCategory === 'amenities'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/8 text-white/60 border border-white/10'
              }`}
            >
              ✨ Amenities
            </button>
          )}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto px-5 pb-32">

        {/* MENU VIEW */}
        {view === 'menu' && (
          <>
            {/* Products Grid */}
            {activeCategory !== 'amenities' && (
              <div className="space-y-3 mt-2">
                {displayedProducts.length === 0 && (
                  <div className="text-center py-16 text-white/30">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No items available right now.</p>
                  </div>
                )}
                {displayedProducts.map(product => (
                  <div
                    key={product.id}
                    className="group bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer"
                    onClick={() => {
                      if (product.hasModifiers && product.modifiers.length > 0) {
                        setModifierTarget(product);
                      } else {
                        addToCart(product, [], '');
                      }
                    }}
                  >
                    {/* Product Icon / Image */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0 overflow-hidden border border-amber-500/10">
                      {product.image
                        ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        : <ChefHat className="w-7 h-7 text-amber-400/60" />
                      }
                    </div>
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm leading-tight">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-amber-400 font-bold text-sm">{fmtCurrency(product.price)}</span>
                        {product.hasModifiers && (
                          <span className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">Customisable</span>
                        )}
                      </div>
                    </div>
                    {/* Add Button */}
                    <div className="shrink-0">
                      {cart.some(ci => ci.product.id === product.id) ? (
                        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-1.5">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              const ci = cart.find(i => i.product.id === product.id);
                              if (ci) updateQty(ci.cartId, -1);
                            }}
                            className="text-amber-400"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-amber-300 font-bold text-sm min-w-[16px] text-center">
                            {cart.filter(i => i.product.id === product.id).reduce((s, i) => s + i.quantity, 0)}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (product.hasModifiers && product.modifiers.length > 0) {
                                setModifierTarget(product);
                              } else {
                                addToCart(product, [], '');
                              }
                            }}
                            className="text-amber-400"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                          <Plus className="w-4 h-4 text-slate-950" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Amenities */}
            {activeCategory === 'amenities' && (
              <div className="space-y-3 mt-2">
                <p className="text-xs text-white/40 mt-1">Select items to request. Complimentary amenities are free of charge.</p>
                {amenities.map(amenity => (
                  <button
                    key={amenity.id}
                    onClick={() => toggleAmenity(amenity)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                      selectedAmenities.some(a => a.id === amenity.id)
                        ? 'bg-purple-500/20 border-purple-500/50'
                        : 'bg-white/5 border-white/8 hover:border-purple-500/20'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedAmenities.some(a => a.id === amenity.id) ? 'bg-purple-500/30 text-purple-300' : 'bg-white/8 text-white/40'
                    }`}>
                      {AMENITY_ICON_MAP[amenity.icon] || <Sparkles className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white leading-tight">{amenity.name}</p>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{amenity.description}</p>
                      <span className="text-[10px] text-white/30 mt-1 inline-block">{amenity.category}</span>
                    </div>
                    {selectedAmenities.some(a => a.id === amenity.id) && (
                      <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
          <div className="mt-2 space-y-4">
            <button
              onClick={() => setView('menu')}
              className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Continue ordering
            </button>

            {cart.length === 0 && selectedAmenities.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-10 h-10 mx-auto text-white/20 mb-3" />
                <p className="text-white/40 text-sm">Your cart is empty.</p>
                <button onClick={() => setView('menu')} className="mt-4 text-amber-400 text-sm font-semibold underline">Browse menu</button>
              </div>
            )}

            {/* Cart Items */}
            {cart.map(item => (
              <div key={item.cartId} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">{item.product.name}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        {item.selectedModifiers.map(m => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && <p className="text-xs text-white/40 italic mt-0.5">{item.notes}</p>}
                  </div>
                  <button onClick={() => updateQty(item.cartId, -item.quantity)} className="text-rose-400/60 hover:text-rose-400 transition p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 bg-white/8 border border-white/10 rounded-xl px-3 py-1.5">
                    <button onClick={() => updateQty(item.cartId, -1)} className="text-white/60 hover:text-white transition">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-white font-bold text-sm w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.cartId, 1)} className="text-white/60 hover:text-white transition">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-amber-400">{fmtCurrency(item.total)}</span>
                </div>
              </div>
            ))}

            {/* Amenities summary */}
            {selectedAmenities.length > 0 && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Requested Amenities</p>
                {selectedAmenities.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-white/70">{a.name}</span>
                    <button onClick={() => toggleAmenity(a)} className="text-rose-400/60 hover:text-rose-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Guest notes */}
            {(cart.length > 0 || selectedAmenities.length > 0) && (
              <>
                <div>
                  <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Order Instructions (optional)</p>
                  <textarea
                    value={guestNotes}
                    onChange={e => setGuestNotes(e.target.value)}
                    placeholder="Any special requests for the room? E.g. no nuts, allergen info…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-amber-500/50 min-h-[80px]"
                  />
                </div>

                {/* Payment method */}
                <div>
                  <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!roomInfo?.stay?.isCheckedIn}
                      onClick={() => setPaymentMethod('ROOM_CHARGE')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                        paymentMethod === 'ROOM_CHARGE'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : roomInfo?.stay?.isCheckedIn
                            ? 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                            : 'bg-white/3 border-white/5 text-white/20 cursor-not-allowed'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="text-xs font-bold">Charge to Room</span>
                      {!roomInfo?.stay?.isCheckedIn && <span className="text-[10px] opacity-60">Not available</span>}
                    </button>
                    <button
                      onClick={() => setPaymentMethod('PAY_ON_DELIVERY')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                        paymentMethod === 'PAY_ON_DELIVERY'
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                      <span className="text-xs font-bold">Pay on Delivery</span>
                    </button>
                  </div>
                </div>

                {/* Order Total */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex justify-between text-sm text-white/60 mb-1">
                    <span>Subtotal</span>
                    <span>{fmtCurrency(cart.reduce((s, i) => s + (i.total / (1 + i.product.taxRate / 100)), 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/60 mb-3">
                    <span>Tax & Service</span>
                    <span>{fmtCurrency(cart.reduce((s, i) => s + (i.total - i.total / (1 + i.product.taxRate / 100)), 0))}</span>
                  </div>
                  <div className="flex justify-between font-black text-lg border-t border-white/10 pt-3">
                    <span className="text-white">Total</span>
                    <span className="text-amber-400">{fmtCurrency(cartTotal)}</span>
                  </div>
                </div>

                {submitError && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-rose-300 text-sm text-center">
                    {submitError}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Bar ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-gradient-to-t from-[#0d0d1a] via-[#0d0d1a]/95 to-transparent z-20">
        {view === 'menu' && (cart.length > 0 || selectedAmenities.length > 0) && (
          <button
            onClick={() => setView('cart')}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm shadow-2xl shadow-amber-500/40 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>View Order</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-950/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
                {cartCount + selectedAmenities.length}
              </span>
              <span>{fmtCurrency(cartTotal)}</span>
            </div>
          </button>
        )}

        {view === 'cart' && (cart.length > 0 || selectedAmenities.length > 0) && (
          <button
            onClick={submitOrder}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Placing order…</>
            ) : (
              <><Send className="w-5 h-5" /> Place Order · {fmtCurrency(cartTotal)}</>
            )}
          </button>
        )}
      </div>

      {/* ── Modifier Modal ─────────────────────────────────────────────── */}
      {modifierTarget && (
        <ModifierModal
          product={modifierTarget}
          onConfirm={(mods, notes) => {
            addToCart(modifierTarget, mods, notes);
            setModifierTarget(null);
          }}
          onCancel={() => setModifierTarget(null)}
        />
      )}
      </div>{/* end max-w content column */}
    </div>{/* end full-screen dark shell */}
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Exported Page — wraps inner in Suspense for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────
export default function RoomServicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <RoomServicePageInner />
    </Suspense>
  );
}
