import React from 'react';
import { Sparkles } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface CategoryTileGridProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

export function CategoryTileGrid({ categories, activeCategory, onSelectCategory }: CategoryTileGridProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto scroll-smooth"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* All Items */}
      <button
        onClick={() => onSelectCategory('all')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-all duration-150 touch-manipulation ${
          activeCategory === 'all'
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
        }`}
      >
        <Sparkles className={`w-3 h-3 ${activeCategory === 'all' ? 'text-indigo-200' : 'text-indigo-400'}`} />
        All
      </button>

      {categories.map((c) => {
        const isActive = activeCategory === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-all duration-150 touch-manipulation ${
              isActive
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
