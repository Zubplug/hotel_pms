'use client';

/**
 * Stanzel Grand Resort — Outdoor & Poolside Food & Beverage Ordering
 *
 * Design language: "Golden Hour Luxury"
 * ─ Dark emerald canvas (#0d2b22) with radial warm-gold ambient glow
 * ─ Cormorant Garamond serif headings + Inter body
 * ─ Hexagonal food photography cards with floating lift on hover
 * ─ Horizontal scrolling pill-chip category nav with emoji accents
 * ─ Glassmorphism cart drawer (desktop) + animated golden cart pill (mobile)
 * ─ Micro-animations: shimmer skeletons, card float, pill bounce, drawer slide
 */

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import type {
  CommerceStore, CommerceMenu, CommerceCategory,
  CommerceProduct, CommerceModifierOption,
  CommercePromotionSummary,
} from '@/lib/commerce';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, cur = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: cur, minimumFractionDigits: 0,
  }).format(n);
}

const CATEGORY_ICONS: Record<string, string> = {
  'Guest Complementary Food': '🎁',
  'Nigerian Main Course': '🍲',
  'Special Orders': '⭐',
  'Rice & Pasta': '🍚',
  'Nigerian Extras (Sides & Add-ons)': '🥘',
  'Continental & Breakfast': '🥐',
  'Desserts & Snacks': '🍰',
  Salads: '🥗',
  'Nigerian Hot Starter': '🌶',
  'Wines & Champagnes': '🍷',
  'Spirits & Rum': '🥃',
  'Soft Drinks & Water': '🥤',
  'Beers & Ciders (Lager)': '🍺',
  'Whiskey, Brandy, Gin & Vodka': '🥃',
  Liqueurs: '🍸',
};

function categoryIcon(name: string) {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase().split(' ')[0])) return icon;
  }
  return '🍽';
}

// ─── Product Detail Sheet ─────────────────────────────────────────────────────

