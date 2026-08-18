'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Search, Trash2, Plus, Minus, User, Utensils,
  Loader2, CreditCard, Banknote, LayoutGrid,
  ChefHat, Scissors, X, Building2, Send, Flame, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppSwitcher } from '@/components/layout/AppSwitcher';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { formatCurrency } from '@/lib/utils';
import { StaffSwitchPad } from '@/components/pos/StaffSwitchPad';
import { MySalesModal } from '@/components/pos/MySalesModal';
import { MyOrdersModal } from '@/components/pos/MyOrdersModal';
import { TableMap } from '@/components/pos/TableMap';
import { ModifierSelectionModal } from '@/components/pos/ModifierSelectionModal';
import { CheckSplitModal } from '@/components/pos/CheckSplitModal';
import { KotPanel } from '@/components/pos/KotPanel';
import { PosSidebar } from '@/components/pos/PosSidebar';
import { PosContextBar } from '@/components/pos/PosContextBar';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type OrderItemModifier = { id: string; name: string; price: number };

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
  course?: number;
  kitchenStatus?: string;
  station?: string; // KITCHEN | BAR | DIRECT | NONE
  fired?: boolean;  // true once sent to production
  modifiers?: OrderItemModifier[];
};

type ViewMode = 'menu' | 'tables';

