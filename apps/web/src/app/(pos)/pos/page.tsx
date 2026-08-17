'use client';

import { useState } from 'react';
import { ShoppingCart, Search, Printer, CreditCard, Banknote, Trash2, Plus, Minus, User, Coffee, Utensils, GlassWater } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Mock Data for Offline POS
const CATEGORIES = [
  { id: 'c1', name: 'Mains', icon: Utensils },
  { id: 'c2', name: 'Beverages', icon: GlassWater },
  { id: 'c3', name: 'Coffee & Tea', icon: Coffee },
];

const PRODUCTS = [
  { id: 'p1', categoryId: 'c1', name: 'Classic Burger', price: 5500, taxRate: 7.5, color: 'bg-orange-100 text-orange-900 border-orange-200' },
  { id: 'p2', categoryId: 'c1', name: 'Beef Steak', price: 18500, taxRate: 7.5, color: 'bg-red-100 text-red-900 border-red-200' },
  { id: 'p3', categoryId: 'c1', name: 'Pasta Carbonara', price: 6500, taxRate: 7.5, color: 'bg-amber-100 text-amber-900 border-amber-200' },
  { id: 'p4', categoryId: 'c2', name: 'Coca Cola', price: 1200, taxRate: 7.5, color: 'bg-slate-100 text-slate-900 border-slate-200' },
  { id: 'p5', categoryId: 'c2', name: 'Fresh Juice', price: 2500, taxRate: 7.5, color: 'bg-green-100 text-green-900 border-green-200' },
  { id: 'p6', categoryId: 'c3', name: 'Espresso', price: 1500, taxRate: 7.5, color: 'bg-stone-100 text-stone-900 border-stone-200' },
  { id: 'p7', categoryId: 'c3', name: 'Cappuccino', price: 2500, taxRate: 7.5, color: 'bg-stone-100 text-stone-900 border-stone-200' },
];

type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  taxRate: number;
};

export default function PosTerminalPage() {
  const [activeCategory, setActiveCategory] = useState('c1');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredProducts = PRODUCTS.filter(p => 
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
        price: product.price,
        quantity: 1,
        taxRate: product.taxRate
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
          method
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
      alert(`Payment of ₦${total.toLocaleString()} processed via ${method}! Receipt printed.`);
    }, 1000);
  };

  return (
    <div className="flex h-full w-full">
      {/* Left Pane - Products (70%) */}
      <div className="flex flex-col flex-[7] bg-slate-50 border-r border-slate-200">
        
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              L
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">LodgeCore POS</h1>
            <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
              Main Restaurant
            </span>
          </div>

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
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button 
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activeCategory === c.id ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {c.name}
              </button>
            )
          })}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className={`relative h-32 rounded-2xl border flex flex-col items-center justify-center p-4 transition-transform active:scale-95 shadow-sm ${p.color}`}
              >
                <span className="font-semibold text-center leading-tight mb-2">{p.name}</span>
                <span className="font-bold opacity-80">₦{p.price.toLocaleString()}</span>
              </button>
            ))}
          </div>
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
                  <span className="font-bold text-slate-900">₦{(item.price * item.quantity).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">₦{item.price.toLocaleString()} each</span>
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
        <div className="border-t border-slate-200 bg-slate-50 p-6 space-y-4">
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (7.5%)</span>
              <span>₦{tax.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 border-dashed">
            <span className="font-bold text-lg text-slate-800">Total</span>
            <span className="font-bold text-2xl text-indigo-700">₦{total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button 
              size="lg" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 text-lg font-bold shadow-lg"
              onClick={() => handlePayment('CASH')}
              disabled={cart.length === 0 || isProcessing}
            >
              <Banknote className="w-5 h-5 mr-2" />
              Cash
            </Button>
            <Button 
              size="lg" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 text-lg font-bold shadow-lg"
              onClick={() => handlePayment('CARD')}
              disabled={cart.length === 0 || isProcessing}
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Card
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