function ProductSheet({
  product, currency, onClose, onAdd,
}: {
  product: CommerceProduct;
  currency: string;
  onClose: () => void;
  onAdd: (p: CommerceProduct, qty: number, mods: CommerceModifierOption[]) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedMods, setSelectedMods] = useState<Record<string, string>>({});

  const modifierPrice = product.modifierGroups
    .flatMap(g => g.options)
    .filter(o => Object.values(selectedMods).includes(o.id))
    .reduce((s, o) => s + o.priceAdjustment, 0);

  const lineTotal = (product.price + modifierPrice) * qty;

  return (
    <div className="os-sheet-backdrop" onClick={onClose}>
      <div className="os-sheet" onClick={e => e.stopPropagation()}>
        {/* Product image */}
        <div className="os-sheet__img">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl} alt={product.name}
              fill style={{ objectFit: 'cover' }} sizes="600px"
            />
          ) : (
            <div className="os-sheet__img-placeholder">🍽</div>
          )}
          <div className="os-sheet__img-gradient" />
          <button className="os-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          <div className="os-sheet__img-label">
            <span className="os-sheet__badge">Outdoor Service</span>
          </div>
        </div>

        <div className="os-sheet__body">
          <h2 className="os-sheet__title">{product.name}</h2>

          {product.description && (
            <p className="os-sheet__desc">{product.description}</p>
          )}

          <div className="os-sheet__meta">
            <span className="os-sheet__price-base">{fmt(product.price, currency)}</span>
            {product.calories && (
              <span className="os-sheet__pill">{product.calories} kcal</span>
            )}
            {product.prepTimeMinutes && (
              <span className="os-sheet__pill">⏱ ~{product.prepTimeMinutes} min</span>
            )}
          </div>

          {/* Modifiers */}
          {product.modifierGroups.map(group => (
            <div key={group.id} className="os-mod-group">
              <p className="os-mod-group__label">
                {group.name}
                {group.isRequired && <span className="os-mod-group__req">Required</span>}
              </p>
              <div className="os-mod-options">
                {group.options.map(opt => (
                  <button
                    key={opt.id}
                    className={`os-mod-opt${selectedMods[group.id] === opt.id ? ' selected' : ''}`}
                    onClick={() => setSelectedMods(p => ({ ...p, [group.id]: opt.id }))}
                  >
                    {opt.name}
                    {opt.priceAdjustment > 0 && (
                      <span className="os-mod-opt__price">+{fmt(opt.priceAdjustment, currency)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="os-sheet__footer">
            <div className="os-qty">
              <button className="os-qty__btn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="os-qty__val">{qty}</span>
              <button className="os-qty__btn" onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <button
              className="os-sheet__add-btn"
              onClick={() => {
                const mods = product.modifierGroups.flatMap(g => g.options).filter(o => Object.values(selectedMods).includes(o.id));
                onAdd(product, qty, mods);
                onClose();
              }}
            >
              <span>Add to Order</span>
              <span className="os-sheet__add-price">{fmt(lineTotal, currency)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating Cart ────────────────────────────────────────────────────────────

function FloatingCart({ currency }: { currency: string }) {
  const { state, updateQty, subtotal, itemCount, clearCart } = useCart();
  const [open, setOpen] = useState(false);

  if (itemCount === 0) return null;

  return (
    <>
      {/* Cart pill — always visible at bottom */}
      <button
        className="os-cart-pill"
        onClick={() => setOpen(true)}
        aria-label="Open cart"
      >
        <span className="os-cart-pill__badge">{itemCount}</span>
        <span className="os-cart-pill__icon">🛒</span>
        <span className="os-cart-pill__label">View Order</span>
        <span className="os-cart-pill__total">{fmt(subtotal, currency)}</span>
      </button>

      {/* Cart drawer */}
      {open && (
        <div className="os-cart-backdrop" onClick={() => setOpen(false)}>
          <div className="os-cart-drawer" onClick={e => e.stopPropagation()}>
            <div className="os-cart-drawer__header">
              <h3>Your Order</h3>
              <button className="os-cart-drawer__close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="os-cart-items">
              {state.items.map(item => (
                <div key={item.id} className="os-cart-item">
                  <div className="os-cart-item__info">
                    <p className="os-cart-item__name">{item.productName}</p>
                    {item.modifierLabels.length > 0 && (
                      <p className="os-cart-item__mods">{item.modifierLabels.join(', ')}</p>
                    )}
                  </div>
                  <div className="os-cart-item__ctrl">
                    <button className="os-cart-item__btn" onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button className="os-cart-item__btn" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <span className="os-cart-item__price">{fmt(item.unitPrice * item.quantity, currency)}</span>
                </div>
              ))}
            </div>

            <div className="os-cart-total">
              <span>Total</span>
              <span className="os-cart-total__val">{fmt(subtotal, currency)}</span>
            </div>

            <Link href="/order" className="os-cart-checkout-btn" onClick={() => setOpen(false)}>
              Proceed to Checkout →
            </Link>

            <button className="os-cart-clear" onClick={() => { clearCart(); setOpen(false); }}>
              Clear order
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  store: CommerceStore | null;
  menus: CommerceMenu[];
  promotions: CommercePromotionSummary[];
}

type FlatCategory = CommerceCategory & { menuName: string };

export function OutdoorServiceClient({ store, menus, promotions }: Props) {
  const { addItem } = useCart();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CommerceProduct | null>(null);
  const [search, setSearch] = useState('');
  const catNavRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  const allCategories: FlatCategory[] = menus.flatMap(m =>
    m.categories.map(c => ({ ...c, menuName: m.name }))
  );

  const currency = store?.currency ?? 'NGN';

  // Set first category active on mount
  useEffect(() => {
    if (allCategories.length > 0 && !activeId) {
      setActiveId(allCategories[0].id);
    }
  }, [allCategories.length]);

  // Intersection observer — highlight active category as user scrolls
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) setActiveId(e.target.id);
      }
    }, { rootMargin: '-20% 0px -70% 0px' });

    Object.values(sectionRefs.current).forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [allCategories.length]);

  const scrollToCategory = useCallback((id: string) => {
    setActiveId(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Scroll the cat nav so active pill is centered
    const btn = catNavRef.current?.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  // Filter products by search
  const selectedCategory = allCategories.find(cat => cat.id === activeId) ?? allCategories[0];
  const selectedProducts = selectedCategory
    ? selectedCategory.products.filter(product => {
      const query = search.trim().toLowerCase();
      return !query
        || product.name.toLowerCase().includes(query)
        || (product.description ?? '').toLowerCase().includes(query);
    })
    : [];

  // Keep the API as the source of truth: explicitly featured products lead,
  // followed by the best-selling available items when the catalogue has not
  // been curated yet.
  const featuredProducts: CommerceProduct[] = allCategories
    .flatMap(c => c.products)
    .filter(p => p.isAvailable)
    .sort((a, b) => {
      const featuredDelta = Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
      return featuredDelta || (b.soldCount ?? 0) - (a.soldCount ?? 0);
    })
    .slice(0, 4);

  const bestSellingProducts = allCategories
    .flatMap(c => c.products)
    .filter(p => p.isAvailable)
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, 6);

  return (
    <div className="os-page">
      {/* Compact ordering header — the menu remains the primary experience. */}
      <section className="os-order-header" aria-labelledby="outdoor-order-title">
        <div>
          <p className="os-order-header__eyebrow">Stanzel Outdoor Service</p>
          <h1 id="outdoor-order-title">Food, drinks &amp; bar service, wherever you are.</h1>
          <p>Choose from the kitchen and bar menu, then tell us your poolside or outdoor service point at checkout.</p>
        </div>
        <div className={`os-order-header__status${store?.status === 'ACTIVE' ? ' is-active' : ''}`}>
          <span /> {store?.status === 'ACTIVE' ? 'Taking orders' : 'Temporarily closed'}
        </div>
      </section>

      {promotions.length > 0 && (
        <section className="os-promos" aria-label="Current offers">
          <div className="os-promos__intro">
            <span className="os-promos__spark">✦</span>
            <div>
              <p className="os-promos__eyebrow">Today at Stanzel</p>
              <h2 className="os-promos__title">Offers made for the open air</h2>
            </div>
          </div>
          <div className="os-promos__list">
            {promotions.map(promo => (
              <div className="os-promo-card" key={promo.id}>
                <span className="os-promo-card__type">{promo.type === 'PERCENTAGE' ? `${promo.value}% OFF` : 'SPECIAL OFFER'}</span>
                <strong>{promo.name}</strong>
                <span>Use code <b>{promo.code}</b>{promo.minimumOrderAmount ? ` · min. ${fmt(promo.minimumOrderAmount, currency)}` : ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ MARQUEE STRIP ══════════════════════════════════════════════════ */}
      <div className="os-marquee" aria-hidden>
        <div className="os-marquee__track">
          {['Poolside Service', 'Cabana Delivery', 'Garden Terrace', 'No App Required',
            'Nigerian & Continental', 'Premium Bar Service', 'Poolside Service',
            'Cabana Delivery', 'Garden Terrace', 'No App Required',
            'Nigerian & Continental', 'Premium Bar Service'].map((t, i) => (
            <span key={i} className="os-marquee__item">
              <span className="os-marquee__dot">✦</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ FEATURED DISHES ════════════════════════════════════════════════ */}
      {featuredProducts.length > 0 && (
        <section className="os-featured">
          <div className="os-featured__header">
            <div>
              <p className="os-featured__eyebrow">Featured menu</p>
              <h2 className="os-featured__title">Made for the moment</h2>
              <div className="os-gold-rule" />
            </div>
            <button
              className="os-featured__see-all"
              onClick={() => document.getElementById('os-menu')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Full Menu ↓
            </button>
          </div>
          <div className="os-featured__grid">
            {featuredProducts.map((product, idx) => (
              <button
                key={product.id}
                className={`os-featured-card${idx === 0 ? ' os-featured-card--large' : ''}`}
                onClick={() => product.isAvailable && setSelectedProduct(product)}
              >
                <div className="os-featured-card__img">
                  <Image
                    src={product.imageUrl!} alt={product.name}
                    fill style={{ objectFit: 'cover' }}
                    sizes={idx === 0 ? '600px' : '300px'}
                  />
                  <div className="os-featured-card__img-overlay" />
                </div>
                <div className="os-featured-card__body">
                  <div className="os-featured-card__meta">
                    {product.prepTimeMinutes && (
                      <span className="os-featured-card__time">⏱ {product.prepTimeMinutes} min</span>
                    )}
                    <span className="os-featured-card__price">{fmt(product.price, currency)}</span>
                  </div>
                  <p className="os-featured-card__name">{product.name}</p>
                  <span className="os-featured-card__add" aria-hidden>
                    <span>+</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {bestSellingProducts.length > 0 && (
        <section className="os-bestsellers">
          <div className="os-bestsellers__header">
            <div>
              <p className="os-featured__eyebrow">Loved by guests</p>
              <h2 className="os-featured__title">Best sellers</h2>
            </div>
            <span className="os-bestsellers__note">Popular choices, ready to order</span>
          </div>
          <div className="os-bestsellers__grid">
            {bestSellingProducts.map(product => (
              <button key={product.id} className="os-bestseller-card" onClick={() => setSelectedProduct(product)}>
                <span className="os-bestseller-card__image">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt="" fill sizes="220px" style={{ objectFit: 'cover' }} />
                  ) : <span aria-hidden>🍽</span>}
                </span>
                <span className="os-bestseller-card__content">
                  <span className="os-bestseller-card__rank">★ Popular</span>
                  <span className="os-bestseller-card__name">{product.name}</span>
                  <span className="os-bestseller-card__price">{fmt(product.price, currency)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══ MENU SECTION ═══════════════════════════════════════════════════ */}
      <section id="os-menu" className="os-menu-section">
        {/* Category nav */}
        <nav className="os-cat-nav" ref={catNavRef} aria-label="Menu categories">
          {allCategories.map((cat, idx) => (
            <button
              key={cat.id}
              data-id={cat.id}
              className={`os-cat-pill${activeId === cat.id ? ' active' : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              <span className="os-cat-pill__icon">{categoryIcon(cat.name)}</span>
              <span className="os-cat-pill__num">{String(idx + 1).padStart(2, '0')}</span>
              <span className="os-cat-pill__name">{cat.name}</span>
            </button>
          ))}
        </nav>

        {/* Product grid */}
        <div className="os-menu-body">
          {!selectedCategory || selectedProducts.length === 0 ? (
            <div className="os-no-results">
              <p>{search ? `No items match “${search}” in ${selectedCategory?.name ?? 'this category'}.` : 'This category has no available items.'}</p>
              <button className="os-no-results__clear" onClick={() => setSearch('')}>Clear search</button>
            </div>
          ) : (
            <section
              key={selectedCategory.id}
              id={selectedCategory.id}
              ref={el => { if (el) sectionRefs.current[selectedCategory.id] = el; }}
              className="os-category"
            >
              <div className="os-category__header">
                <div className="os-category__icon-wrap" aria-hidden>
                  {categoryIcon(selectedCategory.name)}
                </div>
                <div>
                  <h2 className="os-category__title">{selectedCategory.name}</h2>
                </div>
                <div className="os-category__search">
                  <span aria-hidden>⌕</span>
                  <input
                    type="search"
                    placeholder="Search this category"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label={`Search ${selectedCategory.name}`}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Clear category search">✕</button>
                  )}
                </div>
              </div>

              <div className="os-product-grid">
                {selectedProducts.map(product => (
                  <button
                    key={product.id}
                    className={`os-product-card${!product.isAvailable ? ' os-product-card--unavailable' : ''}`}
                    onClick={() => product.isAvailable && setSelectedProduct(product)}
                    aria-disabled={!product.isAvailable}
                  >
                    {/* Hexagonal image container */}
                    <div className="os-product-card__hex-wrap">
                      <div className="os-product-card__hex">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl} alt={product.name}
                            fill style={{ objectFit: 'cover' }}
                            sizes="180px"
                          />
                        ) : (
                          <div className="os-product-card__hex-placeholder">
                            {categoryIcon(selectedCategory.name)}
                          </div>
                        )}
                        {!product.isAvailable && (
                          <div className="os-product-card__sold-out">Sold Out</div>
                        )}
                      </div>
                      <div className="os-product-card__hex-glow" />
                    </div>

                    <div className="os-product-card__body">
                      <p className="os-product-card__name">{product.name}</p>
                      {product.description && (
                        <p className="os-product-card__desc">{product.description}</p>
                      )}
                      <div className="os-product-card__footer">
                        <span className="os-product-card__price">{fmt(product.price, currency)}</span>
                        {product.isAvailable && (
                          <span className="os-product-card__add" aria-hidden>
                            <span>+</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════════ */}
      <section className="os-how">
        <div className="os-how__inner">
          <p className="os-how__eyebrow">Effortless Service</p>
          <h2 className="os-how__title">How It Works</h2>
          <div className="os-gold-rule" />
          <div className="os-how__steps">
            {[
              { n: '01', icon: '🛒', title: 'Browse & Order', desc: 'Choose from our full menu — food, drinks, and bar favourites.' },
              { n: '02', icon: '📍', title: 'Tell Us Where You Are', desc: 'Enter your cabana number, pool table or location at checkout.' },
              { n: '03', icon: '👨‍🍳', title: 'We Prepare Fresh', desc: 'Our kitchen and bar teams prepare your order.' },
              { n: '04', icon: '🍽', title: 'Delivered to You', desc: 'A member of staff brings it straight to your outdoor spot.' },
            ].map(step => (
              <div key={step.n} className="os-step">
                <div className="os-step__circle">
                  <span className="os-step__icon">{step.icon}</span>
                  <span className="os-step__num">{step.n}</span>
                </div>
                <div className="os-step__connector" />
                <h3 className="os-step__title">{step.title}</h3>
                <p className="os-step__desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRODUCT DETAIL SHEET ═══════════════════════════════════════════ */}
      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          currency={currency}
          onClose={() => setSelectedProduct(null)}
          onAdd={(p, qty, mods) => addItem(p, qty, mods)}
        />
      )}

      {/* ═══ FLOATING CART ══════════════════════════════════════════════════ */}
      <FloatingCart currency={currency} />

      {/* ═══ STYLES ═════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Base ── */
        .os-page {
          background: #0d2b22;
          color: var(--color-ivory);
          min-height: 100vh;
          font-family: var(--font-sans);
          overflow-x: hidden;
        }

        /* ── Hero ── */
        .os-hero {
          position: relative;
          min-height: 470px;
          height: min(62svh, 620px);
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .os-hero__overlay {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(
            135deg,
            rgba(10,22,18,0.92) 0%,
            rgba(13,43,34,0.7) 50%,
            rgba(10,22,18,0.75) 100%
          );
        }

        /* Particle sparkles */
        .os-hero__particles { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
        .os-particle {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: var(--color-gold);
          opacity: 0;
          animation: sparkle 4s ease-in-out infinite;
          animation-delay: calc(var(--i) * 0.35s);
          left: calc(var(--i) * 7% + 5%);
          top: calc(20% + (var(--i) * 4% - 2%));
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
          50% { opacity: 0.7; transform: translateY(-20px) scale(1.2); }
        }

        .os-hero__content {
          position: relative; z-index: 3;
          padding: 0 var(--space-8);
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
          width: 100%;
        }
        @media (min-width: 1024px) {
          .os-hero__content { margin-left: 10vw; }
        }

        .os-hero__eyebrow {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.18em;
          color: var(--color-gold); margin-bottom: var(--space-4);
        }
        .os-hero__dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--color-gold);
          box-shadow: 0 0 8px var(--color-gold);
          animation: pulse-dot 2s ease infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 8px var(--color-gold); }
          50% { box-shadow: 0 0 20px var(--color-gold), 0 0 40px rgba(201,169,110,0.4); }
        }

        .os-hero__title {
          font-family: var(--font-serif);
          font-size: clamp(2.8rem, 6vw, 5.5rem);
          font-weight: 300; line-height: 0.95;
          color: var(--color-ivory);
          margin-bottom: var(--space-6);
          letter-spacing: -0.02em;
        }
        .os-hero__title-em {
          font-style: italic;
          color: var(--color-gold);
          display: block;
        }

        .os-hero__sub {
          font-size: clamp(var(--text-base), 2vw, var(--text-lg));
          color: rgba(250,248,244,0.75);
          line-height: 1.65;
          margin-bottom: var(--space-10);
          max-width: 460px;
        }

        .os-hero__actions { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }

        .os-hero__cta {
          display: flex; align-items: center; gap: var(--space-3);
          background: var(--color-gold);
          color: #0d2b22;
          border: none; border-radius: 999px;
          padding: 14px 32px;
          font-weight: 800; font-size: var(--text-base);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(201,169,110,0.4);
          letter-spacing: 0.02em;
        }
        .os-hero__cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 36px rgba(201,169,110,0.6);
        }
        .os-hero__cta-arrow { font-size: 1.1rem; animation: bounce-y 1.6s ease infinite; }
        @keyframes bounce-y {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        .os-hero__status {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--text-sm); color: rgba(250,248,244,0.7);
        }
        .os-hero__status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 10px #4ade80;
        }

        /* Ambient floating cards */
        .os-hero__ambient {
          position: absolute; right: 5vw; bottom: 10%;
          z-index: 3; display: flex; flex-direction: column; gap: var(--space-3);
        }
        @media (max-width: 900px) { .os-hero__ambient { display: none; } }
        .os-ambient-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(201,169,110,0.25);
          border-radius: var(--radius-xl);
          padding: 12px 20px;
          display: flex; align-items: center; gap: var(--space-3);
          font-size: var(--text-sm); font-weight: 600;
          color: var(--color-ivory);
          animation: float-card 4s ease-in-out infinite;
        }
        .os-ambient-card--1 { animation-delay: 0s; }
        .os-ambient-card--2 { animation-delay: 0.8s; }
        .os-ambient-card--3 { animation-delay: 1.6s; }
        @keyframes float-card {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .os-ambient-card__emoji { font-size: 1.3rem; }

        /* ── Compact order header ── */
        .os-order-header {
          max-width: 1280px; margin: 0 auto; padding: var(--space-10) var(--space-6) var(--space-8);
          display: flex; align-items: end; justify-content: space-between; gap: var(--space-8);
          border-bottom: 1px solid rgba(201,169,110,0.18);
        }
        .os-order-header__eyebrow { color: var(--color-gold); font-size: var(--text-xs); font-weight: 800; letter-spacing: .16em; text-transform: uppercase; margin-bottom: var(--space-3); }
        .os-order-header h1 { max-width: 720px; font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 3.8rem); font-weight: 400; line-height: 1; }
        .os-order-header p:not(.os-order-header__eyebrow) { max-width: 620px; margin-top: var(--space-4); color: rgba(250,248,244,.64); line-height: 1.6; }
        .os-order-header__status { display: flex; align-items: center; gap: 8px; white-space: nowrap; color: rgba(250,248,244,.55); font-size: var(--text-sm); }
        .os-order-header__status span { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
        .os-order-header__status.is-active span { background: #4ade80; box-shadow: 0 0 10px #4ade80; }

        /* ── Promotions ── */
        .os-promos {
          max-width: 1280px; margin: 0 auto;
          padding: var(--space-10) var(--space-6) 0;
          display: grid; grid-template-columns: minmax(230px, 0.7fr) 1.3fr;
          gap: var(--space-8); align-items: center;
        }
        .os-promos__intro { display: flex; align-items: center; gap: var(--space-4); }
        .os-promos__spark {
          display: grid; place-items: center; width: 46px; height: 46px;
          border-radius: 50%; color: #0d2b22; background: var(--color-gold);
          font-size: 1.35rem;
        }
        .os-promos__eyebrow, .os-bestsellers__note {
          color: var(--color-gold); font-size: var(--text-xs); font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .os-promos__title { font-family: var(--font-serif); font-size: var(--text-2xl); font-weight: 400; }
        .os-promos__list { display: flex; gap: var(--space-3); overflow-x: auto; scrollbar-width: none; }
        .os-promos__list::-webkit-scrollbar { display: none; }
        .os-promo-card {
          min-width: 220px; padding: var(--space-4) var(--space-5);
          border: 1px solid rgba(201,169,110,0.3); border-radius: var(--radius-xl);
          background: linear-gradient(135deg, rgba(201,169,110,0.16), rgba(255,255,255,0.04));
          display: flex; flex-direction: column; gap: 4px;
        }
        .os-promo-card__type { color: var(--color-gold); font-size: 10px; font-weight: 800; letter-spacing: 0.14em; }
        .os-promo-card strong { color: var(--color-ivory); font-size: var(--text-sm); }
        .os-promo-card > span:last-child { color: rgba(250,248,244,0.62); font-size: var(--text-xs); }
        .os-promo-card b { color: var(--color-gold); letter-spacing: 0.08em; }

        /* ── Best sellers ── */
        .os-bestsellers { max-width: 1280px; margin: 0 auto; padding: 0 var(--space-6) var(--space-16); }
        .os-bestsellers__header { display: flex; justify-content: space-between; align-items: end; gap: var(--space-4); margin-bottom: var(--space-6); }
        .os-bestsellers__note { color: rgba(250,248,244,0.5); letter-spacing: 0.04em; text-transform: none; }
        .os-bestsellers__grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--space-3); }
        .os-bestseller-card {
          min-height: 220px; padding: 0; overflow: hidden; text-align: left; cursor: pointer;
          color: var(--color-ivory); background: rgba(255,255,255,0.055);
          border: 1px solid rgba(201,169,110,0.16); border-radius: var(--radius-xl);
          display: flex; flex-direction: column; justify-content: space-between;
          transition: transform .2s, border-color .2s, background .2s;
        }
        .os-bestseller-card:hover { transform: translateY(-4px); border-color: var(--color-gold); background: rgba(201,169,110,0.12); }
        .os-bestseller-card__image { position: relative; display: grid; place-items: center; height: 126px; overflow: hidden; background: rgba(201,169,110,.12); color: var(--color-gold); font-size: 2rem; }
        .os-bestseller-card__content { display: flex; flex-direction: column; gap: 5px; padding: var(--space-3) var(--space-4) var(--space-4); }
        .os-bestseller-card__rank { color: var(--color-gold); font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .os-bestseller-card__name { font-size: var(--text-sm); font-weight: 700; line-height: 1.3; }
        .os-bestseller-card__price { color: var(--color-gold); font-size: var(--text-sm); font-weight: 800; }
        @media (max-width: 900px) {
          .os-promos { grid-template-columns: 1fr; gap: var(--space-4); }
          .os-bestsellers__grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 600px) {
          .os-order-header { align-items: flex-start; flex-direction: column; gap: var(--space-4); padding-inline: var(--space-5); }
          .os-bestsellers__header { align-items: flex-start; flex-direction: column; }
          .os-bestsellers__grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* ── Marquee ── */
        .os-marquee {
          background: var(--color-gold);
          overflow: hidden;
          padding: var(--space-3) 0;
          border-top: 1px solid rgba(201,169,110,0.4);
          border-bottom: 1px solid rgba(201,169,110,0.4);
        }
        .os-marquee__track {
          display: flex; gap: var(--space-8);
          animation: marquee 25s linear infinite;
          width: max-content;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .os-marquee__item {
          display: flex; align-items: center; gap: var(--space-3);
          font-size: var(--text-sm); font-weight: 700;
          color: #0d2b22; white-space: nowrap; letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .os-marquee__dot { color: rgba(13,43,34,0.5); }

        /* ── Featured ── */
        .os-featured {
          padding: var(--space-20) var(--space-6);
          max-width: 1280px; margin: 0 auto;
        }
        .os-featured__header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: var(--space-10);
          flex-wrap: wrap; gap: var(--space-4);
        }
        .os-featured__eyebrow {
          font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.16em;
          color: var(--color-gold); margin-bottom: var(--space-2);
        }
        .os-featured__title {
          font-family: var(--font-serif);
          font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
          color: var(--color-ivory); font-weight: 300;
          letter-spacing: -0.01em;
        }
        .os-gold-rule {
          width: 60px; height: 2px;
          background: linear-gradient(90deg, var(--color-gold), transparent);
          margin-top: var(--space-4);
        }
        .os-featured__see-all {
          background: none; border: 1px solid rgba(201,169,110,0.4);
          color: var(--color-gold); border-radius: 999px;
          padding: 10px 24px; font-size: var(--text-sm); font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          white-space: nowrap;
        }
        .os-featured__see-all:hover {
          background: var(--color-gold); color: #0d2b22;
        }

        .os-featured__grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(2, 220px);
          gap: var(--space-4);
        }
        @media (max-width: 1024px) {
          .os-featured__grid { grid-template-columns: repeat(2, 1fr); grid-template-rows: auto; }
        }
        @media (max-width: 600px) {
          .os-featured__grid { grid-template-columns: 1fr; }
        }

        .os-featured-card {
          position: relative; overflow: hidden;
          border-radius: var(--radius-2xl);
          border: none; cursor: pointer;
          text-align: left;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .os-featured-card--large {
          grid-column: span 2;
          grid-row: span 2;
        }
        .os-featured-card:hover { transform: scale(1.02); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .os-featured-card__img { position: absolute; inset: 0; }
        .os-featured-card__img-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(10,22,18,0.92) 0%, rgba(10,22,18,0.1) 60%);
        }
        .os-featured-card__body {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: var(--space-5) var(--space-5) var(--space-4);
          z-index: 1;
        }
        .os-featured-card__meta {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-2);
        }
        .os-featured-card__time {
          font-size: var(--text-xs); color: rgba(250,248,244,0.6);
        }
        .os-featured-card__price {
          font-weight: 800; color: var(--color-gold);
          font-size: var(--text-base);
        }
        .os-featured-card__name {
          font-weight: 700; color: var(--color-ivory);
          font-size: var(--text-base); line-height: 1.3;
          margin-bottom: 0;
        }
        .os-featured-card--large .os-featured-card__name { font-size: var(--text-xl); }
        .os-featured-card__add {
          position: absolute; top: var(--space-4); right: var(--space-4);
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--color-gold);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; font-weight: 800; color: #0d2b22;
          z-index: 2;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 12px rgba(201,169,110,0.5);
        }
        .os-featured-card:hover .os-featured-card__add {
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 6px 20px rgba(201,169,110,0.7);
        }

        /* ── Menu Section ── */
        .os-menu-section {
          padding-bottom: var(--space-24);
        }

        /* Search */
        .os-search-wrap {
          max-width: 640px; margin: 0 auto;
          padding: var(--space-10) var(--space-6) var(--space-6);
        }
        .os-search {
          display: flex; align-items: center; gap: var(--space-3);
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(201,169,110,0.25);
          border-radius: 999px;
          padding: 14px 22px;
          backdrop-filter: blur(10px);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .os-search:focus-within {
          border-color: var(--color-gold);
          box-shadow: 0 0 0 3px rgba(201,169,110,0.15);
        }
        .os-search__icon { font-size: 1rem; opacity: 0.5; }
        .os-search__input {
          flex: 1; background: none; border: none; outline: none;
          color: var(--color-ivory); font-size: var(--text-base);
          font-family: var(--font-sans);
        }
        .os-search__input::placeholder { color: rgba(250,248,244,0.35); }
        .os-search__clear {
          background: none; border: none; color: rgba(250,248,244,0.4);
          cursor: pointer; font-size: var(--text-sm);
          transition: color 0.15s;
        }
        .os-search__clear:hover { color: var(--color-gold); }

        /* Category nav */
        .os-cat-nav {
          display: flex; gap: var(--space-2);
          overflow-x: auto; padding: 0 var(--space-6) var(--space-6);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }
        .os-cat-nav::-webkit-scrollbar { display: none; }

        .os-cat-pill {
          display: flex; align-items: center; gap: var(--space-2);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(201,169,110,0.15);
          border-radius: 999px;
          padding: 10px 18px;
          white-space: nowrap; cursor: pointer;
          scroll-snap-align: start;
          transition: all 0.22s;
          color: rgba(250,248,244,0.65);
          flex-shrink: 0;
        }
        .os-cat-pill:hover { background: rgba(201,169,110,0.12); border-color: rgba(201,169,110,0.4); color: var(--color-ivory); }
        .os-cat-pill.active {
          background: var(--color-gold); border-color: var(--color-gold);
          color: #0d2b22; font-weight: 700;
          box-shadow: 0 4px 16px rgba(201,169,110,0.4);
        }
        .os-cat-pill__icon { font-size: 1rem; }
        .os-cat-pill__num { font-size: var(--text-xs); opacity: 0.5; }
        .os-cat-pill__name { font-size: var(--text-sm); font-weight: 500; }
        .os-cat-pill.active .os-cat-pill__num { opacity: 0.6; }

        /* Menu body */
        .os-menu-body {
          max-width: 1280px; margin: 0 auto;
          padding: 0 var(--space-6);
          display: flex; flex-direction: column; gap: var(--space-16);
        }

        .os-no-results {
          text-align: center; padding: var(--space-20);
          color: rgba(250,248,244,0.5);
        }
        .os-no-results__clear {
          margin-top: var(--space-4); background: none; border: 1px solid rgba(201,169,110,0.4);
          color: var(--color-gold); border-radius: 999px; padding: 8px 20px;
          cursor: pointer; font-size: var(--text-sm);
        }

        /* Category */
        .os-category { scroll-margin-top: 100px; }
        .os-category__header {
          display: flex; align-items: center; gap: var(--space-5);
          margin-bottom: var(--space-8);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid rgba(201,169,110,0.15);
        }
        .os-category__icon-wrap {
          font-size: 2rem;
          width: 56px; height: 56px;
          background: rgba(201,169,110,0.1);
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: var(--radius-xl);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .os-category__eyebrow {
          font-size: var(--text-xs); color: var(--color-gold);
          text-transform: uppercase; letter-spacing: 0.12em;
          font-weight: 700; margin-bottom: var(--space-1);
        }
        .os-category__title {
          font-family: var(--font-serif);
          font-size: clamp(var(--text-2xl), 3vw, var(--text-3xl));
          color: var(--color-ivory); font-weight: 400; margin: 0;
        }
        .os-category__search {
          margin-left: auto;
          display: flex; align-items: center; gap: 8px;
          min-width: 220px; max-width: 300px;
          padding: 9px 12px;
          border: 1px solid rgba(201,169,110,0.22);
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          transition: border-color 160ms ease, background 160ms ease;
        }
        .os-category__search:focus-within {
          border-color: var(--color-gold);
          background: rgba(255,255,255,0.08);
        }
        .os-category__search > span { color: var(--color-gold); font-size: 1.1rem; line-height: 1; }
        .os-category__search input {
          min-width: 0; flex: 1; background: transparent; border: 0; outline: 0;
          color: var(--color-ivory); font-size: var(--text-sm);
        }
        .os-category__search input::placeholder { color: rgba(250,248,244,0.4); }
        .os-category__search button {
          background: none; border: 0; color: rgba(250,248,244,0.5);
          cursor: pointer; padding: 0; line-height: 1;
        }
        .os-category__search button:hover { color: var(--color-gold); }
        .os-category__count {
          margin-left: auto; font-size: var(--text-xs); font-weight: 700;
          color: rgba(250,248,244,0.35); white-space: nowrap;
          background: rgba(255,255,255,0.05); border-radius: 999px;
          padding: 4px 12px; border: 1px solid rgba(255,255,255,0.08);
        }

        @media (max-width: 700px) {
          .os-category__header { flex-wrap: wrap; }
          .os-category__search {
            order: 3; width: 100%; min-width: 0; max-width: none; margin-left: 0;
          }
        }

        /* Product grid — 3 columns with hexagonal image gimmick */
        .os-product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: var(--space-5);
        }
        @media (max-width: 600px) { .os-product-grid { grid-template-columns: 1fr 1fr; gap: var(--space-3); } }

        .os-product-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: var(--radius-2xl);
          padding: var(--space-5) var(--space-5) var(--space-5);
          text-align: left; cursor: pointer;
          transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
          display: flex; flex-direction: column; gap: var(--space-3);
          overflow: hidden; position: relative;
        }
        .os-product-card::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(201,169,110,0.08) 0%, transparent 70%);
          opacity: 0; transition: opacity 0.3s;
          border-radius: inherit;
        }
        .os-product-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,169,110,0.2);
          background: rgba(255,255,255,0.06);
        }
        .os-product-card:hover::before { opacity: 1; }
        .os-product-card--unavailable { opacity: 0.4; cursor: default; }
        .os-product-card--unavailable:hover { transform: none; box-shadow: none; }

        /* Hexagonal image */
        .os-product-card__hex-wrap {
          position: relative;
          display: flex; justify-content: center;
          padding-bottom: var(--space-2);
        }
        .os-product-card__hex {
          width: 130px; height: 130px;
          border-radius: 60% 40% 40% 60% / 50% 50% 50% 50%;
          overflow: hidden; position: relative;
          border: 2px solid rgba(201,169,110,0.3);
          transition: border-color 0.3s, border-radius 0.4s;
          flex-shrink: 0;
        }
        .os-product-card:hover .os-product-card__hex {
          border-radius: 50%;
          border-color: var(--color-gold);
        }
        .os-product-card__hex-placeholder {
          display: flex; align-items: center; justify-content: center;
          width: 100%; height: 100%;
          background: rgba(201,169,110,0.1);
          font-size: 2.5rem;
        }
        .os-product-card__hex-glow {
          position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
          width: 80px; height: 20px;
          background: radial-gradient(ellipse at center, rgba(201,169,110,0.35) 0%, transparent 70%);
          transition: opacity 0.3s;
          opacity: 0;
        }
        .os-product-card:hover .os-product-card__hex-glow { opacity: 1; }
        .os-product-card__sold-out {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 800;
          color: white; text-transform: uppercase; letter-spacing: 0.1em;
        }

        .os-product-card__body { text-align: center; }
        .os-product-card__name {
          font-weight: 700; font-size: var(--text-sm);
          color: var(--color-ivory); margin-bottom: var(--space-1);
          line-height: 1.4;
        }
        .os-product-card__desc {
          font-size: 0.72rem; color: rgba(250,248,244,0.45);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; margin-bottom: var(--space-3); line-height: 1.4;
        }
        .os-product-card__footer {
          display: flex; align-items: center; justify-content: space-between;
        }
        .os-product-card__price {
          font-weight: 800; color: var(--color-gold);
          font-size: var(--text-sm);
        }
        .os-product-card__add {
          width: 30px; height: 30px; border-radius: 50%;
          background: var(--color-gold);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; font-weight: 800; color: #0d2b22;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(201,169,110,0.4);
          flex-shrink: 0;
        }
        .os-product-card:hover .os-product-card__add {
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 4px 16px rgba(201,169,110,0.6);
        }

        /* ── How it works ── */
        .os-how {
          background: rgba(201,169,110,0.05);
          border-top: 1px solid rgba(201,169,110,0.12);
          border-bottom: 1px solid rgba(201,169,110,0.12);
          padding: var(--space-20) var(--space-6);
        }
        .os-how__inner { max-width: 1100px; margin: 0 auto; }
        .os-how__eyebrow {
          font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.16em;
          color: var(--color-gold); margin-bottom: var(--space-2);
        }
        .os-how__title {
          font-family: var(--font-serif);
          font-size: clamp(var(--text-3xl), 4vw, var(--text-5xl));
          color: var(--color-ivory); font-weight: 300;
          margin-bottom: var(--space-3);
        }
        .os-how__steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-8);
          margin-top: var(--space-12);
        }
        @media (max-width: 768px) {
          .os-how__steps { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 480px) {
          .os-how__steps { grid-template-columns: 1fr; }
        }
        .os-step { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
        .os-step__circle {
          width: 72px; height: 72px; border-radius: 50%;
          border: 2px solid rgba(201,169,110,0.4);
          background: rgba(201,169,110,0.08);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative;
          transition: border-color 0.3s, background 0.3s;
        }
        .os-step:hover .os-step__circle {
          border-color: var(--color-gold);
          background: rgba(201,169,110,0.15);
          box-shadow: 0 0 24px rgba(201,169,110,0.25);
        }
        .os-step__icon { font-size: 1.5rem; }
        .os-step__num {
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em;
          color: var(--color-gold); position: absolute; bottom: 6px;
          font-family: var(--font-sans);
        }
        .os-step__connector { display: none; }
        .os-step__title {
          font-family: var(--font-serif); font-size: var(--text-xl);
          color: var(--color-ivory); font-weight: 500;
        }
        .os-step__desc {
          font-size: var(--text-sm); color: rgba(250,248,244,0.55);
          line-height: 1.6; max-width: 220px;
        }

        /* ── Product Sheet ── */
        .os-sheet-backdrop {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(10,22,18,0.75);
          backdrop-filter: blur(6px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 640px) {
          .os-sheet-backdrop { align-items: center; }
        }
        .os-sheet {
          background: #0f2d22;
          border: 1px solid rgba(201,169,110,0.2);
          border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
          width: 100%; max-width: 580px; max-height: 94vh;
          overflow-y: auto;
          box-shadow: 0 -20px 60px rgba(0,0,0,0.6);
        }
        @media (min-width: 640px) {
          .os-sheet { border-radius: var(--radius-2xl); max-height: 88vh; }
        }
        .os-sheet__img {
          position: relative; height: 240px;
          background: rgba(201,169,110,0.08);
        }
        .os-sheet__img-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(to top, #0f2d22 0%, transparent 60%);
        }
        .os-sheet__close {
          position: absolute; top: var(--space-4); right: var(--space-4); z-index: 2;
          background: rgba(0,0,0,0.5); color: white; border: none;
          width: 36px; height: 36px; border-radius: 50%;
          cursor: pointer; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
        }
        .os-sheet__img-label { position: absolute; bottom: var(--space-4); left: var(--space-5); z-index: 2; }
        .os-sheet__badge {
          font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: #0d2b22; background: var(--color-gold);
          border-radius: 999px; padding: 3px 10px;
        }
        .os-sheet__img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 4rem;
        }
        .os-sheet__body { padding: var(--space-6); }
        .os-sheet__title {
          font-family: var(--font-serif); font-size: var(--text-3xl);
          color: var(--color-ivory); font-weight: 400;
          margin-bottom: var(--space-2);
        }
        .os-sheet__desc {
          font-size: var(--text-sm); color: rgba(250,248,244,0.6);
          line-height: 1.65; margin-bottom: var(--space-5);
        }
        .os-sheet__meta {
          display: flex; align-items: center; gap: var(--space-3);
          margin-bottom: var(--space-6);
        }
        .os-sheet__price-base {
          font-size: var(--text-xl); font-weight: 800; color: var(--color-gold);
        }
        .os-sheet__pill {
          font-size: var(--text-xs); color: rgba(250,248,244,0.5);
          background: rgba(255,255,255,0.06); border-radius: 999px;
          padding: 3px 10px; border: 1px solid rgba(255,255,255,0.08);
        }

        .os-mod-group { margin-bottom: var(--space-5); }
        .os-mod-group__label {
          font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(250,248,244,0.5); margin-bottom: var(--space-3);
          display: flex; align-items: center; gap: var(--space-2);
        }
        .os-mod-group__req {
          background: rgba(201,169,110,0.15); color: var(--color-gold);
          border-radius: 999px; padding: 2px 8px; font-size: 0.65rem;
          text-transform: none; letter-spacing: 0;
        }
        .os-mod-options { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .os-mod-opt {
          border: 1px solid rgba(255,255,255,0.1); border-radius: 999px;
          background: rgba(255,255,255,0.04);
          color: rgba(250,248,244,0.75); font-size: var(--text-sm);
          padding: 8px 16px; cursor: pointer; transition: all 0.18s;
          display: flex; gap: var(--space-2); align-items: center;
        }
        .os-mod-opt:hover { border-color: var(--color-gold); color: var(--color-ivory); }
        .os-mod-opt.selected {
          background: rgba(201,169,110,0.2); border-color: var(--color-gold);
          color: var(--color-ivory); font-weight: 600;
        }
        .os-mod-opt__price { color: var(--color-gold); font-weight: 700; font-size: var(--text-xs); }

        .os-notes { margin-top: var(--space-5); }
        .os-notes__label {
          display: block; font-size: var(--text-xs); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: rgba(250,248,244,0.45); margin-bottom: var(--space-2);
        }
        .os-notes__input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-lg);
          color: var(--color-ivory); font-family: var(--font-sans);
          font-size: var(--text-sm); padding: var(--space-3) var(--space-4);
          resize: none; outline: none; transition: border-color 0.18s;
          box-sizing: border-box;
        }
        .os-notes__input:focus { border-color: var(--color-gold); }
        .os-notes__input::placeholder { color: rgba(250,248,244,0.25); }

        .os-sheet__footer {
          display: flex; align-items: center; gap: var(--space-4);
          margin-top: var(--space-6);
        }
        .os-qty { display: flex; align-items: center; gap: var(--space-3); }
        .os-qty__btn {
          width: 40px; height: 40px; border-radius: 50%;
          border: 1.5px solid rgba(201,169,110,0.4);
          background: rgba(201,169,110,0.08);
          color: var(--color-gold); font-size: 1.2rem; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.18s;
        }
        .os-qty__btn:hover { background: var(--color-gold); color: #0d2b22; border-color: var(--color-gold); }
        .os-qty__val {
          font-size: var(--text-xl); font-weight: 800;
          color: var(--color-ivory); min-width: 32px; text-align: center;
        }
        .os-sheet__add-btn {
          flex: 1; background: var(--color-gold);
          border: none; border-radius: var(--radius-lg);
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-4) var(--space-5);
          cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(201,169,110,0.4);
        }
        .os-sheet__add-btn:hover {
          background: var(--color-gold-light);
          box-shadow: 0 6px 28px rgba(201,169,110,0.6);
          transform: translateY(-1px);
        }
        .os-sheet__add-btn span {
          font-weight: 800; font-size: var(--text-base); color: #0d2b22;
        }
        .os-sheet__add-price { font-weight: 800; color: #0d2b22; }

        /* ── Cart Pill ── */
        .os-cart-pill {
          position: fixed; bottom: var(--space-6); left: 50%; transform: translateX(-50%);
          background: var(--color-gold);
          display: flex; align-items: center; gap: var(--space-3);
          padding: 14px 28px; border-radius: 999px;
          border: none; cursor: pointer;
          box-shadow: 0 8px 40px rgba(201,169,110,0.5), 0 2px 8px rgba(0,0,0,0.3);
          z-index: 200; white-space: nowrap;
          animation: cart-entry 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .os-cart-pill:hover {
          transform: translateX(-50%) translateY(-3px);
          box-shadow: 0 12px 50px rgba(201,169,110,0.65), 0 2px 8px rgba(0,0,0,0.3);
        }
        @keyframes cart-entry {
          from { opacity: 0; transform: translateX(-50%) translateY(30px) scale(0.8); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .os-cart-pill__badge {
          background: #0d2b22; color: var(--color-gold);
          width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs); font-weight: 800;
        }
        .os-cart-pill__icon { font-size: 1.1rem; }
        .os-cart-pill__label { font-weight: 700; font-size: var(--text-sm); color: #0d2b22; }
        .os-cart-pill__total { font-weight: 800; font-size: var(--text-base); color: #0d2b22; margin-left: var(--space-2); }

        /* Cart Drawer */
        .os-cart-backdrop {
          position: fixed; inset: 0; z-index: 250;
          background: rgba(10,22,18,0.65); backdrop-filter: blur(4px);
          display: flex; align-items: flex-end; justify-content: flex-end;
        }
        .os-cart-drawer {
          background: #0f2d22;
          border-left: 1px solid rgba(201,169,110,0.2);
          width: min(420px, 100vw);
          height: 100%;
          display: flex; flex-direction: column;
          padding: var(--space-6);
          overflow-y: auto;
          animation: drawer-in 0.3s ease;
        }
        @keyframes drawer-in {
          from { transform: translateX(60px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .os-cart-drawer__header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid rgba(201,169,110,0.15);
        }
        .os-cart-drawer__header h3 {
          font-family: var(--font-serif); font-size: var(--text-2xl);
          color: var(--color-ivory); font-weight: 400;
        }
        .os-cart-drawer__close {
          background: rgba(255,255,255,0.08); border: none;
          color: var(--color-ivory); width: 32px; height: 32px;
          border-radius: 50%; cursor: pointer; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
        }

        .os-cart-items { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
        .os-cart-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) 0; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .os-cart-item__info { flex: 1; }
        .os-cart-item__name { font-size: var(--text-sm); font-weight: 600; color: var(--color-ivory); }
        .os-cart-item__mods { font-size: var(--text-xs); color: rgba(250,248,244,0.45); }
        .os-cart-item__ctrl { display: flex; align-items: center; gap: var(--space-2); }
        .os-cart-item__btn {
          width: 26px; height: 26px; border-radius: 50%;
          border: 1px solid rgba(201,169,110,0.3);
          background: rgba(201,169,110,0.08); color: var(--color-gold);
          cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;
        }
        .os-cart-item__price { font-size: var(--text-sm); font-weight: 700; color: var(--color-gold); white-space: nowrap; }

        .os-cart-total {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-5) 0; margin-top: var(--space-4);
          border-top: 1px solid rgba(201,169,110,0.2);
        }
        .os-cart-total span { font-size: var(--text-sm); color: rgba(250,248,244,0.6); }
        .os-cart-total__val { font-size: var(--text-xl); font-weight: 800; color: var(--color-gold); }

        .os-cart-checkout-btn {
          display: block; text-align: center;
          background: var(--color-gold); color: #0d2b22;
          border-radius: var(--radius-lg); padding: var(--space-4);
          font-weight: 800; font-size: var(--text-base);
          text-decoration: none; margin-top: var(--space-4);
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(201,169,110,0.4);
        }
        .os-cart-checkout-btn:hover {
          background: var(--color-gold-light);
          box-shadow: 0 6px 28px rgba(201,169,110,0.6);
          transform: translateY(-2px);
        }
        .os-cart-clear {
          display: block; width: 100%; text-align: center;
          background: none; border: none;
          color: rgba(250,248,244,0.3); font-size: var(--text-sm);
          cursor: pointer; margin-top: var(--space-4); padding: var(--space-2);
          transition: color 0.18s;
        }
        .os-cart-clear:hover { color: rgba(250,248,244,0.6); }
      `}</style>
    </div>
  );
}
