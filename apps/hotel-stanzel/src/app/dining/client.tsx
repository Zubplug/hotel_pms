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
  loadError?: boolean;
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

function OutdoorCommerceExperience({
  store,
  categories,
  currency,
}: {
  store: CommerceStore | null;
  categories: (CommerceCategory & { menuName: string })[];
  currency: string;
}) {
  const { addItem, setServiceMode, setOrderType } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<CommerceProduct | null>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? '');
  const featured = categories
    .flatMap(category => category.products.filter(product => product.isAvailable).map(product => ({ product, category: category.name })))
    .slice(0, 4);

  useEffect(() => {
    setServiceMode('OUTDOOR');
    setOrderType('DELIVERY');
  }, []);

  function goToCategory(id: string) {
    setActiveCategory(id);
    document.getElementById(`outdoor-category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="outdoor-commerce">
      <section className="outdoor-commerce__hero">
        <Image src="/images/pool-evening.jpg" alt="Stanzel Grand Resort poolside at evening" fill priority style={{ objectFit: 'cover', objectPosition: 'center' }} sizes="100vw" />
        <div className="outdoor-commerce__hero-wash" />
        <div className="outdoor-commerce__hero-content">
          <p className="outdoor-commerce__overline">Stanzel Grand Resort · Outdoor Dining</p>
          <h1>Good food.<br /><em>Open air.</em></h1>
          <p className="outdoor-commerce__hero-copy">Freshly prepared favourites and chilled drinks, delivered to your poolside table, cabana or outdoor space.</p>
          <div className="outdoor-commerce__hero-actions">
            <button className="outdoor-commerce__primary" onClick={() => document.getElementById('outdoor-menu')?.scrollIntoView({ behavior: 'smooth' })}>Explore the menu <span>↓</span></button>
            <span className="outdoor-commerce__status"><i /> {store?.status === 'ACTIVE' ? 'Taking orders now' : 'Currently unavailable'}</span>
          </div>
        </div>
        <div className="outdoor-commerce__hero-note">Made for slow afternoons<br />and golden evenings.</div>
      </section>

      <section className="outdoor-commerce__promo" aria-label="Outdoor service announcement">
        <span className="outdoor-commerce__promo-mark">✦</span>
        <strong>{store?.announcementBanner || 'Your table is wherever you are.'}</strong>
        <span>Manual service location at checkout · No app required</span>
      </section>

      <main id="outdoor-menu" className="outdoor-commerce__content">
        <section className="outdoor-commerce__intro">
          <div>
            <p className="outdoor-commerce__eyebrow">The outdoor menu</p>
            <h2>Choose your moment.</h2>
          </div>
          <p>From easy poolside bites to a proper meal under the sky, find something made for the way you want to spend the day.</p>
        </section>

        <nav className="outdoor-commerce__categories" aria-label="Outdoor menu categories">
          {categories.map((category, index) => (
            <button key={category.id} className={activeCategory === category.id ? 'active' : ''} onClick={() => goToCategory(category.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>{category.name}
            </button>
          ))}
        </nav>

        {featured.length > 0 && (
          <section className="outdoor-commerce__featured" aria-labelledby="outdoor-featured-title">
            <div className="outdoor-commerce__section-heading"><div><p className="outdoor-commerce__eyebrow">A little something special</p><h2 id="outdoor-featured-title">Made for the moment</h2></div><span>Guest favourites</span></div>
            <div className="outdoor-commerce__featured-grid">
              {featured.map(({ product, category }) => (
                <button key={product.id} className="outdoor-commerce__featured-card" onClick={() => setSelectedProduct(product)}>
                  <div className="outdoor-commerce__food-image">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="300px" style={{ objectFit: 'cover' }} /> : <span>{category.slice(0, 1)}</span>}</div>
                  <div className="outdoor-commerce__food-copy"><small>{category}</small><strong>{product.name}</strong><span>{fmt(product.price, currency)}</span></div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="outdoor-commerce__menu-list" aria-label="Full outdoor menu">
          {categories.map(category => (
            <section key={category.id} id={`outdoor-category-${category.id}`} className="outdoor-commerce__category">
              <div className="outdoor-commerce__category-heading"><div><p className="outdoor-commerce__eyebrow">{category.menuName}</p><h2>{category.name}</h2></div><span>{category.products.length} items</span></div>
              <div className="outdoor-commerce__product-grid">
                {category.products.map(product => (
                  <button key={product.id} className={`outdoor-commerce__product${!product.isAvailable ? ' is-sold-out' : ''}`} disabled={!product.isAvailable} onClick={() => setSelectedProduct(product)}>
                    <div className="outdoor-commerce__product-image">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="260px" style={{ objectFit: 'cover' }} /> : <span>{category.name.slice(0, 1)}</span>}{!product.isAvailable && <b>Sold out</b>}</div>
                    <div className="outdoor-commerce__product-copy"><strong>{product.name}</strong>{product.description && <p>{product.description}</p>}<div><span>{fmt(product.price, currency)}</span>{product.isAvailable && <i>+</i>}</div></div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>
      </main>

      {selectedProduct && <ProductDrawer product={selectedProduct} currency={currency} onClose={() => setSelectedProduct(null)} onAdd={(product, qty, modifiers, notes) => addItem(product, qty, modifiers, notes)} />}
      <CartPill currency={currency} />

      <style>{`
        .outdoor-commerce { --oc-green: #153d35; --oc-deep: #0c2924; --oc-gold: #c8a76b; --oc-cream: #f8f5ee; --oc-ink: #17211e; background: var(--oc-cream); color: var(--oc-ink); min-height: 100vh; }
        .outdoor-commerce__hero { min-height: 620px; position: relative; display: flex; align-items: center; overflow: hidden; color: white; }
        .outdoor-commerce__hero-wash { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(8,34,29,.94) 0%, rgba(8,34,29,.62) 44%, rgba(8,34,29,.08) 100%), linear-gradient(0deg, rgba(8,34,29,.58), transparent 50%); }
        .outdoor-commerce__hero-content { position: relative; z-index: 1; width: min(1200px, calc(100% - 48px)); margin: 70px auto 0; }
        .outdoor-commerce__overline, .outdoor-commerce__eyebrow { color: var(--oc-gold); font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
        .outdoor-commerce__hero h1 { max-width: 650px; margin: 18px 0; font-family: var(--font-serif); font-size: clamp(4rem, 9vw, 8.5rem); font-weight: 400; line-height: .86; letter-spacing: -.055em; }
        .outdoor-commerce__hero h1 em { color: var(--oc-gold); font-style: italic; }
        .outdoor-commerce__hero-copy { max-width: 440px; color: rgba(255,255,255,.78); font-size: 17px; line-height: 1.65; }
        .outdoor-commerce__hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; margin-top: 30px; }
        .outdoor-commerce__primary { border: 0; border-radius: 99px; padding: 14px 21px; background: var(--oc-gold); color: var(--oc-deep); font-weight: 800; cursor: pointer; }.outdoor-commerce__primary span { margin-left: 16px; font-size: 18px; }
        .outdoor-commerce__status { color: rgba(255,255,255,.8); font-size: 12px; }.outdoor-commerce__status i { display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; background: #61d19b; }
        .outdoor-commerce__hero-note { position: absolute; z-index: 1; right: 6%; bottom: 42px; color: rgba(255,255,255,.74); font-family: var(--font-serif); font-size: 18px; line-height: 1.2; text-align: right; }
        .outdoor-commerce__promo { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 14px 22px; padding: 17px 24px; background: var(--oc-green); color: white; text-align: center; }.outdoor-commerce__promo-mark { color: var(--oc-gold); font-size: 20px; }.outdoor-commerce__promo strong { font-family: var(--font-serif); font-size: 18px; font-weight: 500; }.outdoor-commerce__promo span:last-child { color: rgba(255,255,255,.64); font-size: 12px; }
        .outdoor-commerce__content { width: min(1200px, calc(100% - 48px)); margin: auto; padding: 72px 0 150px; }.outdoor-commerce__intro, .outdoor-commerce__section-heading, .outdoor-commerce__category-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; }.outdoor-commerce__intro { margin-bottom: 32px; }.outdoor-commerce h2 { margin: 8px 0 0; color: var(--oc-green); font-family: var(--font-serif); font-size: clamp(2rem, 4vw, 3.4rem); font-weight: 400; letter-spacing: -.03em; }.outdoor-commerce__intro > p { max-width: 370px; color: #6f7974; font-size: 14px; line-height: 1.7; }
        .outdoor-commerce__categories { display: flex; gap: 8px; margin-bottom: 68px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid rgba(21,61,53,.14); }.outdoor-commerce__categories::-webkit-scrollbar { display: none; }.outdoor-commerce__categories button { flex: 0 0 auto; padding: 14px 18px 17px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #6f7974; font-size: 13px; font-weight: 700; cursor: pointer; }.outdoor-commerce__categories button span { margin-right: 8px; color: var(--oc-gold); font-size: 10px; }.outdoor-commerce__categories button.active { border-color: var(--oc-green); color: var(--oc-green); }
        .outdoor-commerce__section-heading { margin-bottom: 20px; }.outdoor-commerce__section-heading > span, .outdoor-commerce__category-heading > span { color: #86918b; font-size: 12px; }.outdoor-commerce__featured { margin-bottom: 78px; }.outdoor-commerce__featured-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }.outdoor-commerce__featured-card, .outdoor-commerce__product { overflow: hidden; padding: 0; border: 1px solid rgba(21,61,53,.12); border-radius: 18px; background: white; color: inherit; text-align: left; cursor: pointer; transition: transform .2s, box-shadow .2s; }.outdoor-commerce__featured-card:hover, .outdoor-commerce__product:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 16px 35px rgba(21,61,53,.12); }.outdoor-commerce__food-image { position: relative; height: 190px; display: grid; place-items: center; background: linear-gradient(135deg, #d9e2d4, #afc6b0); color: var(--oc-green); font-family: var(--font-serif); font-size: 54px; }.outdoor-commerce__food-copy { display: grid; gap: 5px; padding: 16px; }.outdoor-commerce__food-copy small { color: var(--oc-gold); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }.outdoor-commerce__food-copy strong { color: var(--oc-green); font-family: var(--font-serif); font-size: 20px; font-weight: 500; }.outdoor-commerce__food-copy span { color: var(--oc-green); font-size: 14px; font-weight: 800; }
        .outdoor-commerce__menu-list { display: grid; gap: 70px; }.outdoor-commerce__category { scroll-margin-top: 24px; }.outdoor-commerce__category-heading { margin-bottom: 20px; }.outdoor-commerce__product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }.outdoor-commerce__product-image { position: relative; height: 155px; display: grid; place-items: center; background: #e5eadf; color: #8fa893; font-family: var(--font-serif); font-size: 42px; }.outdoor-commerce__product-image b { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(12,41,36,.7); color: white; font-family: var(--font-sans); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }.outdoor-commerce__product-copy { display: grid; gap: 7px; padding: 15px; }.outdoor-commerce__product-copy strong { color: var(--oc-green); font-family: var(--font-serif); font-size: 17px; font-weight: 500; }.outdoor-commerce__product-copy p { display: -webkit-box; overflow: hidden; margin: 0; color: #818b85; font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.outdoor-commerce__product-copy > div { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; color: var(--oc-green); font-size: 14px; font-weight: 800; }.outdoor-commerce__product-copy i { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; background: var(--oc-green); color: white; font-size: 20px; font-style: normal; font-weight: 400; }.outdoor-commerce__product.is-sold-out { opacity: .58; cursor: not-allowed; }
        .outdoor-commerce .drawer-overlay { z-index: 200; }.outdoor-commerce .cart-pill { z-index: 100; }
        .outdoor-commerce .drawer-overlay { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: rgba(8,34,29,.68); backdrop-filter: blur(5px); }
        .outdoor-commerce .drawer { width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; border-radius: 24px 24px 0 0; background: white; }
        .outdoor-commerce .drawer-img-wrap { position: relative; height: 220px; }.outdoor-commerce .drawer-body { position: relative; padding: 26px 26px 38px; }.outdoor-commerce .drawer-close { position: absolute; top: 16px; right: 16px; z-index: 2; width: 34px; height: 34px; border: 0; border-radius: 50%; background: #edf0eb; cursor: pointer; }.outdoor-commerce .drawer-title { padding-right: 40px; color: var(--oc-green); font-family: var(--font-serif); font-size: 32px; }.outdoor-commerce .drawer-desc { color: #6f7974; font-size: 14px; }.outdoor-commerce .drawer-meta { display: flex; gap: 14px; align-items: center; margin: 14px 0 24px; }.outdoor-commerce .drawer-price { color: var(--oc-green); font-size: 20px; font-weight: 800; }.outdoor-commerce .drawer-cal, .outdoor-commerce .drawer-time { padding: 4px 8px; border-radius: 99px; background: #edf0eb; color: #6f7974; font-size: 11px; }
        .outdoor-commerce .mod-group { margin-bottom: 22px; }.outdoor-commerce .mod-group-title { margin-bottom: 8px; color: var(--oc-ink); font-size: 14px; font-weight: 800; }.outdoor-commerce .mod-required { color: #a47d38; font-size: 11px; font-weight: 500; }.outdoor-commerce .mod-option { display: flex; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #e5e9e3; cursor: pointer; }.outdoor-commerce .mod-name { flex: 1; font-size: 14px; }.outdoor-commerce .mod-price { color: var(--oc-green); font-size: 12px; font-weight: 700; }.outdoor-commerce .notes-label { display: flex; flex-direction: column; gap: 8px; margin-top: 18px; color: var(--oc-ink); font-size: 13px; font-weight: 800; }.outdoor-commerce .notes-input { resize: none; padding: 11px; border: 1px solid #dce3dc; border-radius: 10px; font: inherit; outline: 0; }.outdoor-commerce .notes-input:focus { border-color: var(--oc-green); }
        .outdoor-commerce .drawer-footer { display: flex; gap: 15px; align-items: center; margin-top: 24px; }.outdoor-commerce .qty-ctrl { display: flex; gap: 10px; align-items: center; }.outdoor-commerce .qty-btn { width: 36px; height: 36px; border: 1px solid var(--oc-green); border-radius: 50%; background: white; color: var(--oc-green); font-size: 18px; cursor: pointer; }.outdoor-commerce .qty-val { width: 25px; text-align: center; font-weight: 800; }.outdoor-commerce .btn-add-cart { flex: 1; padding: 13px 18px; border: 0; border-radius: 10px; background: var(--oc-green); color: white; font-weight: 800; cursor: pointer; }
        .outdoor-commerce .cart-pill { position: fixed; bottom: 24px; left: 50%; display: flex; align-items: center; gap: 14px; padding: 14px 22px; transform: translateX(-50%); border-radius: 99px; background: var(--oc-green); color: white; box-shadow: 0 16px 36px rgba(8,34,29,.28); white-space: nowrap; }.outdoor-commerce .cart-pill-link { position: absolute; inset: 0; }.outdoor-commerce .cart-badge { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--oc-gold); color: var(--oc-deep); font-size: 11px; font-weight: 800; }.outdoor-commerce .cart-label { font-size: 13px; font-weight: 700; }.outdoor-commerce .cart-total { font-size: 14px; font-weight: 800; }
        @media (min-width: 640px) { .outdoor-commerce .drawer-overlay { align-items: center; }.outdoor-commerce .drawer { border-radius: 24px; max-height: 88vh; } }
        @media (max-width: 900px) { .outdoor-commerce__featured-grid, .outdoor-commerce__product-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .outdoor-commerce__hero { min-height: 600px; }.outdoor-commerce__hero-content { width: calc(100% - 36px); margin-top: 80px; }.outdoor-commerce__hero h1 { font-size: clamp(3.6rem, 17vw, 6rem); }.outdoor-commerce__hero-note { display: none; }.outdoor-commerce__content { width: calc(100% - 36px); padding-top: 48px; }.outdoor-commerce__intro, .outdoor-commerce__section-heading, .outdoor-commerce__category-heading { align-items: flex-start; flex-direction: column; gap: 12px; }.outdoor-commerce__categories { margin-bottom: 48px; }.outdoor-commerce__featured-grid, .outdoor-commerce__product-grid { gap: 10px; }.outdoor-commerce__food-image { height: 135px; }.outdoor-commerce__product-image { height: 125px; }.outdoor-commerce__food-copy, .outdoor-commerce__product-copy { padding: 12px; }.outdoor-commerce__food-copy strong { font-size: 16px; }.outdoor-commerce__product-copy strong { font-size: 15px; }.outdoor-commerce__product-copy p { font-size: 11px; }.outdoor-commerce__promo { padding-inline: 14px; gap: 8px 12px; }.outdoor-commerce__promo strong { font-size: 16px; } }
      `}</style>
    </div>
  );
}

// ─── Main dining client ───────────────────────────────────────────────────────
export function DiningClient({ store, menus, experience = 'restaurant', loadError = false }: Props) {
  const { addItem, setServiceMode, setOrderType } = useCart();
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
  const featuredProducts = isOutdoor
    ? allCategories.flatMap(category => category.products.filter(product => product.isFeatured)).slice(0, 4)
    : [];

  useEffect(() => {
    setServiceMode(isOutdoor ? 'OUTDOOR' : 'RESTAURANT');
    if (isOutdoor) setOrderType('DELIVERY');
  }, [isOutdoor]);

  if (isOutdoor) {
    return <OutdoorCommerceExperience store={store} categories={allCategories} currency={currency} />;
  }

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

      {isOutdoor && (
        <section className="outdoor-service-bar" aria-label="Outdoor service information">
          <div className="outdoor-service-bar__inner">
            <div className="outdoor-service-bar__intro">
              <span className="outdoor-service-bar__kicker">Stanzel Outdoor Service</span>
              <strong>Order from where you are.</strong>
              <span>Poolside favourites, drinks and light bites brought to your marked service point.</span>
            </div>
            <div className="outdoor-service-bar__steps">
              <span><b>01</b> Choose your menu</span>
              <span><b>02</b> Add to order</span>
              <span><b>03</b> Share your poolside location at checkout</span>
            </div>
          </div>
        </section>
      )}

      {isOutdoor && featuredProducts.length > 0 && (
        <section className="outdoor-featured" aria-labelledby="outdoor-featured-title">
          <div className="outdoor-featured__heading">
            <div>
              <p className="eyebrow">From the outdoor menu</p>
              <h2 id="outdoor-featured-title">Made for the moment</h2>
            </div>
            <p>Guest favourites selected for relaxed afternoons and poolside evenings.</p>
          </div>
          <div className="outdoor-featured__grid">
            {featuredProducts.map(product => (
              <button key={product.id} className="featured-product" onClick={() => setSelectedProduct(product)}>
                <div className="featured-product__image">
                  {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="280px" style={{ objectFit: 'cover' }} /> : <span aria-hidden>✦</span>}
                </div>
                <div className="featured-product__body">
                  <strong>{product.name}</strong>
                  <span>{fmt(product.price, currency)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {menus.length === 0 ? (
        // Fallback when menu isn't loaded (store offline / draft)
        <section className="section">
          <div className="container" style={{ textAlign: 'center', paddingBlock: '5rem' }}>
            <p className="menu-fallback__eyebrow">{loadError ? 'Service temporarily unavailable' : 'Menu coming soon'}</p>
            <h2>{loadError ? 'We could not load the outdoor menu.' : 'Our online menu is being prepared.'}</h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-muted)' }}>
              Please call us or speak with a member of the team for assistance.
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
        .outdoor-service-bar { background: var(--color-green); color: var(--color-ivory); border-bottom: 1px solid rgba(201,169,110,0.28); }
        .outdoor-service-bar__inner { max-width: 1200px; margin: 0 auto; padding: 22px var(--space-6); display: flex; align-items: center; justify-content: space-between; gap: var(--space-8); }
        .outdoor-service-bar__intro { display: grid; gap: 3px; }
        .outdoor-service-bar__kicker { color: var(--color-gold); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
        .outdoor-service-bar__intro strong { font-family: var(--font-serif); font-size: var(--text-xl); font-weight: 500; }
        .outdoor-service-bar__intro span:last-child { color: rgba(250,248,244,0.72); font-size: var(--text-sm); }
        .outdoor-service-bar__steps { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px 20px; color: rgba(250,248,244,0.76); font-size: var(--text-xs); }
        .outdoor-service-bar__steps b { color: var(--color-gold); margin-right: 5px; font-size: 10px; }
        @media (max-width: 768px) { .outdoor-service-bar__inner { align-items: flex-start; flex-direction: column; gap: var(--space-4); } .outdoor-service-bar__steps { justify-content: flex-start; } }
        .outdoor-featured { max-width: 1200px; margin: 0 auto; padding: var(--space-12) var(--space-6) 0; }
        .outdoor-featured__heading { display: flex; align-items: end; justify-content: space-between; gap: var(--space-6); margin-bottom: var(--space-6); }
        .outdoor-featured__heading h2 { color: var(--color-green); font-family: var(--font-serif); font-size: var(--text-3xl); margin-top: 4px; }
        .outdoor-featured__heading > p { max-width: 300px; color: var(--color-muted); font-size: var(--text-sm); line-height: 1.6; }
        .outdoor-featured__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }
        .featured-product { padding: 0; overflow: hidden; text-align: left; background: white; border: 1px solid var(--color-border); border-radius: var(--radius-2xl); cursor: pointer; transition: transform 0.18s, box-shadow 0.18s; }
        .featured-product:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
        .featured-product__image { position: relative; height: 150px; display: grid; place-items: center; background: var(--color-ivory-dark); color: var(--color-gold-dark); font-size: 2rem; }
        .featured-product__body { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px; }
        .featured-product__body strong { color: var(--color-green); font-size: var(--text-sm); }
        .featured-product__body span { color: var(--color-green); font-size: var(--text-sm); font-weight: 700; white-space: nowrap; }
        .menu-fallback__eyebrow { color: var(--color-gold-dark); font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .menu-fallback h2 { color: var(--color-green); font-family: var(--font-serif); margin: var(--space-3) 0; }
        @media (max-width: 900px) { .outdoor-featured__grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .outdoor-featured__heading { align-items: flex-start; flex-direction: column; } .outdoor-featured__grid { grid-template-columns: 1fr 1fr; gap: 10px; } .featured-product__image { height: 120px; } .featured-product__body { align-items: flex-start; flex-direction: column; gap: 5px; } }

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
