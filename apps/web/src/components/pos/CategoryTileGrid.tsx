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

const pastelColors = [
  'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300',
  'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:border-orange-300',
  'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300',
  'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
  'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300',
  'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
  'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300',
  'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:border-violet-300',
  'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300',
  'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100 hover:border-fuchsia-300',
  'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 hover:border-pink-300',
  'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300',
];

export function CategoryTileGrid({ categories, activeCategory, onSelectCategory }: CategoryTileGridProps) {
  return (
    <div className="grid grid-rows-2 grid-flow-col gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {/* "All Items" tile always first */}
      <button
        onClick={() => onSelectCategory('all')}
        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 font-bold transition-all duration-200 whitespace-nowrap min-w-[100px] h-20 ${
          activeCategory === 'all'
            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
        }`}
      >
        <Sparkles className={`w-6 h-6 mb-1 ${activeCategory === 'all' ? 'text-indigo-200' : 'text-indigo-500'}`} />
        <span className="text-xs">All Items</span>
      </button>

      {/* Map through categories with pastel styles */}
      {categories.map((c, idx) => {
        const colorStyle = pastelColors[idx % pastelColors.length];
        const isActive = activeCategory === c.id;
        
        return (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 font-bold transition-all duration-200 whitespace-nowrap min-w-[100px] h-20 ${
              isActive 
                ? 'border-indigo-600 shadow-md ring-2 ring-indigo-200/50 scale-95' 
                : colorStyle
            } ${isActive ? colorStyle.split(' ')[0] + ' ' + colorStyle.split(' ')[1] : ''}`}
          >
            <span className="text-xs line-clamp-2 leading-tight text-center px-1">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
