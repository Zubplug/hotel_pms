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
  // Main layout
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ══ LEFT: Products / Table Map ══════════════════════════════ */}
      <div className="flex flex-col flex-[7] bg-slate-50 border-r border-slate-200 min-w-0">

        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AppSwitcher />
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold ml-1">
              L
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800 hidden md:block">LodgeCore POS</h1>
            {sessionContext?.outlet && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                {sessionContext.outlet.name}
              </span>
            )}
            {activeTableName && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                <MapPin className="w-3 h-3" />
                {activeTableName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('menu')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'menu' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Menu
              </button>
              <button
                onClick={() => setViewMode('tables')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'tables' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MapPin className="w-4 h-4" />
                Tables
              </button>
            </div>

            {/* Operator info */}
            <div className="hidden md:flex flex-col items-end border-l border-slate-200 pl-3">
              <span className="text-xs text-slate-500">Session: {session?.user?.name || '...'}</span>
              {activeOperator && (
                <span className="text-xs font-bold text-indigo-700">
                  Operator: {activeOperator.firstName} {activeOperator.lastName}
                </span>
              )}
            </div>

            {activeOperator && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowMyOrders(true)}
                  className="px-2 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold"
                >
                  My Orders
                </button>
                <button
                  onClick={() => setShowMySales(true)}
                  className="px-2 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold"
                >
                  My Sales
                </button>
                <button
                  onClick={() => setShowSwitchPad(true)}
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-semibold">{activeOperator.firstName}</span>
                  <RefreshCw className="w-3 h-3 opacity-50" />
                </button>
              </div>
            )}

            {/* Search */}
            {viewMode === 'menu' && (
              <div className="relative w-48 md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-full bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Menu View ── */}
        {viewMode === 'menu' && (
          <>
            {/* Categories */}
            <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-slate-200 shrink-0" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                    activeCategory === c.id
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Utensils className="w-12 h-12 opacity-20 mb-4" />
                  <p className="font-medium">No products configured</p>
                  <p className="text-sm mt-1">Add items from the Admin console.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProductTap(p)}
                      className="relative h-28 rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-3 transition-transform active:scale-95 shadow-sm bg-white hover:bg-slate-50 hover:border-indigo-200 hover:shadow-md"
                    >
                      <span className="font-semibold text-center leading-tight text-sm mb-1.5 text-slate-800">{p.name}</span>
                      <span className="font-bold text-indigo-700 text-sm">{formatCurrency(Number(p.price))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Table Map View ── */}
        {viewMode === 'tables' && (
          <div className="flex-1 overflow-hidden">
            <TableMap
              outletId={sessionContext?.outlet?.id || ''}
              onTableSelect={handleTableSelect}
              activeTableId={activeTableId}
              refreshTrigger={tableRefreshTrigger}
            />
          </div>
        )}
      </div>

      {/* ══ MIDDLE: Cart ════════════════════════════════════════════ */}
      <div className="flex flex-col w-72 xl:w-80 bg-white border-r border-slate-200 shrink-0">

        {/* Cart header */}
        <div className="flex flex-col border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="h-14 flex items-center justify-between px-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" />
              {activeTableName ? `Table ${activeTableName}` : 'Current Order'}
            </div>
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <button
                  onClick={() => setShowSplitModal(true)}
                  title="Split check"
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Scissors className="w-4 h-4" />
                </button>
              )}
              {currentOrderId && (
                <button
                  onClick={handleHoldOrder}
                  title="Hold order"
                  className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setCart([])}
                title="Clear order"
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {orderChecks.length > 0 && (
            <div className="px-2 pb-2 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border whitespace-nowrap ${
                    activeCheckId === check.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {check.checkNumber.split('-').pop()} {check.status === 'PAID' ? '✓' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Guest count */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">Guests</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
              className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-bold w-4 text-center">{guestCount}</span>
            <button
              onClick={() => setGuestCount((g) => g + 1)}
              className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center hover:bg-slate-200"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Attach to room */}
        <div className="px-4 py-2 border-b border-slate-100 shrink-0">
          <button className="w-full flex items-center justify-between p-2.5 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 transition-colors">
            <div className="flex items-center gap-2 text-xs font-medium">
              <User className="w-3.5 h-3.5" />
              Attach to Room / Guest
            </div>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <ShoppingCart className="w-10 h-10 opacity-20" />
              <p className="text-sm">Order is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 text-sm block truncate">{item.name}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <span className="text-xs text-slate-400">
                        + {item.modifiers.map((m) => m.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-0.5 text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{formatCurrency(item.price)} each</span>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center font-semibold text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {/* Kitchen status badge */}
                {item.kitchenStatus && item.kitchenStatus !== 'PENDING' && (
                  <span className="self-start text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {item.kitchenStatus}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment */}
        <div className="bg-slate-50 px-4 py-4 border-t border-slate-200 shrink-0">
          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Tax</span><span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
              <span className="font-semibold text-slate-800 text-sm">Total</span>
              <span className="font-bold text-xl text-indigo-700">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="h-11 font-semibold text-sm"
              onClick={() => handlePayment('ROOM_CHARGE')}
              disabled={cart.length === 0 || isProcessing}
            >
              <User className="w-4 h-4 mr-1.5" />Room
            </Button>
            <Button
              className="h-11 font-semibold text-sm"
              variant="outline"
              onClick={() => handlePayment('CARD')}
              disabled={cart.length === 0 || isProcessing}
            >
              <CreditCard className="w-4 h-4 mr-1.5" />Card
            </Button>
            <Button
              className="col-span-2 h-12 font-bold text-base bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handlePayment('CASH')}
              disabled={cart.length === 0 || isProcessing}
            >
              <Banknote className="w-5 h-5 mr-2" />
              {isProcessing ? 'Processing…' : `Pay ${formatCurrency(total)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* ══ RIGHT: KOT Panel ════════════════════════════════════════ */}
      <div className="flex flex-col w-56 xl:w-64 shrink-0">
        <KotPanel
          items={cart}
          onFire={handleFireKot}
          isDisabled={!activeOperator}
        />
      </div>

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
