'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
import { OperatorSelectionScreen } from '@/components/pos/OperatorSelectionScreen';
import { MyShiftBankModal } from '@/components/pos/MyShiftBankModal';
import { EmergencyCashBankModal } from '@/components/pos/EmergencyCashBankModal';
import { AutoLockScreen } from '@/components/pos/AutoLockScreen';
import { CategoryTileGrid } from '@/components/pos/CategoryTileGrid';
import { ProductCardStepper } from '@/components/pos/ProductCardStepper';
import { PosStaffStrip } from '@/components/pos/PosStaffStrip';
import { ChargeModal } from '@/components/pos/ChargeModal';
import { MySalesModal } from '@/components/pos/MySalesModal';
import { MyOrdersModal } from '@/components/pos/MyOrdersModal';
import { ActiveOrdersModal } from '@/components/pos/ActiveOrdersModal';
import { TableMap } from '@/components/pos/TableMap';
import { ModifierSelectionModal } from '@/components/pos/ModifierSelectionModal';
import { CheckSplitModal } from '@/components/pos/CheckSplitModal';
import { KotPanel } from '@/components/pos/KotPanel';
import { PosSidebar } from '@/components/pos/PosSidebar';
import { StaffSwitchPad } from '@/components/pos/StaffSwitchPad';
import { usePosOnlineStatus } from '@/lib/pos/usePosOnlineStatus';
import { useLicenseGuard } from '@/lib/pos/useLicenseGuard';
import { OfflineSyncQueue } from '@/lib/pos/OfflineSyncQueue';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type OrderItemModifier = { id: string; name: string; price: number };

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;    // total quantity (firedQty + pendingQty)
  firedQty: number;   // how many have been sent to kitchen
  pendingQty: number; // how many are still unsent
  taxRate: number;
  course?: number;
  kitchenStatus?: string;
  station?: string; // KITCHEN | BAR | DIRECT | NONE
  fired?: boolean;  // true when firedQty === quantity (fully sent)
  modifiers?: OrderItemModifier[];
};

type ViewMode = 'menu' | 'tables';

