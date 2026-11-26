'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import type {
  CommerceStore, CommerceMenu, CommerceCategory,
  CommerceProduct, CommerceModifierOption,
} from '@/lib/commerce';

interface Props {
  store: CommerceStore | null;
  menus: CommerceMenu[];
  experience?: 'restaurant' | 'outdoor';
}

function fmt(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

// ─── Product Detail Drawer ────────────────────────────────────────────────────
function ProductDrawer({
  product, currency, onClose, onAdd,
}: {
  product: CommerceProduct;
  currency: string;
  onClose: () => void;
  onAdd: (product: CommerceProduct, qty: number, mods: CommerceModifierOption[], notes: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const modifierPrice = product.modifierGroups
    .flatMap(g => g.options)
    .filter(o => Object.values(selectedMods).includes(o.id))
    .reduce((s, o) => s + o.priceAdjustment, 0);

  const totalPrice = (product.price + modifierPrice) * qty;

  function toggleMod(groupId: string, optId: string) {
    setSelectedMods(prev => ({ ...prev, [groupId]: optId }));
  }

  function handleAdd() {
    const mods = product.modifierGroups
      .flatMap(g => g.options)
      .filter(o => Object.values(selectedMods).includes(o.id));
    onAdd(product, qty, mods, notes);
    onClose();
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        {product.imageUrl && (
          <div className="drawer-img-wrap">
            <Image src={product.imageUrl} alt={product.name} fill style={{ objectFit: 'cover' }} sizes="600px" />
          </div>
        )}
        <div className="drawer-body">
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
          <h2 className="drawer-title">{product.name}</h2>
          {product.description && <p className="drawer-desc">{product.description}</p>}
          <div className="drawer-meta">
            <span className="drawer-price">{fmt(product.price, currency)}</span>
            {product.calories && <span className="drawer-cal">{product.calories} kcal</span>}
            {product.prepTimeMinutes && <span className="drawer-time">~{product.prepTimeMinutes} min</span>}
          </div>

          {product.modifierGroups.map(group => (
            <div key={group.id} className="mod-group">
              <p className="mod-group-title">{group.name}{group.isRequired && <span className="mod-required"> Required</span>}</p>
              {group.options.map(opt => (
                <label key={opt.id} className="mod-option">
                  <input
                    type="radio"
                    name={group.id}
                    value={opt.id}
                    checked={selectedMods[group.id] === opt.id}
                    onChange={() => toggleMod(group.id, opt.id)}
                  />
                  <span className="mod-name">{opt.name}</span>
                  {opt.priceAdjustment > 0 && <span className="mod-price">+{fmt(opt.priceAdjustment, currency)}</span>}
                </label>
              ))}
            </div>
          ))}

          <label className="notes-label">
            Special instructions
            <textarea
              className="notes-input"
              placeholder="e.g. No onions, extra spicy…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </label>

          <div className="drawer-footer">
            <div className="qty-ctrl">
              <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="qty-val">{qty}</span>
              <button className="qty-btn" onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <button className="btn-add-cart" onClick={handleAdd}>
              Add to order — {fmt(totalPrice, currency)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating Cart Pill ───────────────────────────────────────────────────────
function CartPill({ currency }: { currency: string }) {
  const { itemCount, subtotal } = useCart();
  if (itemCount === 0) return null;
  return (
    <div className="cart-pill">
      <span className="cart-badge">{itemCount}</span>
      <span className="cart-label">View Order</span>
      <span className="cart-total">{fmt(subtotal, currency)}</span>
      <Link href="/order" className="cart-pill-link" aria-label="Go to checkout" />
    </div>
  );
}

// ─── Main dining client ───────────────────────────────────────────────────────
export function DiningClient({ store, menus, experience = 'restaurant' }: Props) {
  const { addItem } = useCart();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CommerceProduct | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement>>({});

  const allCategories: (CommerceCategory & { menuName: string })[] = menus.flatMap(menu =>
    menu.categories.map(cat => ({ ...cat, menuName: menu.name }))
  );

  // Set first category active on load
  useEffect(() => {
    if (allCategories.length > 0 && !activeCategory) {
      setActiveCategory(allCategories[0].id);
    }
  }, [allCategories.length]);

  function scrollToCategory(id: string) {
    setActiveCategory(id);
    categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const currency = store?.currency ?? 'NGN';
  const isOutdoor = experience === 'outdoor';

  return (
    <div className={`dining-page${isOutdoor ? ' outdoor-service-page' : ''}`}>
      {/* ── Hero ── */}
      <section className="dining-hero">
        <div className="dining-hero__overlay" />
        <Image
          src={isOutdoor ? '/images/pool-evening.jpg' : '/images/restaurant.jpg'}
          alt={isOutdoor ? 'Stanzel Grand Resort poolside at evening' : 'Stanzel Grand Resort restaurant'}
          fill priority
          style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
          sizes="100vw"
        />
        <div className="container dining-hero__content">
          <p className="eyebrow" style={{ color: 'var(--color-gold)' }}>{isOutdoor ? 'Poolside & Outdoor Service' : 'Culinary Experience'}</p>
          <h1 style={{ color: 'var(--color-ivory)' }}>{isOutdoor ? 'Dine Under the Open Sky' : 'Restaurant & Bar'}</h1>
          <p className="dining-hero__sub">
            {isOutdoor ? 'Fresh food, chilled drinks and effortless service delivered to your poolside table or outdoor space.' : 'Nigerian warmth, international precision — order online for pickup or delivery.'}
          </p>
          {store?.status === 'ACTIVE' ? (
            <span className="store-badge open">● Open Now</span>
          ) : (
            <span className="store-badge closed">● Temporarily Closed</span>
          )}
        </div>
      </section>

      {menus.length === 0 ? (
        // Fallback when menu isn't loaded (store offline / draft)
        <section className="section">
          <div className="container" style={{ textAlign: 'center', paddingBlock: '5rem' }}>
            <p style={{ fontSize: 'var(--text-xl)', color: 'var(--color-muted)' }}>
              Our online menu is currently unavailable. Please call us or visit in person.
            </p>
          </div>
        </section>
      ) : (
        <div className="dining-layout">
          {/* ── Category sidebar ── */}
          <nav className="cat-sidebar" aria-label="Menu categories">
            <p className="cat-sidebar__title">{isOutdoor ? 'Outdoor Menu' : 'Menu'}</p>
            {allCategories.map(cat => (
              <button
                key={cat.id}
                className={`cat-btn${activeCategory === cat.id ? ' active' : ''}`}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </nav>

          {/* ── Product grid ── */}
          <div className="product-feed">
            {store?.minimumOrderAmount ? (
              <p className="min-order-note">Minimum order: {fmt(store.minimumOrderAmount, currency)}</p>
            ) : null}

            {allCategories.map(cat => (
              <section
                key={cat.id}
                ref={el => { if (el) categoryRefs.current[cat.id] = el; }}
                className="cat-section"
              >
                <h2 className="cat-section__title">{cat.name}</h2>
                {cat.description && <p className="cat-section__desc">{cat.description}</p>}
                <div className="product-grid">
                  {cat.products.map(product => (
                    <button
                      key={product.id}
                      className={`product-card${!product.isAvailable ? ' unavailable' : ''}`}
                      onClick={() => product.isAvailable && setSelectedProduct(product)}
                      aria-disabled={!product.isAvailable}
                    >
                      <div className="product-card__img">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} fill sizes="260px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div className="product-card__img-placeholder">🍽</div>
                        )}
                        {!product.isAvailable && <div className="product-card__sold-out">Sold Out</div>}
                      </div>
                      <div className="product-card__body">
                        <p className="product-card__name">{product.name}</p>
                        {product.description && (
                          <p className="product-card__desc">{product.description}</p>
                        )}
                        <div className="product-card__footer">
                          <span className="product-card__price">{fmt(product.price, currency)}</span>
                          {product.isAvailable && (
                            <span className="product-card__add" aria-hidden>+</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* ── Product detail drawer ── */}
      {selectedProduct && (
        <ProductDrawer
          product={selectedProduct}
          currency={currency}
          onClose={() => setSelectedProduct(null)}
          onAdd={(p, qty, mods, notes) => { addItem(p, qty, mods, notes); }}
        />
      )}

      {/* ── Cart pill ── */}
      <CartPill currency={currency} />

      <style>{`
        /* ── Layout ── */
        .dining-page { background: var(--bg); min-height: 100vh; }
        .outdoor-service-page { background: #f6f2e9; }
        .outdoor-service-page .dining-hero__overlay { background: linear-gradient(to top, rgba(8,35,31,0.94) 0%, rgba(8,35,31,0.12) 65%); }
        .outdoor-service-page .product-feed { background: rgba(255,255,255,0.42); border-radius: var(--radius-2xl); padding: var(--space-8); }

        .dining-hero {
          position: relative; height: 540px;
          display: flex; align-items: flex-end;
        }
        .dining-hero__overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(16,38,32,0.92) 0%, rgba(16,38,32,0.15) 60%);
          z-index: 1;
        }
        .dining-hero__content { position: relative; z-index: 2; padding-bottom: var(--space-16); }
        .dining-hero__sub { color: rgba(250,248,244,0.82); font-size: var(--text-lg); max-width: 480px; margin-top: var(--space-4); }

        .store-badge { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); font-weight: 600; padding: 6px 14px; border-radius: 999px; margin-top: var(--space-5); }
        .store-badge.open { background: rgba(16,185,129,0.2); color: #6ee7b7; }
        .store-badge.closed { background: rgba(239,68,68,0.2); color: #fca5a5; }

        .dining-layout { display: grid; grid-template-columns: 220px 1fr; gap: var(--space-10); max-width: 1200px; margin: 0 auto; padding: var(--space-12) var(--space-6); }
        @media (max-width: 768px) { .dining-layout { grid-template-columns: 1fr; } }

        /* ── Category Sidebar ── */
        .cat-sidebar { position: sticky; top: 90px; align-self: start; display: flex; flex-direction: column; gap: 4px; }
        .cat-sidebar__title { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-muted); margin-bottom: var(--space-3); }
        .cat-btn { text-align: left; background: none; border: none; padding: 10px 14px; border-radius: var(--radius-lg); font-size: var(--text-sm); color: var(--color-black); cursor: pointer; transition: all 0.18s; }
        .cat-btn:hover { background: var(--color-ivory-dark); }
        .cat-btn.active { background: var(--color-green); color: var(--color-ivory); font-weight: 600; }
        @media (max-width: 768px) { .cat-sidebar { flex-direction: row; overflow-x: auto; gap: 8px; position: static; padding-bottom: var(--space-4); } }

        /* ── Product Grid ── */
        .min-order-note { font-size: var(--text-sm); color: var(--color-muted); margin-bottom: var(--space-6); padding: 10px 14px; background: var(--color-ivory-dark); border-radius: var(--radius-lg); }
        .cat-section { margin-bottom: var(--space-12); scroll-margin-top: 90px; }
        .cat-section__title { font-family: var(--font-serif); font-size: var(--text-3xl); color: var(--color-green); margin-bottom: var(--space-2); }
        .cat-section__desc { color: var(--color-muted); font-size: var(--text-sm); margin-bottom: var(--space-6); }

        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-5); }

        .product-card { background: white; border: 1px solid var(--color-border); border-radius: var(--radius-2xl); overflow: hidden; cursor: pointer; text-align: left; transition: transform 0.18s, box-shadow 0.18s; }
        .product-card:hover:not(.unavailable) { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
        .product-card.unavailable { opacity: 0.5; cursor: default; }

        .product-card__img { position: relative; height: 160px; background: var(--color-ivory-dark); }
        .product-card__img-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 2.5rem; }
        .product-card__sold-out { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: var(--text-sm); font-weight: 700; }

        .product-card__body { padding: 14px 16px; }
        .product-card__name { font-weight: 600; font-size: var(--text-base); color: var(--color-black); margin-bottom: 4px; }
        .product-card__desc { font-size: var(--text-sm); color: var(--color-muted); margin-bottom: var(--space-3); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .product-card__footer { display: flex; align-items: center; justify-content: space-between; }
        .product-card__price { font-weight: 700; color: var(--color-green); font-size: var(--text-base); }
        .product-card__add { width: 28px; height: 28px; background: var(--color-green); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; line-height: 1; }

        /* ── Drawer ── */
        .drawer-overlay { position: fixed; inset: 0; background: rgba(16,38,32,0.6); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 640px) { .drawer-overlay { align-items: center; } }

        .drawer { background: white; border-radius: var(--radius-2xl) var(--radius-2xl) 0 0; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; }
        @media (min-width: 640px) { .drawer { border-radius: var(--radius-2xl); max-height: 88vh; } }

        .drawer-img-wrap { position: relative; height: 220px; }
        .drawer-body { padding: var(--space-6) var(--space-6) var(--space-10); position: relative; }
        .drawer-close { position: absolute; top: 16px; right: 16px; background: var(--color-ivory-dark); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; color: var(--color-black); }
        .drawer-title { font-family: var(--font-serif); font-size: var(--text-3xl); color: var(--color-green); margin-bottom: var(--space-2); padding-right: 40px; }
        .drawer-desc { color: var(--color-muted); font-size: var(--text-sm); margin-bottom: var(--space-4); }
        .drawer-meta { display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6); }
        .drawer-price { font-size: var(--text-xl); font-weight: 700; color: var(--color-green); }
        .drawer-cal, .drawer-time { font-size: var(--text-xs); color: var(--color-muted); background: var(--color-ivory-dark); padding: 3px 8px; border-radius: 999px; }

        .mod-group { margin-bottom: var(--space-5); }
        .mod-group-title { font-weight: 600; font-size: var(--text-sm); margin-bottom: var(--space-2); color: var(--color-black); }
        .mod-required { color: var(--color-gold-dark); font-weight: 400; margin-left: 6px; font-size: var(--text-xs); }
        .mod-option { display: flex; align-items: center; gap: var(--space-3); padding: 8px 0; border-bottom: 1px solid var(--color-border); cursor: pointer; }
        .mod-option:last-child { border-bottom: none; }
        .mod-name { flex: 1; font-size: var(--text-sm); }
        .mod-price { font-size: var(--text-xs); color: var(--color-green); font-weight: 600; }

        .notes-label { display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--color-black); margin-top: var(--space-4); }
        .notes-input { border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-3); font-size: var(--text-sm); font-family: var(--font-sans); resize: none; outline: none; }
        .notes-input:focus { border-color: var(--color-green); }

        .drawer-footer { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-6); }
        .qty-ctrl { display: flex; align-items: center; gap: var(--space-3); }
        .qty-btn { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--color-green); background: white; cursor: pointer; font-size: 1.1rem; color: var(--color-green); display: flex; align-items: center; justify-content: center; }
        .qty-btn:hover { background: var(--color-green); color: white; }
        .qty-val { width: 32px; text-align: center; font-weight: 700; font-size: var(--text-lg); }
        .btn-add-cart { flex: 1; background: var(--color-green); color: var(--color-ivory); border: none; padding: var(--space-3) var(--space-6); border-radius: var(--radius-lg); font-weight: 700; font-size: var(--text-base); cursor: pointer; transition: background 0.18s; }
        .btn-add-cart:hover { background: var(--color-green-dark); }

        /* ── Cart Pill ── */
        .cart-pill {
          position: fixed; bottom: var(--space-6); left: 50%; transform: translateX(-50%);
          background: var(--color-green); color: var(--color-ivory);
          display: flex; align-items: center; gap: var(--space-4);
          padding: 14px 24px; border-radius: 999px;
          box-shadow: var(--shadow-xl); z-index: 100;
          cursor: pointer; animation: pillEntry 0.3s ease;
          white-space: nowrap;
        }
        .cart-pill-link { position: absolute; inset: 0; }
        @keyframes pillEntry { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .cart-badge { background: var(--color-gold); color: var(--color-green); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 800; }
        .cart-label { font-weight: 600; font-size: var(--text-sm); }
        .cart-total { font-weight: 700; font-size: var(--text-base); margin-left: auto; }
      `}</style>
    </div>
  );
}
