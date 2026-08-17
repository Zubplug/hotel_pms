'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Search, Trash2, Plus, Minus, User, Utensils,
  Loader2, CreditCard, Banknote, RefreshCw, LayoutGrid, MapPin,
  ChefHat, Scissors, X, Pause,
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
  const [showKitchen, setShowKitchen] = useState(false);

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

    setCart((prev) => {
      // Only merge if no modifiers selected (to allow duplicate rows with different mods)
      if (modifiers.length === 0) {
        const existing = prev.find(
          (i) => i.productId === product.id && (!i.modifiers || i.modifiers.length === 0)
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
          modifiers,
        },
      ];
    });
  }, []);

  const handleProductTap = (product: any) => {
    // If product has modifiers we open the selector; otherwise add directly
    setModifierTarget(product);
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
  // KOT — Fire to Kitchen
  // ─────────────────────────────────────────────────────────────────
  const handleFireKot = async (itemIds: string[]) => {
    if (!operatorToken) { toast.error('No operator authenticated'); return; }
    if (!currentOrderId) {
      // Auto-save order first then fire
      toast.info('Order must be saved before firing to kitchen. Processing…');
      await handlePayment('OPEN'); // save as open order
    }
    try {
      const res = await provider.pos.fireKot(currentOrderId!, itemIds, operatorToken);
      if (res.error) throw new Error(res.error);
      // Mark items as SENT in local cart
      setCart((prev) =>
        prev.map((item) =>
          itemIds.includes(item.id) ? { ...item, kitchenStatus: 'SENT' } : item
        )
      );
      toast.success(`${itemIds.length} item(s) fired to kitchen 🔥`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fire KOT');
    }
  };

  const handleHoldOrder = async () => {
    if (!currentOrderId) {
      toast.error('Please save the order first (e.g., fire a KOT)');
      return;
    }
    try {
      const res = await provider.pos.updateOrderStatus(currentOrderId, 'HELD', 'User put order on hold');
      if (res.error) throw new Error(res.error);
      toast.success('Order held successfully');
      setCart([]);
      setCurrentOrderId(null);
      setActiveTableId(null);
      setActiveTableName('');
      setViewMode('tables');
      setTableRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to hold order');
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

  // ─────────────────────────────────────────────────────────────────
  // Payment / order creation
  // ─────────────────────────────────────────────────────────────────
  const handlePayment = async (method: string) => {
    if (cart.length === 0 && method !== 'OPEN') return;
    setIsProcessing(true);

    const orderData = {
      propertyId,
      outletId: sessionContext?.outlet?.id,
      sessionId: (session as any)?.sessionId || localStorage.getItem('lodgecore_pos_session_id'),
      tableId: activeTableId,
      tableNumber: activeTableName,
      guestCount,
      serverStaffId: activeOperator?.id,
      status: method === 'OPEN' ? 'OPEN' : 'PAID',
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
      payments:
        method !== 'OPEN'
          ? [{ method, amount: total, currency: 'NGN', status: 'CONFIRMED' }]
          : [],
    };

    try {
      if (currentOrderId && method !== 'OPEN') {
        const paymentData = { method, amount: total, currency: 'NGN', checkId: activeCheckId };
        if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
          (window as any).chrome.webview.postMessage({
            command: 'pos.payOrder',
            payload: JSON.stringify({ orderId: currentOrderId, paymentData: JSON.stringify(paymentData) }),
          });
          (window as any).chrome.webview.postMessage({
            command: 'PrintReceipt',
            payload: JSON.stringify({ items: cart, total }),
          });
        } else if (operatorToken) {
          const res = await provider.pos.payOrder(currentOrderId, paymentData, operatorToken);
          if (res.error) throw new Error(res.error);
        }
      } else {
        // Desktop IPC path
        if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
          (window as any).chrome.webview.postMessage({
            command: 'CreatePosOrder',
            payload: JSON.stringify(orderData),
          });
          if (method !== 'OPEN') {
            (window as any).chrome.webview.postMessage({
              command: 'PrintReceipt',
              payload: JSON.stringify({ items: cart, total }),
            });
          }
        } else if (operatorToken) {
          // Web / online path
          const res = await provider.pos.createOrder(orderData, operatorToken);
          if (res.error) throw new Error(res.error);
          if (res.data?.id) setCurrentOrderId(res.data.id);
        }
      }

      if (method !== 'OPEN') {
        setCart([]);
        setActiveTableId(null);
        setActiveTableName(null);
        setCurrentOrderId(null);
        setActiveCheckId(null);
        setOrderChecks([]);
      }
      
      setTableRefreshTrigger(Date.now());
      toast.success(method === 'OPEN' ? 'Order saved!' : `Payment of ${formatCurrency(total)} processed via ${method}`);
    } catch (err: any) {
      toast.error(err.message || 'Order failed');
    } finally {
      setIsProcessing(false);
    }
  };

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
        onOpenKitchen={() => setShowKitchen(true)}
        onLock={() => { setActiveOperator(null); setShowSwitchPad(true); }}
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
                onClick={handleHoldOrder}
                title="Hold Order"
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
              >
                <Pause className="w-4 h-4" />
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
                  <span className="text-xs font-medium text-slate-400">{formatCurrency(item.price)} each</span>
                  <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-slate-500 transition-all">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-bold text-xs text-slate-700">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:shadow-sm text-indigo-600 transition-all">
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

        {/* Totals & Actions */}
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

          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 font-bold text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-none border-none"
              onClick={() => handlePayment('ROOM_CHARGE')}
              disabled={cart.length === 0 || isProcessing}
            >
              <User className="w-4 h-4 mr-2" />Room
            </Button>
            <Button
              className="h-12 font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-none border-none"
              onClick={() => handlePayment('CARD')}
              disabled={cart.length === 0 || isProcessing}
            >
              <CreditCard className="w-4 h-4 mr-2" />Card
            </Button>
            <Button
              className="col-span-2 h-14 font-black text-lg tracking-wide bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              onClick={() => handlePayment('CASH')}
              disabled={cart.length === 0 || isProcessing}
            >
              <Banknote className="w-5 h-5 mr-2" />
              {isProcessing ? 'PROCESSING...' : `PAY ${formatCurrency(total)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Floating Kitchen Panel (KOT) Drawer */}
      {showKitchen && (
        <div className="absolute inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm transition-all">
          <div className="w-[400px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200">
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-slate-50">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-indigo-600" /> Kitchen Tickets
              </span>
              <button onClick={() => setShowKitchen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <KotPanel items={cart} onFire={handleFireKot} isDisabled={!activeOperator} />
            </div>
          </div>
        </div>
      )}

      {/* ══ Modals & Overlays ════════════════════════════════════════ */}

      {/* Staff Switch */}
      <StaffSwitchPad
        isOpen={!activeOperator || showSwitchPad}
        cancellable={!!activeOperator}
        onCancel={() => setShowSwitchPad(false)}
        onAuthenticated={(operator, token) => {
          setActiveOperator(operator);
          if (token) setOperatorToken(token);
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
