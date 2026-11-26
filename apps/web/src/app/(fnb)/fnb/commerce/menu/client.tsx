'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, Eye, EyeOff, GripVertical, UtensilsCrossed } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CommerceMenuClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const activeStoreId = storeId ?? stores[0]?.id;

  const { data: menusData, mutate: mutateMenus } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/menus` : null,
    fetcher, { refreshInterval: 30000 },
  );
  const menus: any[] = menusData?.data ?? [];

  const { data: productsData, mutate: mutateProducts } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/products` : null,
    fetcher,
  );
  const products: any[] = productsData?.data ?? [];

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const selectedMenu = menus.find((m) => m.id === selectedMenuId) ?? menus[0];
  const categories: any[] = selectedMenu?.categories ?? [];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? categories[0];
  const categoryProducts = products.filter((p) => p.categoryId === selectedCategory?.id && p.isActive);

  async function toggleProductAvailability(product: any) {
    await fetch(`/api/commerce/manage/stores/${activeStoreId}/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: !product.isAvailable }),
    });
    mutateProducts();
  }

  async function deleteProduct(productId: string) {
    if (!confirm('Archive this product? It will be hidden from the menu.')) return;
    await fetch(`/api/commerce/manage/stores/${activeStoreId}/products/${productId}`, {
      method: 'DELETE',
    });
    mutateProducts();
  }

  async function saveProduct(form: any) {
    if (!activeStoreId) return;
    setSavingProduct(true);
    try {
      if (editProduct) {
        await fetch(`/api/commerce/manage/stores/${activeStoreId}/products/${editProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch(`/api/commerce/manage/stores/${activeStoreId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, categoryId: selectedCategory?.id }),
        });
      }
      mutateProducts();
      setShowProductForm(false);
      setEditProduct(null);
    } finally {
      setSavingProduct(false);
    }
  }

  if (!storesData) {
    return <div className="menu-loading"><Loader2 className="animate-spin" size={28} /></div>;
  }

  return (
    <div className="menu-studio">
      {/* Header */}
      <div className="menu-header">
        <div>
          <h1 className="menu-title">Menu Studio</h1>
          <p className="menu-sub">Build and manage your food menus, categories and products</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stores.length > 1 && (
            <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            className="menu-btn menu-btn--primary"
            onClick={() => { setEditProduct(null); setShowProductForm(true); }}
            disabled={!selectedCategory}
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      <div className="menu-layout">
        {/* Menu selector */}
        <aside className="menu-sidebar">
          <div className="menu-sidebar__section">
            <p className="menu-sidebar__label">Menus</p>
            {menus.map((menu) => (
              <button
                key={menu.id}
                className={`menu-sidebar__item ${selectedMenu?.id === menu.id ? 'menu-sidebar__item--active' : ''}`}
                onClick={() => { setSelectedMenuId(menu.id); setSelectedCategoryId(null); }}
              >
                <UtensilsCrossed size={13} />
                <span>{menu.name}</span>
                {menu.isDefault && <span className="menu-badge">Default</span>}
              </button>
            ))}
            {menus.length === 0 && (
              <p className="menu-sidebar__empty">No menus yet. Create one to start.</p>
            )}
          </div>

          {/* Categories */}
          {selectedMenu && (
            <div className="menu-sidebar__section">
              <p className="menu-sidebar__label">Categories</p>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`menu-sidebar__item ${selectedCategory?.id === cat.id ? 'menu-sidebar__item--active' : ''}`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <ChevronRight size={12} />
                  <span>{cat.name}</span>
                  <span className="menu-badge">{cat._count?.products ?? 0}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Product grid */}
        <main className="menu-main">
          {!selectedCategory ? (
            <div className="menu-empty">
              <UtensilsCrossed size={40} style={{ opacity: 0.2 }} />
              <p>Select a category to view products</p>
            </div>
          ) : categoryProducts.length === 0 ? (
            <div className="menu-empty">
              <Plus size={40} style={{ opacity: 0.2 }} />
              <p>No products in <strong>{selectedCategory.name}</strong> yet</p>
              <button className="menu-btn menu-btn--primary" onClick={() => { setEditProduct(null); setShowProductForm(true); }}>
                <Plus size={14} /> Add First Product
              </button>
            </div>
          ) : (
            <div className="menu-products">
              {categoryProducts.map((product: any) => (
                <div key={product.id} className={`menu-product-card ${!product.isAvailable ? 'menu-product-card--unavailable' : ''}`}>
                  <div className="menu-product-card__drag"><GripVertical size={14} /></div>
                  {product.imageUrl && (
                    <img src={product.imageUrl} alt={product.name} className="menu-product-card__img" />
                  )}
                  <div className="menu-product-card__body">
                    <div className="menu-product-card__top">
                      <span className="menu-product-card__name">{product.name}</span>
                      <span className="menu-product-card__price">₦{Number(product.price).toLocaleString()}</span>
                    </div>
                    {product.description && (
                      <p className="menu-product-card__desc">{product.description}</p>
                    )}
                    {product.modifierGroups?.length > 0 && (
                      <p className="menu-product-card__mods">{product.modifierGroups.length} modifier group{product.modifierGroups.length > 1 ? 's' : ''}</p>
                    )}
                    <div className="menu-product-card__actions">
                      <button className="menu-icon-btn" onClick={() => toggleProductAvailability(product)} title={product.isAvailable ? 'Mark unavailable' : 'Mark available'}>
                        {product.isAvailable ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button className="menu-icon-btn" onClick={() => { setEditProduct(product); setShowProductForm(true); }}>
                        <Pencil size={14} />
                      </button>
                      <button className="menu-icon-btn menu-icon-btn--danger" onClick={() => deleteProduct(product.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Product form modal */}
      {showProductForm && (
        <ProductFormModal
          product={editProduct}
          categoryId={selectedCategory?.id}
          onSave={saveProduct}
          onClose={() => { setShowProductForm(false); setEditProduct(null); }}
          saving={savingProduct}
        />
      )}

      <style>{`
        .menu-studio { display: flex; flex-direction: column; gap: 20px; height: 100%; }
        .menu-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .menu-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .menu-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .menu-loading { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #9ca3af; }
        .menu-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; border: none;
          font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s;
        }
        .menu-btn--primary { background: hsl(262 83% 58%); color: white; }
        .menu-btn--primary:disabled { opacity: 0.4; cursor: not-allowed; }

        .menu-layout { display: grid; grid-template-columns: 220px 1fr; gap: 16px; min-height: 60vh; }
        @media (max-width: 700px) { .menu-layout { grid-template-columns: 1fr; } }

        .menu-sidebar { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .menu-sidebar__section { display: flex; flex-direction: column; gap: 2px; }
        .menu-sidebar__label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; padding: 0 8px; margin: 0 0 4px; }
        .menu-sidebar__item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 7px; border: none; background: none;
          font-size: 13px; color: #374151; cursor: pointer; text-align: left; width: 100%;
          transition: background 0.12s;
        }
        .menu-sidebar__item:hover { background: #f3f4f6; }
        .menu-sidebar__item--active { background: hsl(262 83% 95%); color: hsl(262 83% 45%); font-weight: 500; }
        .menu-sidebar__item span:first-of-type { flex: 1; }
        .menu-sidebar__empty { font-size: 12px; color: #9ca3af; padding: 8px; }
        .menu-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: #e5e7eb; color: #6b7280; }

        .menu-main { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 16px; overflow-y: auto; }
        .menu-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 300px; color: #9ca3af; text-align: center; }

        .menu-products { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
        .menu-product-card {
          border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;
          display: flex; flex-direction: column; transition: box-shadow 0.15s;
          position: relative;
        }
        .menu-product-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .menu-product-card--unavailable { opacity: 0.5; }
        .menu-product-card__drag { position: absolute; top: 8px; left: 8px; color: #d1d5db; cursor: grab; }
        .menu-product-card__img { width: 100%; height: 140px; object-fit: cover; }
        .menu-product-card__body { padding: 12px; display: flex; flex-direction: column; gap: 6px; }
        .menu-product-card__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .menu-product-card__name { font-size: 14px; font-weight: 600; color: hsl(222 47% 11%); flex: 1; }
        .menu-product-card__price { font-size: 14px; font-weight: 700; color: hsl(262 83% 50%); white-space: nowrap; }
        .menu-product-card__desc { font-size: 12px; color: #6b7280; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .menu-product-card__mods { font-size: 11px; color: #9ca3af; margin: 0; }
        .menu-product-card__actions { display: flex; gap: 6px; padding-top: 4px; border-top: 1px solid #f3f4f6; margin-top: 2px; }
        .menu-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 6px; border: none;
          background: #f3f4f6; color: #6b7280; cursor: pointer; transition: background 0.12s, color 0.12s;
        }
        .menu-icon-btn:hover { background: #e5e7eb; color: hsl(222 47% 11%); }
        .menu-icon-btn--danger:hover { background: #fee2e2; color: #ef4444; }

        /* Modal */
        .menu-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .menu-modal { background: white; border-radius: 16px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .menu-modal__header { display: flex; justify-content: space-between; align-items: center; }
        .menu-modal__title { font-size: 18px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .menu-modal__close { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 4px; border-radius: 6px; }
        .menu-modal__close:hover { background: #f3f4f6; color: hsl(222 47% 11%); }
        .menu-modal__fields { display: flex; flex-direction: column; gap: 16px; }
        .menu-modal__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .menu-modal__footer { display: flex; justify-content: flex-end; gap: 8px; }
        .menu-field { display: flex; flex-direction: column; gap: 5px; }
        .menu-field label { font-size: 12px; font-weight: 500; color: #374151; }
        .menu-input { padding: 8px 11px; border-radius: 7px; border: 1px solid #d1d5db; font-size: 13px; color: hsl(222 47% 11%); background: white; width: 100%; box-sizing: border-box; }
        .menu-input:focus { outline: none; border-color: hsl(262 83% 58%); box-shadow: 0 0 0 3px hsl(262 83% 95%); }
        .menu-btn--ghost { background: #f3f4f6; color: #374151; }

        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}

function ProductFormModal({ product, categoryId, onSave, onClose, saving }: {
  product: any; categoryId: string; onSave: (form: any) => void; onClose: () => void; saving: boolean;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    compareAtPrice: product?.compareAtPrice ?? '',
    imageUrl: product?.imageUrl ?? '',
    isAvailable: product?.isAvailable ?? true,
    isAlcohol: product?.isAlcohol ?? false,
    prepTimeMinutes: product?.prepTimeMinutes ?? '',
    calories: product?.calories ?? '',
  });

  function p(key: string, val: any) { setForm((prev) => ({ ...prev, [key]: val })); }

  return (
    <div className="menu-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="menu-modal">
        <div className="menu-modal__header">
          <h2 className="menu-modal__title">{product ? 'Edit Product' : 'New Product'}</h2>
          <button className="menu-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="menu-modal__fields">
          <div className="menu-field">
            <label>Product Name *</label>
            <input className="menu-input" value={form.name} onChange={(e) => p('name', e.target.value)} placeholder="e.g. Jollof Rice" />
          </div>
          <div className="menu-field">
            <label>Description</label>
            <textarea className="menu-input" value={form.description} onChange={(e) => p('description', e.target.value)} placeholder="Short description…" rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="menu-modal__row">
            <div className="menu-field">
              <label>Price (₦) *</label>
              <input className="menu-input" type="number" min={0} value={form.price} onChange={(e) => p('price', parseFloat(e.target.value))} placeholder="2500" />
            </div>
            <div className="menu-field">
              <label>Compare-at Price (₦)</label>
              <input className="menu-input" type="number" min={0} value={form.compareAtPrice} onChange={(e) => p('compareAtPrice', parseFloat(e.target.value))} placeholder="3000" />
            </div>
          </div>
          <div className="menu-modal__row">
            <div className="menu-field">
              <label>Prep Time (mins)</label>
              <input className="menu-input" type="number" min={0} value={form.prepTimeMinutes} onChange={(e) => p('prepTimeMinutes', parseInt(e.target.value))} placeholder="20" />
            </div>
            <div className="menu-field">
              <label>Calories</label>
              <input className="menu-input" type="number" min={0} value={form.calories} onChange={(e) => p('calories', parseInt(e.target.value))} placeholder="450" />
            </div>
          </div>
          <div className="menu-field">
            <label>Image URL</label>
            <input className="menu-input" type="url" value={form.imageUrl} onChange={(e) => p('imageUrl', e.target.value)} placeholder="https://…" />
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAvailable} onChange={(e) => p('isAvailable', e.target.checked)} />
              Available
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAlcohol} onChange={(e) => p('isAlcohol', e.target.checked)} />
              Contains Alcohol
            </label>
          </div>
        </div>
        <div className="menu-modal__footer">
          <button className="menu-btn menu-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="menu-btn menu-btn--primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.price}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