export default function PosApp() {
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
  const [showShiftBank, setShowShiftBank] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [activeOrderType, setActiveOrderType] = useState<string>('TABLE');
  const [activeDisplayName, setActiveDisplayName] = useState<string>('');

  // ── Modals ────────────────────────────────────────────────────────
  const [modifierTarget, setModifierTarget] = useState<any | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);

  // ── Orders ────────────────────────────────────────────────────────
  const [myActiveOrders, setMyActiveOrders] = useState<any[]>([]);

  const refreshActiveOrders = useCallback(async () => {
    if (!posSessionId || !operatorToken) return;
    try {
      const res = await provider.pos.getActiveOrders(posSessionId, operatorToken, 'my_orders');
      if (!res.error && res.data) {
        setMyActiveOrders(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch active orders', err);
    }
  }, [posSessionId, operatorToken, provider.pos]);

  // ── Audit & Resilience hooks ──────────────────────────────────────
  const { isOnline, syncPending } = usePosOnlineStatus({ onBackOnline: refreshActiveOrders });
  const { isExpired, isRevoked, restrictedMode } = useLicenseGuard({ sessionContext });


  useEffect(() => {
    refreshActiveOrders();
    // Poll every 15 seconds
    const interval = setInterval(refreshActiveOrders, 15000);
    return () => clearInterval(interval);
  }, [refreshActiveOrders]);

  useEffect(() => {
    if (tableRefreshTrigger) {
      refreshActiveOrders();
    }
  }, [tableRefreshTrigger, refreshActiveOrders]);

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
            const contextRes = await provider.pos.getSessionContext(activeSessionId);
            if (!contextRes.error && contextRes.data) {
              setSessionContext(contextRes.data);
            } else {
              // The cash bank doesn't exist anymore, but we don't kick them out of the POS.
              // Just clear the cash bank ID.
              localStorage.removeItem('lodgecore_pos_session_id');
              setPosSessionId('');
            }
          } catch {
            console.error('Failed to load POS cash bank context');
          }
        }
        
        const savedToken = localStorage.getItem('lodgecore_pos_operator_token');
        if (savedToken) {
           try {
             // Fetch operator independently of the cash bank
             const operatorRes = await provider.pos.getCurrentOperator(activeSessionId || '', savedToken);
             if (!operatorRes.error && operatorRes.data?.staff) {
               setActiveOperator(operatorRes.data.staff);
               setOperatorToken(savedToken);
             } else {
               // Token invalid, go to login
               router.push('/pos/operator-login');
             }
           } catch {
             console.error('Failed to load operator');
           }
        } else {
           router.push('/pos/operator-login');
        }
      } catch (err) {
        console.error('Failed to fetch POS data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [propertyId, provider, session]);

  // Redirect if no operator logged in (not cash drawer)
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const savedToken = localStorage.getItem('lodgecore_pos_operator_token');
      if (!savedToken) router.push('/pos/operator-login');
    }
  }, [sessionStatus, router]);

  // ─────────────────────────────────────────────────────────────────
  // Cart helpers
  // ─────────────────────────────────────────────────────────────────
  const addToCart = useCallback((product: any, modifiers: OrderItemModifier[] = []) => {
    const modifierTotal = modifiers.reduce((s, m) => s + Number(m.price || 0), 0);
    const effectivePrice = Number(product.price) + modifierTotal;
    const itemId = `${product.id}_${Date.now()}`;
    const station: string = product.resolvedStation || product.productionStation || 'KITCHEN';
    // Build a modifier key so Burger+Cheese is separate from plain Burger
    const modKey = modifiers.map(m => m.id).sort().join(',');

    setCart((prev) => {
      // Find any existing item for this product+modifier combo (fired or not)
      const existing = prev.find(
        (i) => i.productId === product.id &&
          (modKey === (i.modifiers ?? []).map((m: any) => m.id).sort().join(','))
      );
      if (existing) {
        // Merge — increase total quantity and pending qty
        return prev.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                pendingQty: (item.pendingQty ?? 0) + 1,
                fired: false, // has pending items now
              }
            : item
        );
      }
      // Brand new item
      return [
        ...prev,
        {
          id: itemId,
          productId: product.id,
          name: product.name,
          price: effectivePrice,
          quantity: 1,
          firedQty: 0,
          pendingQty: 1,
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

  const handleProductDecrement = (productId: string) => {
    setCart((prev) => {
      // Only decrement pending (unsent) qty — never reduce already-fired items
      const target = prev.find(
        (i) => i.productId === productId && (i.pendingQty ?? 0) > 0 && (!i.modifiers || i.modifiers.length === 0)
      );
      if (!target) return prev;

      const newPending = (target.pendingQty ?? 1) - 1;
      const newQty = target.quantity - 1;

      if (newQty <= 0) {
        return prev.filter((i) => i.id !== target.id);
      }
      return prev.map((item) =>
        item.id === target.id
          ? {
              ...item,
              quantity: newQty,
              pendingQty: newPending,
              fired: newPending === 0, // fully fired if nothing pending
            }
          : item
      );
    });
  };

  const handleModifierConfirm = (product: any, selectedModifiers: any[]) => {
    addToCart(product, selectedModifiers);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item;
          const minQty = item.firedQty ?? 0; // cannot remove already-fired items
          const newQty = Math.max(minQty, item.quantity + delta);
          const newPending = Math.max(0, newQty - minQty);
          return {
            ...item,
            quantity: newQty,
            pendingQty: newPending,
            fired: newPending === 0,
          };
        })
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

    setCart(itemsToLoad.map((i: any) => {
      const p = products.find(prod => prod.id === i.productId);
      return {
        id: i.id,
        productId: i.productId,
        name: i.productName,
        price: Number(i.unitPrice),
        quantity: i.quantity,
        firedQty: i.quantity,   // all loaded items are already sent
        pendingQty: 0,
        taxRate: Number(i.taxRate),
        kitchenStatus: i.kitchenStatus,
        station: p ? (p.resolvedStation || p.productionStation || 'KITCHEN') : 'KITCHEN',
        fired: true,
        modifiers: i.modifiers || [],
      };
    }));
  };

  const handleOrderResume = async (order: any) => {
    // If already active, do nothing
    if (order.id === currentOrderId) return;

    try {
      // Fetch the full order (includes items, checks, modifiers)
      const res = await provider.pos.getOrder(order.id);
      if (res.error || !res.data) {
        toast.error('Could not load order details');
        return;
      }
      const fullOrder = res.data;
      setViewMode('menu');
      loadOrderContext(fullOrder, false);
      toast.success(`Resumed ${fullOrder.tableNumber ? `Table ${fullOrder.tableNumber}` : fullOrder.orderNumber}`);
    } catch (err: any) {
      toast.error('Failed to resume order');
    }
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
          quantity: item.pendingQty ?? item.quantity, // only fire pending qty
          unitPrice: item.price,
          taxRate: item.taxRate,
          taxAmount: item.price * (item.pendingQty ?? item.quantity) * (item.taxRate / 100),
          total: item.price * (item.pendingQty ?? item.quantity),
          kitchenStatus: item.kitchenStatus,
          modifiers: item.modifiers ?? [],
        })),
        payments: [],
      };
      const res = await provider.pos.createOrder(orderData, operatorToken);
      if (res.error) throw new Error(res.error);
      const orderId = res.data?.id;
      if (orderId) setCurrentOrderId(orderId);
      // Mark all items as fully fired — firedQty = total quantity, pendingQty = 0
      setCart((prev) => prev.map((i) => ({ ...i, fired: true, firedQty: i.quantity, pendingQty: 0 })));
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
    // Only fire items that have a pending (unsent) qty
    const itemsToFire = cart.filter((i) => (i.pendingQty ?? 0) > 0);
    if (itemsToFire.length === 0) { toast.error('No new items to fire'); return; }
    setIsProcessing(true);
    try {
      const res = await provider.pos.fireItems(currentOrderId, itemsToFire.map((item) => ({
        productId: item.productId,
        productName: item.name,
        quantity: item.pendingQty!, // only fire the pending delta
        unitPrice: item.price,
        taxRate: item.taxRate,
        taxAmount: item.price * item.pendingQty! * (item.taxRate / 100),
        total: item.price * item.pendingQty!,
        modifiers: item.modifiers ?? [],
      })), operatorToken);
      if (res.error) throw new Error(res.error);
      // After firing: firedQty = total quantity, pendingQty = 0 for all items
      setCart((prev) => prev.map((i) => ({ ...i, fired: true, firedQty: i.quantity, pendingQty: 0 })));
      setTableRefreshTrigger(Date.now());
      const batchCount = res.data?.newBatches?.length ?? 0;
      toast.success(`${itemsToFire.length} item(s) fired! ${batchCount > 0 ? `${batchCount} ticket(s) sent 🔥` : ''}`);
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
      <div className="flex h-full w-full items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' }}>
        <div className="flex flex-col items-center gap-8">
          {/* Logo mark */}
          <div className="relative">
            <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
              <Image
                src="/lodgecore-logo.png"
                alt="LodgeCore"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-white/30 animate-ping" style={{ animationDuration: '2s' }} />
          </div>

          {/* Brand name */}
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-3xl font-black text-white tracking-tight">LodgeCore</h1>
            <span className="text-indigo-300 font-bold text-sm uppercase tracking-widest">POS Terminal</span>
          </div>

          {/* Loading bar */}
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
          <p className="text-white/50 text-xs font-medium tracking-wide">Initialising terminal...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Main layout (Premium Redesign)
  // ─────────────────────────────────────────────────────────────────
  return (
    <AutoLockScreen
      isLocked={!activeOperator || showSwitchPad}
      onLock={() => {
        setActiveOperator(null);
        setOperatorToken(null);
        localStorage.removeItem('lodgecore_pos_operator_token');
        setShowSwitchPad(true);
      }}
    >
      <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800 font-sans">
        
        {/* 1. Global Sidebar */}
        <PosSidebar
          viewMode={viewMode}
          setViewMode={setViewMode}
          onOpenMyOrders={() => setShowActiveOrders(true)}
          onOpenMySales={() => setShowMySales(true)}
          onOpenShiftBank={() => setShowShiftBank(true)}
          onOpenKitchen={() => {}}
          onLock={() => { 
            setActiveOperator(null); 
            setOperatorToken(null);
            localStorage.removeItem('lodgecore_pos_operator_token');
            setShowSwitchPad(true); 
          }}
          onEmergencyOverride={() => setShowEmergencyModal(true)}
          isOnline={isOnline}
          syncPending={syncPending}
          activeOperator={activeOperator}
        />

        {/* Restricted mode overlay (license expired / terminal revoked) */}
        {restrictedMode && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-10 max-w-md text-center shadow-2xl">
              <div className="text-5xl mb-4">{isRevoked ? '🚫' : '⏰'}</div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">
                {isRevoked ? 'Terminal Revoked' : 'License Expired'}
              </h2>
              <p className="text-slate-500 text-sm">
                {isRevoked
                  ? 'This terminal has been deactivated by an administrator. Please contact your manager.'
                  : 'Your LodgeCore license has expired. Please renew to continue processing orders.'}
              </p>
            </div>
          </div>
        )}

        {/* 2. Main Workspace */}
        <div className="flex flex-col flex-1 min-w-0" style={{ background: '#f8fafc' }}>
          {/* Category & Search Bar */}
          {viewMode === 'menu' && (
            <div className="bg-white border-b border-slate-200 flex flex-col gap-4 px-5 py-4 shrink-0 shadow-sm z-10">
              <PosStaffStrip 
                orders={myActiveOrders}
                onSelectOrder={handleOrderResume}
                activeOrderId={currentOrderId}
              />
              
              {/* Search */}
              <div className="relative w-full max-w-md shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium text-slate-700 placeholder:text-slate-400"
                />
              </div>
              
              <CategoryTileGrid 
                categories={categories}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
              />
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
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                  {filteredProducts.map((p) => {
                    const emoji = getProductEmoji(p.name, p.category?.name);
                    // Show total quantity for this product (fired + pending) — one consolidated card
                    const qty = cart
                      .filter((i) => i.productId === p.id && (!i.modifiers || i.modifiers.length === 0))
                      .reduce((sum, i) => sum + i.quantity, 0);

                    return (
                      <ProductCardStepper
                        key={p.id}
                        product={{ id: p.id, name: p.name, price: Number(p.price) }}
                        quantity={qty}
                        onIncrement={() => handleProductTap(p)}
                        onDecrement={() => handleProductDecrement(p.id)}
                        onClick={() => handleProductTap(p)}
                        emoji={emoji}
                      />
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
                  refreshTrigger={cart.length}
                  operatorToken={operatorToken}
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. The Cart Anchor */}
        <div className="flex flex-col w-[360px] shrink-0 z-20 bg-white shadow-2xl border-l border-slate-200">
          {/* Professional Sleek Header */}
          <div className="px-5 pt-6 pb-5 border-b border-slate-100 flex flex-col gap-4 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {currentOrderId ? 'Order In Progress' : 'New Order'}
                </span>
                <span className="text-xl font-black text-slate-800 tracking-tight leading-none">
                  {activeOrderType === 'TABLE'
                    ? (activeTableName ? `Table ${activeTableName}` : 'Select Table')
                    : (activeDisplayName || activeOrderType.replace('_', ' '))}
                </span>
              </div>
              <button
                onClick={() => setShowActiveOrders(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Active Orders"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              {/* Guest Counter Pill */}
              <div className="flex items-center bg-slate-50 rounded-full px-1 py-1 border border-slate-200">
                <button onClick={() => setGuestCount((g) => Math.max(1, g - 1))} className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm transition-all">
                  <Minus className="w-3 h-3" />
                </button>
                <div className="flex flex-col items-center justify-center px-2">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">Guests</span>
                  <span className="text-xs font-black text-slate-700 leading-none">{guestCount}</span>
                </div>
                <button onClick={() => setGuestCount((g) => g + 1)} className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm transition-all">
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Action Tools */}
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button onClick={() => setShowSplitModal(true)} title="Split Check" className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-full transition-colors">
                    <Scissors className="w-4 h-4" />
                  </button>
                )}
                {currentOrderId && (
                  <button onClick={() => { setCurrentOrderId(null); setCart([]); setActiveTableId(null); setActiveTableName(null); setActiveOrderType('TABLE'); setActiveDisplayName(''); setTableRefreshTrigger(Date.now()); }} title="Clear Context" className="p-2.5 text-slate-400 hover:text-amber-600 rounded-full transition-colors">
                    <Lock className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setCart([])} title="Clear Order" className="p-2.5 text-slate-400 hover:text-rose-600 rounded-full transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Check Tabs (if multiple) */}
          {orderChecks.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto bg-slate-50/50" style={{ scrollbarWidth: 'none' }}>
              {orderChecks.map(check => (
                <button
                  key={check.id}
                  onClick={() => {
                    setActiveCheckId(check.id);
                    setCart(check.items.map((i: any) => {
                      const p = products.find(prod => prod.id === i.productId);
                      return {
                        id: i.id,
                        productId: i.productId,
                        name: i.productName,
                        price: Number(i.unitPrice),
                        quantity: i.quantity,
                        taxRate: Number(i.taxRate),
                        kitchenStatus: i.kitchenStatus,
                        station: p ? (p.resolvedStation || p.productionStation || 'KITCHEN') : 'KITCHEN',
                        fired: true,
                        modifiers: i.modifiers || [],
                      };
                    }));
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                    activeCheckId === check.id
                      ? 'bg-slate-800 text-white shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Check {check.checkNumber.split('-').pop()} {check.status === 'PAID' ? '✓' : ''}
                </button>
              ))}
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: 'none' }}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <ShoppingCart className="w-10 h-10 text-slate-200 mb-2" />
                <p className="text-sm font-semibold">Order is empty</p>
                <p className="text-xs text-slate-400">Select items from the menu to begin</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 py-2">
                {cart.map((item) => {
                  const hasPending = (item.pendingQty ?? 0) > 0;
                  const hasFired = (item.firedQty ?? 0) > 0;

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col p-3 rounded-xl border transition-all relative group ${
                        hasPending
                          ? 'bg-white border-indigo-200 shadow-sm'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      {/* Remove button — only if there are pending items */}
                      {hasPending && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Top row: name + total price */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className={`font-bold text-sm leading-tight ${hasPending ? 'text-slate-800' : 'text-slate-600'}`}>
                            {item.name}
                          </span>
                          {(item.modifiers ?? []).length > 0 && (
                            <span className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                              + {item.modifiers!.map((m: any) => m.name).join(', ')}
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-black shrink-0 ${hasPending ? 'text-slate-900' : 'text-slate-600'}`}>
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>

                      {/* Status row: sent · pending · station */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {hasFired && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                            {item.firedQty} sent
                          </span>
                        )}
                        {hasPending && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                            {item.pendingQty} pending
                          </span>
                        )}
                        {item.station && (
                          <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider ml-auto">
                            {item.station}
                          </span>
                        )}
                      </div>

                      {/* Qty stepper — only shown for items with pending qty */}
                      {hasPending && (
                        <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-100">
                          <span className="text-xs font-semibold text-slate-400">{formatCurrency(item.price)} each</span>
                          <div className="flex items-center gap-3 bg-slate-50 rounded-full px-1 py-1 border border-slate-200">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              disabled={(item.pendingQty ?? 0) <= 0}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:shadow-sm transition-all disabled:opacity-30"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-indigo-600 hover:bg-white hover:shadow-sm transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals & Sleek Actions */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 mt-auto shrink-0">
            <div className="flex flex-col gap-1.5 mb-5">
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-slate-500">
                <span>Tax</span><span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between items-end pt-3 border-t border-slate-200 mt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
                <span className="font-black text-3xl text-slate-900 tracking-tighter leading-none">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Send Order (if new items exist) */}
              {cart.some(item => !item.fired) && (
                <button
                  className="w-full h-14 font-black text-base tracking-wide text-white rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                  style={{ boxShadow: '0 8px 24px rgba(79,70,229,0.25)' }}
                  onClick={handleSendOrder}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {currentOrderId ? 'FIRE MORE' : 'SEND ORDER'}
                </button>
              )}

              {/* Charge (if order exists) */}
              {currentOrderId && (
                <button
                  className={`w-full h-14 font-black text-base tracking-wide rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 ${
                    cart.some(item => !item.fired) 
                      ? 'bg-white border-2 border-indigo-100 text-indigo-600 hover:border-indigo-200' 
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  }`}
                  onClick={() => setShowChargeModal(true)}
                  disabled={isProcessing}
                >
                  <CreditCard className="w-5 h-5" />
                  CHARGE
                </button>
              )}
            </div>
          </div>
        </div>

      {/* ══ Modals & Overlays ════════════════════════════════════════ */}

      {/* Staff Switch */}
      <StaffSwitchPad
        isOpen={!activeOperator || showSwitchPad}
        cancellable={!!activeOperator && showSwitchPad}
        outletId={sessionContext?.outlet?.id}
        onCancel={() => setShowSwitchPad(false)}
        onAuthenticated={(operator: any, token?: string) => {
          if (!activeOperator || activeOperator.id !== operator.id) {
            // A different (or new) operator is logging in — clear the entire cart context
            setCart([]);
            setCurrentOrderId(null);
            setActiveTableId(null);
            setActiveTableName(null);
            setActiveOrderType('TABLE');
            setActiveDisplayName('');
            setTableRefreshTrigger(Date.now());
          }
          setActiveOperator(operator);
          if (token) {
            setOperatorToken(token);
            localStorage.setItem('lodgecore_pos_operator_token', token);
          }
          setShowSwitchPad(false);
        }}
      />

      {/* Shift Bank Details Modal */}
      {showShiftBank && (
        <MyShiftBankModal
          isOpen={showShiftBank}
          onClose={() => setShowShiftBank(false)}
          posSessionId={posSessionId || ''}
          provider={provider}
          operatorToken={operatorToken || ''}
          onReconciled={() => {
            // Log out the user once reconciled
            setActiveOperator(null);
            setOperatorToken(null);
            localStorage.removeItem('lodgecore_pos_operator_token');
            localStorage.removeItem('lodgecore_pos_session_id');
            setPosSessionId('');
            setShowSwitchPad(true);
          }}
        />
      )}

      {/* Emergency Bank Modal */}
      {showEmergencyModal && (
        <EmergencyCashBankModal
          isOpen={showEmergencyModal}
          onClose={() => setShowEmergencyModal(false)}
          operatorToken={operatorToken || ''}
          onSuccess={(newSessionId) => {
            setPosSessionId(newSessionId);
            localStorage.setItem('lodgecore_pos_session_id', newSessionId);
            setShowEmergencyModal(false);
            setTableRefreshTrigger(Date.now());
          }}
        />
      )}

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

      {/* Charge Modal */}
      <ChargeModal
        isOpen={showChargeModal}
        onClose={() => setShowChargeModal(false)}
        total={total}
        onCharge={handleCharge}
        isProcessing={isProcessing}
      />

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
    </AutoLockScreen>
  );
}
