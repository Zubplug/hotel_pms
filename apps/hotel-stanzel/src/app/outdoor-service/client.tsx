'use client';

/**
 * Stanzel Grand Resort — Outdoor & Poolside Food Ordering
 *
 * Design: "Smart Luxury Menu" — inspired by the best food ordering apps
 * ─ Compact sticky store bar (no massive hero) with live status + search
 * ─ Horizontal scrolling category tabs with emoji + gold active underline
 * ─ Featured / promo cards in horizontal carousel at top
 * ─ Best Sellers horizontal scroll row
 * ─ Main menu: clean horizontal product cards (photo | info | add button)
 * ─ Desktop: 3-col layout (categories sidebar | menu | sticky cart panel)
 * ─ Mobile: full-width cards + fixed bottom cart bar
 * ─ Cart panel slides in instantly from right on desktop when item added
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import type {
  CommerceStore, CommerceMenu, CommerceCategory,
  CommerceProduct, CommerceModifierOption,
} from '@/lib/commerce';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, cur = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: cur, minimumFractionDigits: 0,
  }).format(n);
}

const CAT_ICONS: Record<string, string> = {
  'featured': '⭐',
  'guest': '🎁',
  'nigerian main': '🍲',
  'special': '✨',
  'rice': '🍚',
  'pasta': '🍚',
  'nigerian extra': '🥘',
  'continental': '🥐',
  'breakfast': '🥐',
  'dessert': '🍰',
  'snack': '🍰',
  'salad': '🥗',
  'starter': '🌶',
  'wine': '🍷',
  'champagne': '🍷',
  'spirit': '🥃',
  'rum': '🥃',
  'soft drink': '🥤',
  'water': '🥤',
  'beer': '🍺',
  'cider': '🍺',
  'whiskey': '🥃',
  'brandy': '🥃',
  'gin': '🥃',
  'vodka': '🥃',
  'liqueur': '🍸',
};

function catIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CAT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '🍽';
}

type FlatCategory = CommerceCategory & { menuName: string };

// ─── Product Detail Sheet ─────────────────────────────────────────────────────

function ProductSheet({
  product, currency, onClose, onAdd,
}: {
  product: CommerceProduct;
  currency: string;
  onClose: () => void;
  onAdd: (p: CommerceProduct, qty: number, mods: CommerceModifierOption[], notes: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const modPrice = product.modifierGroups
    .flatMap(g => g.options)
    .filter(o => Object.values(selectedMods).includes(o.id))
    .reduce((s, o) => s + o.priceAdjustment, 0);

  const lineTotal = (product.price + modPrice) * qty;

  // close on ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="sm-backdrop" onClick={onClose} role="dialog" aria-modal aria-label={product.name}>
      <div className="sm-sheet" onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div className="sm-sheet__img">
          {product.imageUrl
            ? <Image src={product.imageUrl} alt={product.name} fill sizes="600px" style={{ objectFit: 'cover' }} />
            : <div className="sm-sheet__img-fallback">{catIcon('')}</div>
          }
          <div className="sm-sheet__img-fade" />
          <button className="sm-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          <div className="sm-sheet__img-badge">Outdoor Service</div>
        </div>

        <div className="sm-sheet__body">
          <h2 className="sm-sheet__name">{product.name}</h2>
          {product.description && <p className="sm-sheet__desc">{product.description}</p>}

          <div className="sm-sheet__chips">
            <span className="sm-sheet__price">{fmt(product.price, currency)}</span>
            {product.prepTimeMinutes && <span className="sm-chip">⏱ {product.prepTimeMinutes} min</span>}
            {product.calories && <span className="sm-chip">{product.calories} kcal</span>}
          </div>

          {product.modifierGroups.map(group => (
            <div key={group.id} className="sm-mods">
              <p className="sm-mods__title">
                {group.name}
                {group.isRequired && <span className="sm-mods__req">Required</span>}
              </p>
              <div className="sm-mods__opts">
                {group.options.map(opt => (
                  <button
                    key={opt.id}
                    className={`sm-mod-opt${selectedMods[group.id] === opt.id ? ' active' : ''}`}
                    onClick={() => setSelectedMods(p => ({ ...p, [group.id]: opt.id }))}
                  >
                    {opt.name}
                    {opt.priceAdjustment > 0 && <span className="sm-mod-opt__extra">+{fmt(opt.priceAdjustment, currency)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <label className="sm-notes">
            <span>Special instructions (optional)</span>
            <textarea
              className="sm-notes__box"
              rows={2}
              placeholder="Allergies, spice level, substitutions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </label>

          <div className="sm-sheet__footer">
            <div className="sm-qty">
              <button className="sm-qty__btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="sm-qty__n">{qty}</span>
              <button className="sm-qty__btn" onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <button
              className="sm-sheet__add"
              onClick={() => {
                const mods = product.modifierGroups.flatMap(g => g.options).filter(o => Object.values(selectedMods).includes(o.id));
                onAdd(product, qty, mods, notes);
                onClose();
              }}
            >
              <span>Add to Order</span>
              <span className="sm-sheet__add-price">{fmt(lineTotal, currency)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cart Panel (desktop right sidebar + mobile drawer) ───────────────────────

function CartPanel({
  currency, open, onClose,
}: { currency: string; open: boolean; onClose: () => void }) {
  const { state, updateQty, subtotal, itemCount, clearCart } = useCart();

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && <div className="sm-cart-backdrop" onClick={onClose} />}

      <aside className={`sm-cart${open ? ' sm-cart--open' : ''}`} aria-label="Your order">
        <div className="sm-cart__head">
          <h2 className="sm-cart__title">Your Order</h2>
          {itemCount > 0 && (
            <button className="sm-cart__clear" onClick={clearCart}>Clear</button>
          )}
        </div>

        {itemCount === 0 ? (
          <div className="sm-cart__empty">
            <span className="sm-cart__empty-icon">🛒</span>
            <p>Your order is empty</p>
            <span>Add items from the menu</span>
          </div>
        ) : (
          <>
            <div className="sm-cart__items">
              {state.items.map(item => (
                <div key={item.id} className="sm-cart__item">
                  <div className="sm-cart__item-info">
                    <p className="sm-cart__item-name">{item.productName}</p>
                    {item.modifierLabels.length > 0 && (
                      <p className="sm-cart__item-mods">{item.modifierLabels.join(' · ')}</p>
                    )}
                  </div>
                  <div className="sm-cart__item-ctrl">
                    <button onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <span className="sm-cart__item-price">{fmt(item.unitPrice * item.quantity, currency)}</span>
                </div>
              ))}
            </div>

            <div className="sm-cart__summary">
              <div className="sm-cart__summary-row">
                <span>Subtotal</span>
                <span>{fmt(subtotal, currency)}</span>
              </div>
              <div className="sm-cart__summary-row sm-cart__summary-row--muted">
                <span>Delivery fee</span>
                <span>At checkout</span>
              </div>
            </div>

            <Link href="/order" className="sm-cart__checkout" onClick={onClose}>
              Checkout · {fmt(subtotal, currency)}
            </Link>
          </>
        )}
      </aside>
    </>
  );
}

// ─── Product Card (horizontal) ────────────────────────────────────────────────

function ProductCard({
  product, catIcon: icon, currency, onSelect,
}: {
  product: CommerceProduct;
  catIcon: string;
  currency: string;
  onSelect: (p: CommerceProduct) => void;
}) {
  return (
    <div
      className={`sm-product${!product.isAvailable ? ' sm-product--out' : ''}`}
      onClick={() => product.isAvailable && onSelect(product)}
      role="button"
      tabIndex={product.isAvailable ? 0 : -1}
      aria-disabled={!product.isAvailable}
      onKeyDown={e => e.key === 'Enter' && product.isAvailable && onSelect(product)}
    >
      <div className="sm-product__img">
        {product.imageUrl
          ? <Image src={product.imageUrl} alt={product.name} fill sizes="120px" style={{ objectFit: 'cover' }} />
          : <span className="sm-product__img-fallback">{icon}</span>
        }
        {!product.isAvailable && <div className="sm-product__out-label">Sold out</div>}
        {product.isFeatured && <div className="sm-product__badge">Featured</div>}
      </div>
      <div className="sm-product__body">
        <p className="sm-product__name">{product.name}</p>
        {product.description && <p className="sm-product__desc">{product.description}</p>}
        <div className="sm-product__meta">
          {product.prepTimeMinutes && <span className="sm-product__time">⏱ {product.prepTimeMinutes} min</span>}
          {product.calories && <span className="sm-product__time">{product.calories} kcal</span>}
        </div>
        <div className="sm-product__footer">
          <span className="sm-product__price">{fmt(product.price, currency)}</span>
          {product.isAvailable && (
            <span className="sm-product__add" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface Props {
  store: CommerceStore | null;
  menus: CommerceMenu[];
}

export function OutdoorServiceClient({ store, menus }: Props) {
  const { addItem, itemCount, subtotal } = useCart();
  const [activeId, setActiveId] = useState<string>('__featured');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CommerceProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const catNavRef = useRef<HTMLDivElement>(null);

  const currency = store?.currency ?? 'NGN';

  const allCategories: FlatCategory[] = menus.flatMap(m =>
    m.categories.map(c => ({ ...c, menuName: m.name }))
  );

  const allProducts = allCategories.flatMap(c => c.products);

  // Best sellers — sort by soldCount desc
  const bestSellers = allProducts
    .filter(p => p.isAvailable)
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 10);

  // Featured — explicit isFeatured flag, then top sellers
  const featured = allProducts
    .filter(p => p.isAvailable && (p.isFeatured || (p.soldCount ?? 0) > 0))
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 6);

  // Current category products (or search across all)
  const displayProducts: CommerceProduct[] = (() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      );
    }
    if (activeId === '__featured') return featured;
    if (activeId === '__bestsellers') return bestSellers;
    return allCategories.find(c => c.id === activeId)?.products ?? [];
  })();

  const activeCatName: string = (() => {
    if (search) return `Results for "${search}"`;
    if (activeId === '__featured') return '⭐ Featured';
    if (activeId === '__bestsellers') return '🔥 Best Sellers';
    return allCategories.find(c => c.id === activeId)?.name ?? '';
  })();

  const activeCatIcon = allCategories.find(c => c.id === activeId)?.name
    ? catIcon(allCategories.find(c => c.id === activeId)!.name) : '🍽';

  // Open cart when item added
  const handleAdd = useCallback((p: CommerceProduct, qty: number, mods: CommerceModifierOption[], notes: string) => {
    addItem(p, qty, mods, notes);
    setCartOpen(true);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1000);
  }, [addItem]);

  const selectCategory = (id: string) => {
    setActiveId(id);
    setSearch('');
    // Scroll pill into view
    const btn = catNavRef.current?.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const isOpen = store?.status === 'ACTIVE';

  return (
    <div className="sm-page">
      {/* ══ STORE BANNER ═════════════════════════════════════════════════════ */}
      <div className="sm-banner">
        <div className="sm-banner__inner">
          <div className="sm-banner__left">
            <div className="sm-banner__info">
              <h1 className="sm-banner__name">Outdoor &amp; Poolside</h1>
              <div className="sm-banner__meta">
                <span className={`sm-status${isOpen ? ' sm-status--open' : ''}`}>
                  <span className="sm-status__dot" />
                  {isOpen ? 'Open · Taking orders' : 'Temporarily closed'}
                </span>
                <span className="sm-banner__sep">·</span>
                <span className="sm-banner__sub">Cabana · Poolside · Garden Terrace</span>
              </div>
            </div>
          </div>
          <div className="sm-banner__search">
            <span className="sm-banner__search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" />
              </svg>
            </span>
            <input
              className="sm-banner__search-input"
              type="search"
              placeholder="Search the menu…"
              value={search}
              onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveId('__featured'); }}
              aria-label="Search menu"
            />
            {search && (
              <button className="sm-banner__search-clear" onClick={() => setSearch('')} aria-label="Clear">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* ══ CATEGORY NAV ═════════════════════════════════════════════════════ */}
      <nav className="sm-cat-nav" ref={catNavRef} aria-label="Menu categories">
        {/* Virtual tabs */}
        <button
          data-id="__featured"
          className={`sm-cat-tab${activeId === '__featured' ? ' active' : ''}`}
          onClick={() => selectCategory('__featured')}
        >⭐ Featured</button>
        <button
          data-id="__bestsellers"
          className={`sm-cat-tab${activeId === '__bestsellers' ? ' active' : ''}`}
          onClick={() => selectCategory('__bestsellers')}
        >🔥 Best Sellers</button>

        {allCategories.map(cat => (
          <button
            key={cat.id}
            data-id={cat.id}
            className={`sm-cat-tab${activeId === cat.id ? ' active' : ''}`}
            onClick={() => selectCategory(cat.id)}
          >
            {catIcon(cat.name)} {cat.name}
          </button>
        ))}
      </nav>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="sm-body">

        {/* Menu column */}
        <div className="sm-menu-col">

          {/* Featured promo cards — only shown on featured tab */}
          {activeId === '__featured' && !search && featured.length > 0 && (
            <div className="sm-promos">
              {featured.slice(0, 3).map(product => (
                <button
                  key={product.id}
                  className="sm-promo-card"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="sm-promo-card__img">
                    {product.imageUrl
                      ? <Image src={product.imageUrl} alt={product.name} fill sizes="320px" style={{ objectFit: 'cover' }} />
                      : <span>{catIcon('')}</span>
                    }
                    <div className="sm-promo-card__overlay" />
                  </div>
                  <div className="sm-promo-card__body">
                    {product.isFeatured && <span className="sm-promo-card__tag">Featured</span>}
                    <p className="sm-promo-card__name">{product.name}</p>
                    <p className="sm-promo-card__price">{fmt(product.price, currency)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Category heading */}
          <div className="sm-section-head">
            <h2 className="sm-section-head__title">{activeCatName}</h2>
            <span className="sm-section-head__count">
              {displayProducts.length} item{displayProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Product list */}
          {displayProducts.length === 0 ? (
            <div className="sm-empty">
              <p>{search ? `No results for "${search}"` : 'No items in this category'}</p>
              {search && <button onClick={() => setSearch('')}>Clear search</button>}
            </div>
          ) : (
            <div className="sm-product-list">
              {displayProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  catIcon={activeCatIcon}
                  currency={currency}
                  onSelect={setSelectedProduct}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop cart sidebar */}
        <CartPanel currency={currency} open={cartOpen} onClose={() => setCartOpen(false)} />
      </div>

      {/* ══ MOBILE BOTTOM BAR ════════════════════════════════════════════════ */}
      {itemCount > 0 && (
        <div className="sm-mobile-bar" onClick={() => setCartOpen(true)}>
          <span className="sm-mobile-bar__badge">{itemCount}</span>
          <span className="sm-mobile-bar__label">View Order</span>
          <span className="sm-mobile-bar__total">{fmt(subtotal, currency)}</span>
        </div>
      )}

      {/* ══ PRODUCT SHEET ════════════════════════════════════════════════════ */}
      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          currency={currency}
          onClose={() => setSelectedProduct(null)}
          onAdd={handleAdd}
        />
      )}

      {/* ══ STYLES ═══════════════════════════════════════════════════════════ */}
      <style>{`
        /* ─── Reset & base ─── */
        *, *::before, *::after { box-sizing: border-box; }
        .sm-page {
          background: #0d2b22;
          min-height: 100vh;
          color: var(--color-ivory, #faf8f4);
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
          padding-top: var(--nav-height, 70px);
          padding-bottom: 100px;
        }

        /* ─── Store Banner ─── */
        .sm-banner {
          background: #0a1f17;
          border-bottom: 1px solid rgba(201,169,110,0.15);
          position: sticky; top: var(--nav-height, 70px); z-index: 50;
        }
        .sm-banner__inner {
          max-width: 1300px; margin: 0 auto;
          padding: 14px 20px;
          display: flex; align-items: center; gap: 16px;
          flex-wrap: wrap;
        }
        .sm-banner__left { flex: 1; min-width: 200px; }
        .sm-banner__name {
          font-family: var(--font-serif, Georgia, serif);
          font-size: 1.15rem; font-weight: 500;
          color: var(--color-ivory, #faf8f4);
          margin: 0 0 4px;
        }
        .sm-banner__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .sm-status {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.75rem; font-weight: 600;
          color: rgba(250,248,244,0.45);
        }
        .sm-status--open { color: #4ade80; }
        .sm-status__dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(250,248,244,0.3);
        }
        .sm-status--open .sm-status__dot {
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80;
          animation: pulse-status 2s ease infinite;
        }
        @keyframes pulse-status {
          0%,100% { box-shadow: 0 0 6px #4ade80; }
          50% { box-shadow: 0 0 14px #4ade80; }
        }
        .sm-banner__sep { color: rgba(250,248,244,0.2); font-size: 0.75rem; }
        .sm-banner__sub { font-size: 0.75rem; color: rgba(250,248,244,0.35); }

        /* Search */
        .sm-banner__search {
          flex: 1; max-width: 420px; min-width: 220px;
          display: flex; align-items: center; gap: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: 999px;
          padding: 9px 16px;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .sm-banner__search:focus-within {
          border-color: rgba(201,169,110,0.5);
          box-shadow: 0 0 0 3px rgba(201,169,110,0.1);
        }
        .sm-banner__search-icon { color: rgba(250,248,244,0.35); flex-shrink: 0; display: flex; }
        .sm-banner__search-input {
          flex: 1; background: none; border: none; outline: none;
          color: var(--color-ivory, #faf8f4);
          font-size: 0.875rem; font-family: inherit;
        }
        .sm-banner__search-input::placeholder { color: rgba(250,248,244,0.3); }
        .sm-banner__search-clear {
          background: none; border: none; cursor: pointer;
          color: rgba(250,248,244,0.35); font-size: 0.75rem;
          transition: color 0.15s;
        }
        .sm-banner__search-clear:hover { color: var(--color-gold, #c9a96e); }

        /* ─── Category Nav ─── */
        .sm-cat-nav {
          display: flex; gap: 4px;
          overflow-x: auto; padding: 12px 20px;
          background: #0a1f17;
          border-bottom: 1px solid rgba(201,169,110,0.1);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          position: sticky;
          top: calc(var(--nav-height, 70px) + 57px);
          z-index: 40;
        }
        .sm-cat-nav::-webkit-scrollbar { display: none; }
        .sm-cat-tab {
          display: inline-flex; align-items: center; gap: 5px;
          white-space: nowrap; flex-shrink: 0;
          background: none; border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 0.8rem; font-weight: 500;
          color: rgba(250,248,244,0.55);
          cursor: pointer; transition: all 0.18s;
        }
        .sm-cat-tab:hover {
          border-color: rgba(201,169,110,0.35);
          color: var(--color-ivory, #faf8f4);
          background: rgba(201,169,110,0.07);
        }
        .sm-cat-tab.active {
          background: rgba(201,169,110,0.15);
          border-color: var(--color-gold, #c9a96e);
          color: var(--color-gold, #c9a96e);
          font-weight: 700;
        }

        /* ─── Body Layout ─── */
        .sm-body {
          max-width: 1300px; margin: 0 auto;
          padding: 0 20px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          padding-top: 24px;
        }
        @media (min-width: 1060px) {
          .sm-body {
            grid-template-columns: 1fr 320px;
            align-items: start;
          }
        }
        .sm-menu-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }

        /* ─── Promo Cards (featured carousel) ─── */
        .sm-promos {
          display: flex; gap: 14px;
          overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .sm-promos::-webkit-scrollbar { display: none; }
        .sm-promo-card {
          position: relative; flex-shrink: 0;
          width: clamp(240px, 38vw, 320px);
          height: 170px;
          border-radius: 16px; overflow: hidden;
          border: none; cursor: pointer;
          text-align: left;
          transition: transform 0.22s, box-shadow 0.22s;
        }
        .sm-promo-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
        }
        .sm-promo-card__img { position: absolute; inset: 0; background: #1a3c2e; }
        .sm-promo-card__overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(10,22,18,0.95) 0%, rgba(10,22,18,0.3) 60%);
        }
        .sm-promo-card__body {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 14px 16px; z-index: 2;
        }
        .sm-promo-card__tag {
          display: inline-block;
          background: var(--color-gold, #c9a96e); color: #0d2b22;
          border-radius: 999px; padding: 2px 10px;
          font-size: 0.65rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .sm-promo-card__name {
          font-weight: 700; font-size: 0.95rem;
          color: var(--color-ivory, #faf8f4);
          margin: 0 0 4px; line-height: 1.3;
        }
        .sm-promo-card__price {
          font-weight: 800; font-size: 1rem;
          color: var(--color-gold, #c9a96e); margin: 0;
        }

        /* ─── Section heading ─── */
        .sm-section-head {
          display: flex; align-items: baseline;
          justify-content: space-between; gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .sm-section-head__title {
          font-family: var(--font-serif, Georgia, serif);
          font-size: 1.3rem; font-weight: 400;
          color: var(--color-ivory, #faf8f4); margin: 0;
        }
        .sm-section-head__count {
          font-size: 0.75rem; color: rgba(250,248,244,0.35);
          white-space: nowrap;
        }

        /* ─── Product List ─── */
        .sm-product-list {
          display: flex; flex-direction: column; gap: 2px;
        }

        /* ─── Product Card (horizontal) ─── */
        .sm-product {
          display: flex; gap: 0;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.055);
          border-radius: 14px;
          overflow: hidden; cursor: pointer;
          transition: background 0.18s, border-color 0.18s, transform 0.18s;
          position: relative;
        }
        .sm-product:hover:not(.sm-product--out) {
          background: rgba(255,255,255,0.065);
          border-color: rgba(201,169,110,0.25);
          transform: translateX(2px);
        }
        .sm-product--out { opacity: 0.45; cursor: default; }

        .sm-product__img {
          position: relative; flex-shrink: 0;
          width: 110px; height: 110px;
          background: #1a3c2e;
          overflow: hidden;
        }
        @media (max-width: 480px) {
          .sm-product__img { width: 90px; height: 90px; }
        }
        .sm-product__img-fallback {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem;
        }
        .sm-product__out-label {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 800; color: white;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .sm-product__badge {
          position: absolute; top: 6px; left: 6px;
          background: var(--color-gold, #c9a96e); color: #0d2b22;
          font-size: 0.6rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
          border-radius: 999px; padding: 2px 7px;
        }

        .sm-product__body {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          padding: 14px 14px 12px;
        }
        .sm-product__name {
          font-weight: 700; font-size: 0.9rem;
          color: var(--color-ivory, #faf8f4);
          margin: 0 0 4px; line-height: 1.35;
        }
        .sm-product__desc {
          font-size: 0.75rem;
          color: rgba(250,248,244,0.45);
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
          margin: 0 0 6px; line-height: 1.45;
        }
        .sm-product__meta {
          display: flex; gap: 8px; flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .sm-product__time {
          font-size: 0.7rem; color: rgba(250,248,244,0.35);
        }
        .sm-product__footer {
          display: flex; align-items: center;
          justify-content: space-between; margin-top: auto;
        }
        .sm-product__price {
          font-weight: 800; font-size: 0.95rem;
          color: var(--color-gold, #c9a96e);
        }
        .sm-product__add {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--color-gold, #c9a96e);
          display: flex; align-items: center; justify-content: center;
          color: #0d2b22; flex-shrink: 0;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 10px rgba(201,169,110,0.4);
        }
        .sm-product:hover .sm-product__add {
          transform: scale(1.15) rotate(90deg);
          box-shadow: 0 4px 18px rgba(201,169,110,0.6);
        }

        /* ─── Empty state ─── */
        .sm-empty {
          text-align: center; padding: 48px 20px;
          color: rgba(250,248,244,0.4);
        }
        .sm-empty p { font-size: 1rem; margin-bottom: 12px; }
        .sm-empty button {
          background: none; border: 1px solid rgba(201,169,110,0.35);
          color: var(--color-gold, #c9a96e); border-radius: 999px;
          padding: 8px 20px; cursor: pointer; font-size: 0.85rem;
        }

        /* ─── Cart Panel ─── */
        .sm-cart {
          background: #0a1f17;
          border: 1px solid rgba(201,169,110,0.15);
          border-radius: 18px;
          display: flex; flex-direction: column;
          position: sticky; top: calc(var(--nav-height, 70px) + 110px);
          max-height: calc(100vh - var(--nav-height, 70px) - 130px);
          overflow: hidden;
        }
        @media (max-width: 1059px) {
          .sm-cart {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: min(380px, 95vw);
            border-radius: 0;
            border-top: none; border-right: none; border-bottom: none;
            border-left: 1px solid rgba(201,169,110,0.2);
            z-index: 200;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
          }
          .sm-cart--open {
            transform: translateX(0);
            box-shadow: -20px 0 60px rgba(0,0,0,0.5);
          }
        }
        @media (min-width: 1060px) {
          /* On desktop cart is always visible, never off-screen */
          .sm-cart { transform: none !important; }
        }

        .sm-cart-backdrop {
          display: none;
        }
        @media (max-width: 1059px) {
          .sm-cart-backdrop {
            display: block;
            position: fixed; inset: 0;
            background: rgba(10,22,18,0.6);
            backdrop-filter: blur(4px);
            z-index: 199;
          }
        }

        .sm-cart__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 20px 14px;
          border-bottom: 1px solid rgba(201,169,110,0.1);
          flex-shrink: 0;
        }
        .sm-cart__title {
          font-family: var(--font-serif, Georgia, serif);
          font-size: 1.1rem; font-weight: 500;
          color: var(--color-ivory, #faf8f4); margin: 0;
        }
        .sm-cart__clear {
          background: none; border: 1px solid rgba(255,255,255,0.1);
          color: rgba(250,248,244,0.4); border-radius: 999px;
          padding: 4px 12px; font-size: 0.75rem;
          cursor: pointer; transition: all 0.15s;
        }
        .sm-cart__clear:hover { border-color: #ef4444; color: #ef4444; }

        .sm-cart__empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          padding: 32px;
          color: rgba(250,248,244,0.35); text-align: center;
        }
        .sm-cart__empty-icon { font-size: 2.5rem; }
        .sm-cart__empty p { font-size: 0.95rem; font-weight: 600; margin: 0; color: rgba(250,248,244,0.5); }
        .sm-cart__empty span { font-size: 0.8rem; }

        .sm-cart__items {
          flex: 1; overflow-y: auto; padding: 12px 20px;
          display: flex; flex-direction: column; gap: 2px;
          scrollbar-width: thin; scrollbar-color: rgba(201,169,110,0.2) transparent;
        }
        .sm-cart__item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sm-cart__item:last-child { border-bottom: none; }
        .sm-cart__item-info { flex: 1; min-width: 0; }
        .sm-cart__item-name {
          font-size: 0.82rem; font-weight: 600;
          color: var(--color-ivory, #faf8f4);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sm-cart__item-mods {
          font-size: 0.7rem; color: rgba(250,248,244,0.4);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sm-cart__item-ctrl {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .sm-cart__item-ctrl button {
          width: 24px; height: 24px; border-radius: 50%;
          border: 1px solid rgba(201,169,110,0.3);
          background: rgba(201,169,110,0.08);
          color: var(--color-gold, #c9a96e);
          cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;
          line-height: 1; transition: background 0.15s;
        }
        .sm-cart__item-ctrl button:hover { background: var(--color-gold, #c9a96e); color: #0d2b22; }
        .sm-cart__item-ctrl span { font-size: 0.85rem; font-weight: 700; min-width: 16px; text-align: center; }
        .sm-cart__item-price {
          font-size: 0.82rem; font-weight: 700;
          color: var(--color-gold, #c9a96e); white-space: nowrap; flex-shrink: 0;
        }

        .sm-cart__summary {
          padding: 12px 20px 0;
          border-top: 1px solid rgba(201,169,110,0.1);
          display: flex; flex-direction: column; gap: 6px;
          flex-shrink: 0;
        }
        .sm-cart__summary-row {
          display: flex; justify-content: space-between;
          font-size: 0.82rem; font-weight: 600;
          color: var(--color-ivory, #faf8f4);
        }
        .sm-cart__summary-row--muted { color: rgba(250,248,244,0.35); font-weight: 400; }

        .sm-cart__checkout {
          display: block; margin: 14px 20px 20px;
          text-align: center; text-decoration: none;
          background: var(--color-gold, #c9a96e);
          color: #0d2b22; border-radius: 12px;
          padding: 14px 20px;
          font-weight: 800; font-size: 0.9rem;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(201,169,110,0.35);
          flex-shrink: 0;
        }
        .sm-cart__checkout:hover {
          background: #d4b87a;
          box-shadow: 0 6px 28px rgba(201,169,110,0.5);
          transform: translateY(-2px);
        }

        /* ─── Mobile bottom bar ─── */
        .sm-mobile-bar {
          display: flex; align-items: center; gap: 10px;
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--color-gold, #c9a96e);
          color: #0d2b22; border-radius: 999px;
          padding: 14px 28px;
          cursor: pointer;
          box-shadow: 0 8px 36px rgba(201,169,110,0.5), 0 2px 8px rgba(0,0,0,0.3);
          z-index: 100; white-space: nowrap;
          animation: bar-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .sm-mobile-bar:hover {
          transform: translateX(-50%) translateY(-3px);
          box-shadow: 0 12px 44px rgba(201,169,110,0.65);
        }
        @keyframes bar-pop {
          from { opacity:0; transform: translateX(-50%) translateY(30px) scale(0.85); }
          to   { opacity:1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .sm-mobile-bar__badge {
          background: #0d2b22; color: var(--color-gold, #c9a96e);
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 800; flex-shrink: 0;
        }
        .sm-mobile-bar__label { font-weight: 700; font-size: 0.9rem; flex: 1; }
        .sm-mobile-bar__total { font-weight: 800; font-size: 0.95rem; }
        @media (min-width: 1060px) { .sm-mobile-bar { display: none; } }

        /* ─── Product Sheet ─── */
        .sm-backdrop {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(10,22,18,0.72);
          backdrop-filter: blur(6px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 640px) { .sm-backdrop { align-items: center; } }
        .sm-sheet {
          background: #0f2d22;
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: 20px 20px 0 0;
          width: 100%; max-width: 540px;
          max-height: 92svh; overflow-y: auto;
          box-shadow: 0 -16px 60px rgba(0,0,0,0.6);
        }
        @media (min-width: 640px) {
          .sm-sheet { border-radius: 20px; max-height: 86svh; }
        }
        .sm-sheet__img {
          position: relative; height: 220px; background: #1a3c2e;
        }
        .sm-sheet__img-fade {
          position: absolute; inset: 0;
          background: linear-gradient(to top, #0f2d22 0%, transparent 55%);
        }
        .sm-sheet__close {
          position: absolute; top: 12px; right: 12px; z-index: 2;
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(0,0,0,0.5); color: white; border: none;
          cursor: pointer; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .sm-sheet__img-badge {
          position: absolute; bottom: 12px; left: 16px; z-index: 2;
          background: var(--color-gold, #c9a96e); color: #0d2b22;
          border-radius: 999px; padding: 3px 10px;
          font-size: 0.65rem; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .sm-sheet__img-fallback {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 4rem;
        }
        .sm-sheet__body { padding: 20px 22px 24px; }
        .sm-sheet__name {
          font-family: var(--font-serif, Georgia, serif);
          font-size: 1.5rem; font-weight: 400;
          color: var(--color-ivory, #faf8f4); margin: 0 0 8px;
        }
        .sm-sheet__desc {
          font-size: 0.85rem; color: rgba(250,248,244,0.55);
          line-height: 1.65; margin: 0 0 14px;
        }
        .sm-sheet__chips {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap; margin-bottom: 20px;
        }
        .sm-sheet__price {
          font-size: 1.3rem; font-weight: 800;
          color: var(--color-gold, #c9a96e);
        }
        .sm-chip {
          font-size: 0.72rem; color: rgba(250,248,244,0.45);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px; padding: 3px 10px;
        }
        .sm-mods { margin-bottom: 18px; }
        .sm-mods__title {
          font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(250,248,244,0.45);
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 10px;
        }
        .sm-mods__req {
          background: rgba(201,169,110,0.15); color: var(--color-gold, #c9a96e);
          border-radius: 999px; padding: 2px 8px;
          font-size: 0.65rem; text-transform: none; letter-spacing: 0;
        }
        .sm-mods__opts { display: flex; gap: 8px; flex-wrap: wrap; }
        .sm-mod-opt {
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 999px; background: rgba(255,255,255,0.04);
          color: rgba(250,248,244,0.7);
          font-size: 0.82rem; padding: 8px 14px;
          cursor: pointer; transition: all 0.16s;
          display: flex; align-items: center; gap: 6px;
        }
        .sm-mod-opt:hover { border-color: var(--color-gold, #c9a96e); color: var(--color-ivory, #faf8f4); }
        .sm-mod-opt.active {
          background: rgba(201,169,110,0.18); border-color: var(--color-gold, #c9a96e);
          color: var(--color-ivory, #faf8f4); font-weight: 700;
        }
        .sm-mod-opt__extra { color: var(--color-gold, #c9a96e); font-weight: 700; font-size: 0.72rem; }
        .sm-notes { display: block; margin-top: 16px; }
        .sm-notes > span {
          display: block; font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(250,248,244,0.4); margin-bottom: 8px;
        }
        .sm-notes__box {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
          color: var(--color-ivory, #faf8f4);
          font-size: 0.85rem; font-family: inherit;
          padding: 10px 14px; resize: none; outline: none;
          transition: border-color 0.16s;
        }
        .sm-notes__box:focus { border-color: var(--color-gold, #c9a96e); }
        .sm-notes__box::placeholder { color: rgba(250,248,244,0.25); }
        .sm-sheet__footer {
          display: flex; align-items: center; gap: 14px; margin-top: 20px;
        }
        .sm-qty { display: flex; align-items: center; gap: 10px; }
        .sm-qty__btn {
          width: 38px; height: 38px; border-radius: 50%;
          border: 1.5px solid rgba(201,169,110,0.4);
          background: rgba(201,169,110,0.08);
          color: var(--color-gold, #c9a96e);
          cursor: pointer; font-size: 1.2rem;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sm-qty__btn:hover { background: var(--color-gold, #c9a96e); color: #0d2b22; }
        .sm-qty__n {
          font-size: 1.1rem; font-weight: 800;
          color: var(--color-ivory, #faf8f4); min-width: 28px; text-align: center;
        }
        .sm-sheet__add {
          flex: 1; display: flex; justify-content: space-between; align-items: center;
          background: var(--color-gold, #c9a96e); border: none;
          border-radius: 12px; padding: 13px 18px;
          cursor: pointer; transition: all 0.18s;
          box-shadow: 0 4px 20px rgba(201,169,110,0.35);
        }
        .sm-sheet__add:hover {
          background: #d4b87a;
          box-shadow: 0 6px 28px rgba(201,169,110,0.5);
          transform: translateY(-1px);
        }
        .sm-sheet__add span { font-weight: 800; font-size: 0.95rem; color: #0d2b22; }
        .sm-sheet__add-price { font-weight: 800; color: #0d2b22; }
      `}</style>
    </div>
  );
}
