'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Trash2, Plus, Minus, User, Utensils, GlassWater, Coffee, Loader2, CreditCard, Banknote, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppSwitcher } from '@/components/layout/AppSwitcher';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { formatCurrency } from '@/lib/utils';
import { StaffSwitchPad } from '@/components/pos/StaffSwitchPad';
import { useRouter } from 'next/navigation';

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
};

export default function PosTerminalPage() {
  const { provider } = useLodgeCoreProvider();
  const { data: session, status: sessionStatus } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 1.7 Operator Switching & Phase 1.8 Context
  const [activeOperator, setActiveOperator] = useState<any | null>(null);
  const [showSwitchPad, setShowSwitchPad] = useState(false);
  const [sessionContext, setSessionContext] = useState<any | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          provider.pos.getProducts(propertyId),
          provider.pos.getCategories(propertyId)
        ]);
        if (prodRes.data) setProducts(prodRes.data);
        if (catRes.data) setCategories(catRes.data);

        const activeSessionId = (session as any)?.sessionId || localStorage.getItem('lodgecore_pos_session_id');
        // Attempt to resume active operator session from SQLite/Web
        if (activeSessionId) {
          try {
            const [operatorRes, contextRes] = await Promise.all([
              provider.pos.getCurrentOperator(activeSessionId),
              provider.pos.getSessionContext(activeSessionId)
            ]);
            
            if (!operatorRes.error && operatorRes.data?.staff) {
              setActiveOperator(operatorRes.data.staff);
            }
            if (!contextRes.error && contextRes.data) {
              setSessionContext(contextRes.data);
            } else if (contextRes.error) {
              // Session might be closed or invalid, clear it
              localStorage.removeItem('lodgecore_pos_session_id');
              router.push('/pos/start-shift');
            }
          } catch (e) {
            console.error("Failed to load POS session context");
          }
        }
      } catch (err) {
        console.error("Failed to fetch POS data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [propertyId, provider, session]);

  // Redirect to Start Shift if no active drawer session is found
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const activeSessionId = (session as any)?.sessionId || localStorage.getItem('lodgecore_pos_session_id');
      if (!activeSessionId) {
        router.push('/pos/start-shift');
      }
    }
  }, [sessionStatus, session, router]);

  const filteredProducts = products.filter(p => 
    (activeCategory === 'all' || p.categoryId === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        taxRate: Number(product.taxRate || 0)
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.taxRate / 100)), 0);
  const total = subtotal + tax;

  const handlePayment = async (method: string) => {
    setIsProcessing(true);
    
    // Abstract hardware IPC call for receipt printing and saving order
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
        const orderData = {
          items: cart,
          subtotal,
          tax,
          total,
          method,
          serverStaffId: activeOperator?.id
        };
        (window as any).chrome.webview.postMessage({
          command: 'CreatePosOrder',
          payload: JSON.stringify(orderData)
        });
        
        // Print Receipt automatically
        (window as any).chrome.webview.postMessage({
          command: 'PrintReceipt',
          payload: JSON.stringify({
            orderId: 'TEMP-' + Date.now(),
            total,
            items: cart
          })
        });
      }
    } catch (e) {
      console.error('IPC Failed', e);
    }

    setTimeout(() => {
      setCart([]);
      setIsProcessing(false);
      alert(`Payment of ${formatCurrency(total)} processed via ${method}! Receipt printed.`);
    }, 1000);
  };

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

  return (
    <div className="flex h-full w-full">
      {/* Left Pane - Products (70%) */}
      <div className="flex flex-col flex-[7] bg-slate-50 border-r border-slate-200">
        
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <AppSwitcher />
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold ml-2">
              L
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">LodgeCore POS</h1>
            {sessionContext?.outlet && (
              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                {sessionContext.outlet.name}
              </span>
            )}
            {sessionContext?.device && (
              <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                {sessionContext.device.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2 border-r border-slate-200 pr-4">
              <span className="text-xs text-slate-500 font-medium">Session: Cashier {session?.user?.name || 'Loading...'}</span>
              {activeOperator && (
                <span className="text-xs font-bold text-indigo-700">Operator: {activeOperator.firstName} (Waiter)</span>
              )}
            </div>

            {activeOperator && (
              <button 
                onClick={() => setShowSwitchPad(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center">
                  <User className="w-3 h-3" />
                </div>
                <span className="text-sm font-semibold">{activeOperator.firstName}</span>
                <RefreshCw className="w-3 h-3 ml-1 opacity-50" />
              </button>
            )}

            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-full bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 flex gap-3 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeCategory === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Items
          </button>
          {categories.map(c => (
            <button 
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeCategory === c.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Utensils className="w-12 h-12 opacity-20 mb-4" />
              <p className="font-medium">No products configured</p>
              <p className="text-sm mt-1">Add items from the Admin console.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`relative h-32 rounded-2xl border flex flex-col items-center justify-center p-4 transition-transform active:scale-95 shadow-sm bg-white hover:bg-slate-50 border-slate-200`}
                >
                  <span className="font-semibold text-center leading-tight mb-2">{p.name}</span>
                  <span className="font-bold opacity-80 text-indigo-700">{formatCurrency(Number(p.price))}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Pane - Cart (30%) */}
      <div className="flex flex-col flex-[3] bg-white w-full max-w-md">
        
        {/* Cart Header */}
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <ShoppingCart className="w-5 h-5" />
            Current Order
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCart([])} className="text-red-500 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Guest Attachment */}
        <div className="p-4 border-b border-slate-100">
          <button className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="w-4 h-4" />
              Attach to Room / Guest
            </div>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Order is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(item.price * item.quantity)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{formatCurrency(item.price)} each</span>
                  <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center font-semibold text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment */}
        <div className="bg-slate-50 p-6 border-t border-slate-200">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
              <span className="font-semibold text-slate-800">Total</span>
              <span className="font-bold text-2xl text-indigo-700">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="h-14 font-semibold text-base"
              onClick={() => handlePayment('ROOM_CHARGE')}
              disabled={cart.length === 0 || isProcessing}
            >
              <User className="w-5 h-5 mr-2" />
              Room
            </Button>
            <Button 
              className="h-14 font-semibold text-base"
              variant="outline"
              onClick={() => handlePayment('CARD')}
              disabled={cart.length === 0 || isProcessing}
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Card
            </Button>
            <Button 
              className="col-span-2 h-14 font-semibold text-base bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handlePayment('CASH')}
              disabled={cart.length === 0 || isProcessing}
            >
              <Banknote className="w-5 h-5 mr-2" />
              Pay {formatCurrency(total)}
            </Button>
          </div>
        </div>
      </div>

      {/* Staff Switch Pad Overlay */}
      <StaffSwitchPad 
        isOpen={!activeOperator || showSwitchPad} 
        cancellable={!!activeOperator}
        onCancel={() => setShowSwitchPad(false)}
        onAuthenticated={(operator) => {
          setActiveOperator(operator);
          setShowSwitchPad(false);
        }}
      />
    </div>
  );
}
