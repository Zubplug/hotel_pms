'use client';

/**
 * Cart context for Stanzel Food Commerce.
 * Persists cart to sessionStorage so it survives page navigation.
 * Cart is cleared on order confirmation.
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { CommerceProduct, CommerceModifierOption } from '@/lib/commerce';

export interface CartItem {
  id: string; // product.id + modifiers hash
  productId: string;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number; // base + modifiers
  modifierOptionIds: string[];
  modifierLabels: string[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  promoCode: string;
  promoDiscount: number;
  orderType: 'PICKUP' | 'DELIVERY' | 'DINE_IN';
}

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'UPDATE_QTY'; id: string; quantity: number }
  | { type: 'SET_PROMO'; code: string; discount: number }
  | { type: 'SET_ORDER_TYPE'; orderType: 'PICKUP' | 'DELIVERY' | 'DINE_IN' }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

const STORAGE_KEY = 'stanzel-commerce-cart';

const initial: CartState = {
  items: [],
  promoCode: '',
  promoDiscount: 0,
  orderType: 'PICKUP',
};

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + action.item.quantity } : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.id) };
    case 'UPDATE_QTY':
      if (action.quantity <= 0) return { ...state, items: state.items.filter(i => i.id !== action.id) };
      return { ...state, items: state.items.map(i => i.id === action.id ? { ...i, quantity: action.quantity } : i) };
    case 'SET_PROMO':
      return { ...state, promoCode: action.code, promoDiscount: action.discount };
    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.orderType };
    case 'CLEAR':
      return initial;
    case 'HYDRATE':
      return action.state;
    default:
      return state;
  }
}

interface CartContext {
  state: CartState;
  addItem: (product: CommerceProduct, qty: number, modifiers: CommerceModifierOption[], notes?: string) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setPromo: (code: string, discount: number) => void;
  setOrderType: (type: 'PICKUP' | 'DELIVERY' | 'DINE_IN') => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

const CartCtx = createContext<CartContext | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
    } catch {}
  }, []);

  // Persist to sessionStorage on every change
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const addItem = useCallback((
    product: CommerceProduct,
    qty: number,
    modifiers: CommerceModifierOption[],
    notes?: string
  ) => {
    const modifierIds = modifiers.map(m => m.id).sort();
    const id = `${product.id}__${modifierIds.join('-')}`;
    const modifierPrice = modifiers.reduce((s, m) => s + m.priceAdjustment, 0);

    dispatch({
      type: 'ADD_ITEM',
      item: {
        id,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        quantity: qty,
        unitPrice: product.price + modifierPrice,
        modifierOptionIds: modifierIds,
        modifierLabels: modifiers.map(m => m.name),
        notes,
      },
    });
  }, []);

  const subtotal = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartCtx.Provider value={{
      state,
      addItem,
      removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', id }),
      updateQty: (id, qty) => dispatch({ type: 'UPDATE_QTY', id, quantity: qty }),
      setPromo: (code, discount) => dispatch({ type: 'SET_PROMO', code, discount }),
      setOrderType: (orderType) => dispatch({ type: 'SET_ORDER_TYPE', orderType }),
      clearCart: () => dispatch({ type: 'CLEAR' }),
      subtotal,
      itemCount,
    }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
