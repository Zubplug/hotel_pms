import re
import os

src_path = "/Users/mac/hotel_pms/apps/web/src/app/(dashboard)/reports/shift/page.tsx"
dest_path = "/Users/mac/hotel_pms/apps/web/src/app/(night-audit)/night-audit/shift-reviews/page.tsx"

with open(src_path, 'r') as f:
    content = f.read()

# Replace specific component names if they exist, but it's a default export so we don't strictly have to.
content = content.replace("export default function ShiftReportPage()", "export default function NightAuditShiftReviews()")

replacements = [
    # Status chip mapping
    (r"bg-blue-50 text-blue-700 border-blue-200", "bg-sky-500/20 text-sky-300 border-sky-500/30"),
    (r"bg-slate-100 text-slate-600 border-slate-200", "bg-slate-500/20 text-slate-300 border-slate-500/30"),
    (r"bg-amber-50 text-amber-700 border-amber-200", "bg-amber-500/20 text-amber-300 border-amber-500/30"),
    (r"bg-violet-50 text-violet-700 border-violet-200", "bg-violet-500/20 text-violet-300 border-violet-500/30"),
    (r"bg-emerald-50 text-emerald-700 border-emerald-200", "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"),
    (r"bg-red-50 text-red-700 border-red-200", "bg-rose-500/20 text-rose-300 border-rose-500/30"),
    (r"text-red-700", "text-rose-400"),
    (r"text-red-600", "text-rose-400"),
    (r"text-red-500", "text-rose-500"),
    (r"bg-orange-50 text-orange-700 border-orange-200", "bg-orange-500/20 text-orange-300 border-orange-500/30"),
    
    # Generic specific blocks
    (r"bg-red-50", "bg-rose-500/10"),
    (r"border-red-200", "border-rose-500/20"),
    (r"bg-amber-50", "bg-amber-500/10"),
    (r"border-amber-200", "border-amber-500/20"),
    (r"bg-emerald-50", "bg-emerald-500/10"),
    (r"border-emerald-200", "border-emerald-500/20"),
    (r"bg-indigo-50", "bg-indigo-500/10"),
    (r"border-indigo-100", "border-indigo-500/20"),
    (r"border-indigo-200", "border-indigo-500/30"),
    (r"text-indigo-800", "text-indigo-200"),
    (r"text-indigo-700", "text-indigo-300"),
    (r"text-indigo-600", "text-indigo-400"),
    
    (r"bg-blue-50", "bg-sky-500/10"),
    (r"border-blue-200", "border-sky-500/20"),
    (r"text-blue-700", "text-sky-300"),
    
    # Selection colors
    (r"border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100", "border-emerald-500/50 bg-emerald-500/20 ring-2 ring-emerald-500/30"),
    (r"border-amber-300 bg-amber-50/80 ring-2 ring-amber-100", "border-amber-500/50 bg-amber-500/20 ring-2 ring-amber-500/30"),
    (r"border-blue-300 bg-blue-50/80 ring-2 ring-blue-100", "border-sky-500/50 bg-sky-500/20 ring-2 ring-sky-500/30"),
    (r"border-rose-300 bg-rose-50/80 ring-2 ring-rose-100", "border-rose-500/50 bg-rose-500/20 ring-2 ring-rose-500/30"),

    # Backgrounds and borders
    (r"bg-slate-50/60", "bg-white/5"),
    (r"bg-slate-50/70", "bg-white/[0.07]"),
    (r"bg-slate-50/80", "bg-white/10"),
    (r"bg-slate-50", "bg-slate-950"),
    (r"bg-white", "bg-slate-900"),
    
    (r"border-slate-100", "border-white/5"),
    (r"border-slate-200", "border-white/10"),
    (r"border-slate-300", "border-white/20"),
    (r"divide-slate-100", "divide-white/5"),
    (r"divide-slate-200", "divide-white/10"),
    
    (r"hover:bg-slate-50", "hover:bg-white/5"),
    (r"hover:border-slate-300", "hover:border-white/20"),
    (r"hover:border-slate-200", "hover:border-white/10"),
    
    (r"bg-slate-100", "bg-white/10"),
    (r"bg-slate-200", "bg-white/20"),
    
    # Text colors
    (r"text-slate-800", "text-white"),
    (r"text-slate-900", "text-white"),
    (r"text-slate-700", "text-slate-200"),
    (r"text-slate-600", "text-slate-300"),
    (r"text-slate-500", "text-slate-400"),
    (r"text-slate-400", "text-slate-500"),
    
    # Other specifics
    (r"text-amber-900", "text-amber-200"),
    (r"border-amber-200", "border-amber-500/30"),
    (r"ring-white", "ring-slate-950")
]

for old, new in replacements:
    content = re.sub(old, new, content)

os.makedirs(os.path.dirname(dest_path), exist_ok=True)
with open(dest_path, 'w') as f:
    f.write(content)

print(f"Successfully converted and wrote to {dest_path}")
