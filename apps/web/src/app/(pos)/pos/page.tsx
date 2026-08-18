'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Search, Trash2, Plus, Minus, User, Utensils,
  Loader2, CreditCard, Banknote, LayoutGrid,
  ChefHat, Scissors, X, Building2, Send, Flame, Lock,
  Sparkles, Star, Package2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppSwitcher } from '@/components/layout/AppSwitcher';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { formatCurrency } from '@/lib/utils';
import { StaffSwitchPad } from '@/components/pos/StaffSwitchPad';
import { MySalesModal } from '@/components/pos/MySalesModal';
import { MyOrdersModal } from '@/components/pos/MyOrdersModal';
import { ActiveOrdersModal } from '@/components/pos/ActiveOrdersModal';
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
  const [posSessionId, setPosSessionId] = useState<string>('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [orderChecks, setOrderChecks] = useState<any[]>([]);

  // ── Operator ──────────────────────────────────────────────────────
  const [activeOperator, setActiveOperator] = useState<any | null>(null);
  const [operatorToken, setOperatorToken] = useState<string | null>(null);
  const [showSwitchPad, setShowSwitchPad] = useState(false);
  const [showMySales, setShowMySales] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [activeOrderType, setActiveOrderType] = useState<string>('TABLE');
  const [activeDisplayName, setActiveDisplayName] = useState<string>('');

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
        if (activeSessionId) setPosSessionId(activeSessionId);

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
    const modifierTotal = modifiers.reduce((s, m) => s + Number(m.price || 0), 0);
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
  const loadOrderContext = (order: any, isTableFlow = false) => {
    setCurrentOrderId(order.id);
    setActiveOrderType(order.orderType || (isTableFlow ? 'TABLE' : 'WALK_IN'));
    setActiveDisplayName(order.displayName || '');
    if (order.tableId) {
      setActiveTableId(order.tableId);
      setActiveTableName(order.tableNumber || '');
    } else if (!isTableFlow) {
      setActiveTableId(null);
      setActiveTableName(null);
    }
    
    const checks = order.checks || [];
    setOrderChecks(checks);
    
    let itemsToLoad = order.items;
    if (checks.length > 0) {
      const openCheck = checks.find((c: any) => c.status === 'OPEN') || checks[0];
      setActiveCheckId(openCheck.id);
      itemsToLoad = openCheck.items;
      if (isTableFlow) toast.info(`Table ${order.tableNumber} — loaded check ${openCheck.checkNumber}`);
    } else {
      setActiveCheckId(null);
      if (isTableFlow) toast.info(`Table ${order.tableNumber} — existing order loaded`);
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
      fired: true, // Mark existing items as fired so they cannot be edited/sent again
    })));
  };

  const handleOrderResume = (order: any) => {
    setViewMode('menu');
    loadOrderContext(order, false);
    toast.success(`Resumed Order ${order.orderNumber}`);
  };

  const handleTableSelect = async (table: any) => {
    setViewMode('menu');
    if (table.currentOrderId) {
      try {
        const res = await provider.pos.getOrder(table.currentOrderId);
        if (res.data) {
          loadOrderContext(res.data, true);
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
      setActiveTableId(table.id);
      setActiveTableName(table.name);
      setActiveOrderType('TABLE');
      setActiveDisplayName('');
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
        orderType: activeOrderType,
        displayName: activeDisplayName,
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

  // Product image gradient — deterministic by name
  const getProductGradient = (name: string) => {
    const gradients = [
      'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
      'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
    ];
    const code = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return gradients[code % gradients.length];
  };

  const getProductEmoji = (name: string, category?: string) => {
    const n = (name + (category || '')).toLowerCase();
    if (n.includes('burger') || n.includes('beef'))  return '🍔';
    if (n.includes('pizza'))                          return '🍕';
    if (n.includes('pasta') || n.includes('spaghetti')) return '🍝';
    if (n.includes('chicken'))                        return '🍗';
    if (n.includes('fish') || n.includes('salmon') || n.includes('sea')) return '🐟';
    if (n.includes('salad'))                          return '🥗';
    if (n.includes('soup'))                           return '🍜';
    if (n.includes('steak') || n.includes('grill'))  return '🥩';
    if (n.includes('rice'))                           return '🍚';
    if (n.includes('bread') || n.includes('sandwich') || n.includes('toast')) return '🥪';
    if (n.includes('cake') || n.includes('dessert') || n.includes('sweet')) return '🍰';
    if (n.includes('ice cream'))                      return '🍦';
    if (n.includes('coffee') || n.includes('espresso') || n.includes('latte')) return '☕';
    if (n.includes('tea'))                            return '🍵';
    if (n.includes('juice') || n.includes('smoothie')) return '🧃';
    if (n.includes('water'))                          return '💧';
    if (n.includes('beer') || n.includes('lager'))   return '🍺';
    if (n.includes('wine'))                           return '🍷';
    if (n.includes('cocktail') || n.includes('mojito')) return '🍹';
    if (n.includes('egg'))                            return '🍳';
    if (n.includes('wrap') || n.includes('taco'))    return '🌮';
    if (n.includes('shrimp') || n.includes('prawn')) return '🍤';
    if (n.includes('vegetab') || n.includes('veg'))  return '🥦';
    if (n.includes('fruit'))                          return '🍓';
    if (n.includes('snack') || n.includes('chip'))   return '🍟';
    return '🍽️';
  };

  // ─────────────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg bg-white border border-slate-200 animate-pulse">
            <Utensils className="w-10 h-10 text-indigo-500" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-slate-500 font-medium text-sm">Loading POS...</p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Main layout (Premium Redesign)
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden font-sans" style={{ background: '#f1f5f9' }}>
      
      {/* 1. Global Sidebar */}
      <PosSidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenMyOrders={() => setShowActiveOrders(true)}
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
      <div className="flex flex-col flex-1 min-w-0" style={{ background: '#f8fafc' }}>
        <PosContextBar
          outletName={sessionContext?.outlet?.name}
          drawerName={session?.user?.name || 'Main Drawer'}
          operatorName={activeOperator ? `${activeOperator.firstName} ${activeOperator.lastName}` : undefined}
          isOnline={true}
          syncPending={0}
        />

        {/* Category & Search Bar */}
        {viewMode === 'menu' && (
          <div className="bg-white border-b border-slate-200 flex items-center gap-4 px-5 py-3 shrink-0 shadow-sm">
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-200 ${
                  activeCategory === 'all'
                    ? 'text-white shadow-lg shadow-indigo-200 scale-105'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                }`}
                style={activeCategory === 'all' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : {}}
              >
                <Sparkles className="w-3 h-3" />
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-200 ${
                    activeCategory === c.id
                      ? 'text-white shadow-lg shadow-amber-200 scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                  style={activeCategory === c.id ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-56 shrink-0 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-xs font-medium text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto relative p-5">
          {viewMode === 'menu' ? (
            products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                  <Package2 className="w-10 h-10 text-slate-300" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-500">No products configured</p>
                  <p className="text-sm text-slate-400 mt-1">Add items from the Admin console.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredProducts.map((p) => {
                  const grad = getProductGradient(p.name);
                  const emoji = getProductEmoji(p.name, p.category?.name);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProductTap(p)}
                      className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-transparent active:scale-95 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {/* Image area */}
                      <div className="relative h-24 flex items-center justify-center overflow-hidden" style={{ background: grad }}>
                        <span className="text-4xl select-none transition-transform duration-200 group-hover:scale-110 drop-shadow-md">
                          {emoji}
                        </span>
                        {/* Shine overlay on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-white transition-opacity duration-200" />
                      </div>

                      {/* Info area */}
                      <div className="p-3 pb-3.5 flex flex-col items-center text-center">
                        <p className="font-bold text-slate-800 text-xs leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">{p.name}</p>
                        <div className="flex items-center justify-center mt-2 relative w-full h-6">
                          <p className="font-black text-sm text-slate-900 absolute">{formatCurrency(Number(p.price))}</p>
                          <div className="absolute right-0 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md" style={{ background: grad }}>
                            <Plus className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
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
      {/* 3. The Cart Anchor */}
      <div className="flex flex-col w-[400px] shrink-0 z-20 bg-white border-l border-slate-200 shadow-2xl">

        {/* Cart Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                {currentOrderId ? 'Active Order' : 'New Order'}
              </span>
              <span className="text-xl font-black text-slate-800 tracking-tight mt-0.5">
                {activeOrderType === 'TABLE'
                  ? (activeTableName ? `Table ${activeTableName}` : 'Select Table')
                  : (activeDisplayName || activeOrderType.replace('_', ' '))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowActiveOrders(true)}
                title="Active Orders"
                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Orders
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Guest counter */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Guests</span>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                <button onClick={() => setGuestCount((g) => Math.max(1, g - 1))} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-black text-slate-700">{guestCount}</span>
                <button onClick={() => setGuestCount((g) => g + 1)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            {/* Action icons */}
            <div className="flex items-center gap-1">
              {cart.length > 0 && (
                <button onClick={() => setShowSplitModal(true)} title="Split Check" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                  <Scissors className="w-4 h-4" />
                </button>
              )}
              {currentOrderId && (
                <button onClick={() => { setCurrentOrderId(null); setCart([]); setActiveTableId(null); setActiveTableName(null); setActiveOrderType('TABLE'); setActiveDisplayName(''); setTableRefreshTrigger(Date.now()); }} title="Clear Context" className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                  <Lock className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setCart([])} title="Clear Order" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Check Tabs */}
        {orderChecks.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto bg-white" style={{ scrollbarWidth: 'none' }}>
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
                className={`px-4 py-1.5 text-xs font-bold rounded-xl border transition-all whitespace-nowrap ${
                  activeCheckId === check.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Check {check.checkNumber.split('-').pop()} {check.status === 'PAID' ? '✓' : ''}
              </button>
            ))}
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-16">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-400">No items yet</p>
                <p className="text-xs text-slate-300 mt-1">Tap menu items to add them</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">

              {/* ALREADY SENT SECTION */}
              {cart.filter(item => item.fired).length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Already Sent</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  {cart.filter(item => item.fired).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-500 text-sm truncate">{item.name}</p>
                        {item.modifiers?.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">+ {item.modifiers.map((m: any) => m.name).join(', ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400 font-bold">×{item.quantity}</span>
                        <span className="text-xs font-bold text-slate-500">{formatCurrency(item.price * item.quantity)}</span>
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">SENT</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* NEW ITEMS SECTION */}
              {cart.filter(item => !item.fired).length > 0 && (
                <div className="flex flex-col gap-2">
                  {cart.some(item => item.fired) && (
                    <div className="flex items-center gap-2 mb-1 mt-2">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">New Items</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                  )}
                  {cart.filter(item => !item.fired).map((item) => (
                    <div key={item.id} className="group p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Emoji avatar */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg bg-slate-50 border border-slate-100">
                          {getProductEmoji(item.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-slate-800 text-sm leading-snug">{item.name}</p>
                            <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 mt-0.5">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {item.modifiers?.length > 0 && (
                            <p className="text-[10px] text-slate-500 mt-0.5">+ {item.modifiers.map((m: any) => m.name).join(', ')}</p>
                          )}
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-xs font-bold text-slate-400">{formatCurrency(item.price)} each</span>
                            <div className="flex items-center gap-2">
                              {/* Station badge */}
                              {item.station && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                  item.station === 'KITCHEN' ? 'bg-rose-50 text-rose-600' :
                                  item.station === 'BAR'     ? 'bg-blue-50 text-blue-600' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {item.station === 'KITCHEN' ? '🔥' : item.station === 'BAR' ? '🍺' : '⚡'}
                                </span>
                              )}
                              {/* Qty stepper */}
                              <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg p-0.5">
                                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-black text-slate-700">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded text-indigo-600 hover:bg-white hover:shadow-sm transition-all">
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-sm font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Totals + Actions */}
        <div className="p-5 border-t border-slate-100 bg-white shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          {/* Totals */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>Tax</span><span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-[0.15em]">Total</span>
              <span className="font-black text-3xl text-slate-900 tracking-tight">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* STATE A: Cart has items, no active order → SEND ORDER */}
          {!currentOrderId && cart.length > 0 && (
            <button
              className="w-full h-14 font-black text-base tracking-wide text-white rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
              style={{ boxShadow: '0 8px 24px rgba(79,70,229,0.25)' }}
              onClick={handleSendOrder}
              disabled={isProcessing}
            >
              <Send className="w-5 h-5" />
              {isProcessing ? 'SENDING...' : 'SEND ORDER'}
            </button>
          )}

          {/* STATE B: Active order → FIRE MORE + CHARGE */}
          {currentOrderId && (
            <div className="flex flex-col gap-2">
              {cart.some((i) => !i.fired) && (
                <button
                  className="w-full h-12 font-black text-sm tracking-wide text-white rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 shadow-md"
                  onClick={handleFireMore}
                  disabled={isProcessing}
                >
                  <Flame className="w-4 h-4" />
                  {isProcessing ? 'FIRING...' : `FIRE ${cart.filter(i => !i.fired).length} MORE ITEM(S)`}
                </button>
              )}
              <button
                className="w-full h-14 font-black text-lg tracking-wide text-white rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800"
                onClick={() => setShowChargeModal(true)}
                disabled={isProcessing}
              >
                <CreditCard className="w-5 h-5" />
                CHARGE {formatCurrency(total)}
              </button>
            </div>
          )}

          {/* STATE C: Empty, no order → hint */}
          {!currentOrderId && cart.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-3 font-medium">Select items to start an order</div>
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
      <ActiveOrdersModal
        isOpen={showActiveOrders}
        onClose={() => setShowActiveOrders(false)}
        operatorToken={operatorToken || ''}
        sessionId={posSessionId}
        staffName={activeOperator ? `${activeOperator.firstName || ''} ${activeOperator.lastName || ''}`.trim() : ''}
        onOrderSelect={handleOrderResume}
        onViewHistory={() => setShowMyOrders(true)}
      />
    </div>
  );
}