export default function PosTerminalPage() {
  const { provider } = useLodgeCoreProvider();
  const { data: session, status: sessionStatus } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';
  const router = useRouter();

  // ── Core state ────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('menu');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Table / session context ───────────────────────────────────────
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState<number>(0);
  const [guestCount, setGuestCount] = useState(2);
  const [sessionContext, setSessionContext] = useState<any | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [orderChecks, setOrderChecks] = useState<any[]>([]);

  // ── Operator ──────────────────────────────────────────────────────
  const [activeOperator, setActiveOperator] = useState<any | null>(null);
  const [operatorToken, setOperatorToken] = useState<string | null>(null);
  const [showSwitchPad, setShowSwitchPad] = useState(false);
  const [showMySales, setShowMySales] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);

  // ── Modals ────────────────────────────────────────────────────────
  const [modifierTarget, setModifierTarget] = useState<any | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Load products / categories + restore session context
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!propertyId) return;
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          provider.pos.getProducts(propertyId),
          provider.pos.getCategories(propertyId),
        ]);
        if (prodRes.data) setProducts(prodRes.data);
        if (catRes.data) setCategories(catRes.data);

        const activeSessionId =
          (session as any)?.sessionId ||
          localStorage.getItem('lodgecore_pos_session_id');

        if (activeSessionId) {
          try {
            const [operatorRes, contextRes] = await Promise.all([
              provider.pos.getCurrentOperator(activeSessionId),
              provider.pos.getSessionContext(activeSessionId),
            ]);
            if (!operatorRes.error && operatorRes.data?.staff) {
              setActiveOperator(operatorRes.data.staff);
              const savedToken = localStorage.getItem('lodgecore_pos_operator_token');
              if (savedToken) setOperatorToken(savedToken);
            }
            if (!contextRes.error && contextRes.data) {
              setSessionContext(contextRes.data);
            } else {
              localStorage.removeItem('lodgecore_pos_session_id');
              router.push('/pos/start-shift');
            }
          } catch {
            console.error('Failed to load POS session context');
          }
        }
      } catch (err) {
        console.error('Failed to fetch POS data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [propertyId, provider, session]);

  // Redirect if no drawer session
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const activeSessionId =
        (session as any)?.sessionId ||
        localStorage.getItem('lodgecore_pos_session_id');
      if (!activeSessionId) router.push('/pos/start-shift');
    }
  }, [sessionStatus, session, router]);

  // ─────────────────────────────────────────────────────────────────
  // Cart helpers
  // ─────────────────────────────────────────────────────────────────
  const addToCart = useCallback((product: any, modifiers: OrderItemModifier[] = []) => {
    const modifierTotal = modifiers.reduce((s, m) => s + m.price, 0);
    const effectivePrice = Number(product.price) + modifierTotal;
    const itemId = `${product.id}_${Date.now()}`;
    // Use the pre-resolved station from the enriched products API
    const station: string = product.resolvedStation || product.productionStation || 'KITCHEN';

    setCart((prev) => {
      // Only merge if no modifiers and not yet fired (unfired items can be merged)
      if (modifiers.length === 0) {
        const existing = prev.find(
          (i) => i.productId === product.id && !i.fired && (!i.modifiers || i.modifiers.length === 0)
        );
        if (existing) {
          return prev.map((item) =>
            item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
      }
      return [
        ...prev,
        {
          id: itemId,
          productId: product.id,
          name: product.name,
          price: effectivePrice,
          quantity: 1,
          taxRate: Number(product.taxRate || 0),
          kitchenStatus: 'PENDING',
          station,
          fired: false,
          modifiers,
        },
      ];
    });
  }, []);

  const handleProductTap = (product: any) => {
    // Only show modifier dialog if the product actually has modifiers
    if (product.hasModifiers) {
      setModifierTarget(product);
    } else {
      addToCart(product, []);
    }
  };

  const handleModifierConfirm = (product: any, selectedModifiers: any[]) => {
    addToCart(product, selectedModifiers);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  // ─────────────────────────────────────────────────────────────────
  // Table selection
  // ─────────────────────────────────────────────────────────────────
  const handleTableSelect = async (table: any) => {
    setActiveTableId(table.id);
    setActiveTableName(table.name);
    setViewMode('menu');
    if (table.currentOrderId) {
      setCurrentOrderId(table.currentOrderId);
      try {
        const res = await provider.pos.getOrder(table.currentOrderId);
        if (res.data) {
          const order = res.data;
          const checks = order.checks || [];
          setOrderChecks(checks);
          
          let itemsToLoad = order.items;
          if (checks.length > 0) {
            const openCheck = checks.find((c: any) => c.status === 'OPEN') || checks[0];
            setActiveCheckId(openCheck.id);
            itemsToLoad = openCheck.items;
            toast.info(`Table ${table.name} — loaded check ${openCheck.checkNumber}`);
          } else {
            setActiveCheckId(null);
            toast.info(`Table ${table.name} — existing order loaded`);
          }

          setCart(itemsToLoad.map((i: any) => ({
            id: i.id,
            productId: i.productId,
            name: i.productName,
            price: Number(i.unitPrice),
            quantity: i.quantity,
            taxRate: Number(i.taxRate),
            kitchenStatus: i.kitchenStatus,
            modifiers: i.modifiers || [],
          })));
        } else {
          toast.error("Failed to load order data");
        }
      } catch (err) {
        console.error("Failed to load order", err);
      }
    } else {
      setCurrentOrderId(null);
      setActiveCheckId(null);
      setOrderChecks([]);
      setCart([]);
      toast.success(`Table ${table.name} selected`);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // SEND ORDER — creates new order, fires production batches
  // ─────────────────────────────────────────────────────────────────
  const handleSendOrder = async () => {
    if (!operatorToken) { toast.error('No operator authenticated'); return; }
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setIsProcessing(true);
    try {
      const sessionId = (session as any)?.sessionId || localStorage.getItem('lodgecore_pos_session_id');
      const orderData = {
        propertyId,
        outletId: sessionContext?.outlet?.id,
        sessionId,
        tableId: activeTableId,
        tableNumber: activeTableName,
        guestCount,
        serverStaffId: activeOperator?.id,
        subtotal,
        taxAmount: tax,
        total,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          taxRate: item.taxRate,
          taxAmount: item.price * item.quantity * (item.taxRate / 100),
          total: item.price * item.quantity,
          kitchenStatus: item.kitchenStatus,
          modifiers: item.modifiers ?? [],
        })),
        payments: [],
      };
      const res = await provider.pos.createOrder(orderData, operatorToken);
      if (res.error) throw new Error(res.error);
      const orderId = res.data?.id;
      if (orderId) setCurrentOrderId(orderId);
      // Mark all items as fired
      setCart((prev) => prev.map((i) => ({ ...i, fired: true })));
      setTableRefreshTrigger(Date.now());
      const batchCount = res.data?.productionBatches?.length ?? 0;
      toast.success(`Order sent! ${batchCount > 0 ? `${batchCount} production ticket(s) created 🔥` : 'Items queued for service ⚡'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send order');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // FIRE MORE ITEMS — adds new items to existing order
  // ─────────────────────────────────────────────────────────────────
  const handleFireMore = async () => {
    if (!operatorToken) { toast.error('No operator authenticated'); return; }
    if (!currentOrderId) { toast.error('No active order on this table'); return; }
    const newItems = cart.filter((i) => !i.fired);
    if (newItems.length === 0) { toast.error('No new items to fire'); return; }
    setIsProcessing(true);
    try {
      const res = await provider.pos.fireItems(currentOrderId, newItems.map((item) => ({
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: item.taxRate,
        taxAmount: item.price * item.quantity * (item.taxRate / 100),
        total: item.price * item.quantity,
        modifiers: item.modifiers ?? [],
      })), operatorToken);
      if (res.error) throw new Error(res.error);
      setCart((prev) => prev.map((i) => ({ ...i, fired: true })));
      setTableRefreshTrigger(Date.now());
      const batchCount = res.data?.newBatches?.length ?? 0;
      toast.success(`${newItems.length} item(s) fired! ${batchCount > 0 ? `${batchCount} ticket(s) sent 🔥` : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fire items');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // CHARGE — process payment on existing order
  // ─────────────────────────────────────────────────────────────────
  const handleCharge = async (method: string) => {
    if (!operatorToken) { toast.error('No operator authenticated'); return; }
    if (!currentOrderId) { toast.error('No active order to charge'); return; }
    setIsProcessing(true);
    try {
      const paymentData = { method, amount: total, currency: 'NGN', checkId: activeCheckId };
      const res = await provider.pos.payOrder(currentOrderId, paymentData, operatorToken);
      if (res.error) throw new Error(res.error);
      toast.success(`Payment of ${formatCurrency(total)} via ${method} processed ✓`);
      setCart([]);
      setActiveTableId(null);
      setActiveTableName(null);
      setCurrentOrderId(null);
      setActiveCheckId(null);
      setOrderChecks([]);
      setShowChargeModal(false);
      setTableRefreshTrigger(Date.now());
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Totals
  // ─────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = cart.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;


  const filteredProducts = products.filter(
    (p) =>
      (activeCategory === 'all' || p.categoryId === activeCategory) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Loading POS Configuration...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Main layout (Premium Redesign)
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. Global Sidebar */}
      <PosSidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenMyOrders={() => setShowMyOrders(true)}
        onOpenMySales={() => setShowMySales(true)}
        onOpenKitchen={() => {}}
        onLock={() => { 
          setActiveOperator(null); 
          setOperatorToken(null);
          localStorage.removeItem('lodgecore_pos_operator_token');
          setShowSwitchPad(true); 
        }}
        isOnline={true}
        syncPending={0}
      />

      {/* 2. Main Workspace */}
      <div className="flex flex-col flex-1 min-w-0 bg-slate-50">
        <PosContextBar
          outletName={sessionContext?.outlet?.name}
          drawerName={session?.user?.name || 'Main Drawer'}
          operatorName={activeOperator ? `${activeOperator.firstName} ${activeOperator.lastName}` : undefined}
          isOnline={true}
          syncPending={0}
        />

        {/* Dynamic Context Header (Search, Categories) */}
        {viewMode === 'menu' && (
          <div className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-0 shadow-sm">
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors ${
                    activeCategory === c.id
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="relative w-64 shrink-0 hidden md:block ml-4">
              <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto relative p-6">
          {viewMode === 'menu' ? (
            products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Utensils className="w-12 h-12 opacity-20 mb-4" />
                <p className="font-semibold text-slate-600">No products configured</p>
                <p className="text-sm mt-1">Add items from the Admin console.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProductTap(p)}
                    className="relative h-28 rounded-2xl border border-slate-200 bg-white flex flex-col items-center justify-center p-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200 active:scale-95 group"
                  >
                    <span className="font-semibold text-center leading-snug text-sm mb-1.5 text-slate-800 group-hover:text-indigo-700 transition-colors">{p.name}</span>
                    <span className="font-bold text-slate-500 text-xs group-hover:text-indigo-500">{formatCurrency(Number(p.price))}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white relative">
              <TableMap
                outletId={sessionContext?.outlet?.id || ''}
                onTableSelect={handleTableSelect}
                activeTableId={activeTableId}
                refreshTrigger={tableRefreshTrigger}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. The Cart Anchor */}
      <div className="flex flex-col w-[360px] bg-white border-l border-slate-200 shadow-2xl shrink-0 z-20">
        
        {/* Cart Context Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Order</span>
            <span className="text-lg font-black text-slate-800 tracking-tight">
              {activeTableName ? `Table ${activeTableName}` : 'Walk-in'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {cart.length > 0 && (
              <button
                onClick={() => setShowSplitModal(true)}
                title="Split Check"
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                <Scissors className="w-4 h-4" />
              </button>
            )}
            {currentOrderId && (
              <button
                onClick={() => { setCurrentOrderId(null); setCart([]); setActiveTableId(null); setActiveTableName(null); setTableRefreshTrigger(Date.now()); }}
                title="Clear Table"
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setCart([])}
              title="Clear Order"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Check Tabs */}
        {orderChecks.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 bg-white flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {orderChecks.map(check => (
              <button
                key={check.id}
                onClick={() => {
                  setActiveCheckId(check.id);
                  setCart(check.items.map((i: any) => ({
                    id: i.id,
                    productId: i.productId,
                    name: i.productName,
                    price: Number(i.unitPrice),
                    quantity: i.quantity,
                    taxRate: Number(i.taxRate),
                    kitchenStatus: i.kitchenStatus,
                    modifiers: i.modifiers || [],
                  })));
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${
                  activeCheckId === check.id
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-105'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Check {check.checkNumber.split('-').pop()} {check.status === 'PAID' ? '✓' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Quick Actions / Guest Count */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guests</span>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button onClick={() => setGuestCount((g) => Math.max(1, g - 1))} className="w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-xs font-bold text-slate-700">{guestCount}</span>
              <button onClick={() => setGuestCount((g) => g + 1)} className="w-7 h-7 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="group flex flex-col gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-slate-800 text-sm leading-tight block">{item.name}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <span className="text-xs font-medium text-slate-400 mt-1 block">
                        + {item.modifiers.map((m) => m.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 shrink-0">
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors mt-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
              <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">{formatCurrency(item.price)} each</span>
                    {/* Station badge */}
                    {item.station && (
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        item.station === 'KITCHEN' ? 'bg-red-50 text-red-500' :
                        item.station === 'BAR'     ? 'bg-blue-50 text-blue-500' :
                        item.station === 'DIRECT'  ? 'bg-green-50 text-green-600' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {item.station === 'KITCHEN' ? '🔥' : item.station === 'BAR' ? '🍺' : item.station === 'DIRECT' ? '⚡' : '📦'} {item.station}
                      </span>
                    )}
                    {item.fired && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">SENT</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                    <button onClick={() => updateQuantity(item.id, -1)} disabled={item.fired} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-slate-500 transition-all disabled:opacity-30">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-xs text-slate-700">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} disabled={item.fired} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-indigo-600 transition-all disabled:opacity-30">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {item.kitchenStatus && item.kitchenStatus !== 'PENDING' && (
                  <span className="self-start text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md mt-1">
                    {item.kitchenStatus}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Action Buttons — state-machine driven */}
        <div className="p-5 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span>Tax</span><span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
              <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Total</span>
              <span className="font-black text-2xl text-slate-900 tracking-tight">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* STATE A: Cart has items, no active order → show SEND ORDER */}
          {!currentOrderId && cart.length > 0 && (
            <Button
              className="w-full h-14 font-black text-base tracking-wide bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              onClick={handleSendOrder}
              disabled={isProcessing}
            >
              <Send className="w-5 h-5 mr-2" />
              {isProcessing ? 'SENDING...' : 'SEND ORDER'}
            </Button>
          )}

          {/* STATE B: Active order exists → show FIRE MORE + CHARGE */}
          {currentOrderId && (
            <div className="flex flex-col gap-2">
              {/* Fire More — only if new unfired items in cart */}
              {cart.some((i) => !i.fired) && (
                <Button
                  className="w-full h-12 font-black text-sm tracking-wide bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md"
                  onClick={handleFireMore}
                  disabled={isProcessing}
                >
                  <Flame className="w-4 h-4 mr-2" />
                  {isProcessing ? 'FIRING...' : `FIRE ${cart.filter(i => !i.fired).length} MORE ITEM(S)`}
                </Button>
              )}
              {/* Charge — always available when order exists */}
              <Button
                className="w-full h-14 font-black text-lg tracking-wide bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                onClick={() => setShowChargeModal(true)}
                disabled={isProcessing}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                CHARGE {formatCurrency(total)}
              </Button>
            </div>
          )}

          {/* STATE C: Empty cart, no order → hint */}
          {!currentOrderId && cart.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-2">Select a table and add items to begin</div>
          )}
        </div>
      </div>

      {/* Charge Modal */}
      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="w-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-slate-900 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Charge</p>
                  <p className="text-lg font-black">{activeTableName ? `Table ${activeTableName}` : 'Walk-in'}</p>
                </div>
                <button onClick={() => setShowChargeModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-sm text-slate-500"><span>Tax</span><span>{formatCurrency(tax)}</span></div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="font-bold text-slate-800">TOTAL</span>
                  <span className="font-black text-2xl text-slate-900">{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button className="h-12 font-bold text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-none" onClick={() => handleCharge('CASH')} disabled={isProcessing}>
                  <Banknote className="w-4 h-4 mr-2" />Cash
                </Button>
                <Button className="h-12 font-bold text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-none" onClick={() => handleCharge('CARD')} disabled={isProcessing}>
                  <CreditCard className="w-4 h-4 mr-2" />Card
                </Button>
                <Button className="h-12 font-bold text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 shadow-none" onClick={() => handleCharge('BANK_TRANSFER')} disabled={isProcessing}>
                  <Building2 className="w-4 h-4 mr-2" />Transfer
                </Button>
                <Button className="h-12 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-none" onClick={() => handleCharge('ROOM_CHARGE')} disabled={isProcessing}>
                  <User className="w-4 h-4 mr-2" />Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modals & Overlays ════════════════════════════════════════ */}

      {/* Staff Switch */}
      <StaffSwitchPad
        isOpen={!activeOperator || showSwitchPad}
        cancellable={!!activeOperator}
        outletId={sessionContext?.outlet?.id}
        onCancel={() => setShowSwitchPad(false)}
        onAuthenticated={(operator, token) => {
          setActiveOperator(operator);
          if (token) {
            setOperatorToken(token);
            localStorage.setItem('lodgecore_pos_operator_token', token);
          }
          setShowSwitchPad(false);
        }}
      />

      {/* Modifier Selection */}
      <ModifierSelectionModal
        isOpen={!!modifierTarget}
        onClose={() => setModifierTarget(null)}
        product={modifierTarget}
        onConfirm={handleModifierConfirm}
      />

      {/* Check Split */}
      {currentOrderId && (
        <CheckSplitModal
          isOpen={showSplitModal}
          onClose={() => setShowSplitModal(false)}
          orderId={currentOrderId}
          items={cart}
          userId={(session?.user as any)?.id || ''}
          onSplitComplete={() => {
            toast.success('Check split successfully');
            if (activeTableId && currentOrderId) {
              handleTableSelect({ id: activeTableId, name: activeTableName, currentOrderId });
            }
          }}
        />
      )}

      {/* My Sales */}
      {activeOperator && operatorToken && (
        <MySalesModal
          isOpen={showMySales}
          onClose={() => setShowMySales(false)}
          operatorToken={operatorToken}
          staffName={`${activeOperator.firstName} ${activeOperator.lastName}`}
        />
      )}

      {/* My Orders */}
      {activeOperator && operatorToken && (
        <MyOrdersModal
          isOpen={showMyOrders}
          onClose={() => setShowMyOrders(false)}
          operatorToken={operatorToken}
          staffName={`${activeOperator.firstName} ${activeOperator.lastName}`}
        />
      )}
    </div>
  );
}
