import re
import os

src_path = "/Users/mac/hotel_pms/apps/web/src/app/(cash-management)/handovers/page.tsx"
dest_path = "/Users/mac/hotel_pms/apps/web/src/app/(night-audit)/night-audit/handovers/page.tsx"

with open(src_path, 'r') as f:
    content = f.read()

# Replace specific component names if they exist
content = content.replace("export default async function HandoversPage()", "export default async function NightAuditHandoversPage()")

# Component imports for the buttons also need to be handled, wait they can stay the same since the path is relative?
# Wait, the relative imports in `apps/web/src/app/(cash-management)/handovers/page.tsx` are:
# import { ReceiveHandoverButton } from './receive-handover-button';
# import { CreateHandoverButton } from './create-handover-button';
# These paths will break because the new file is in `(night-audit)/night-audit/handovers/page.tsx`!
# So I should rewrite them to point to the correct components, or just use the original ones:
content = content.replace("'./receive-handover-button'", "'@/app/(cash-management)/handovers/receive-handover-button'")
content = content.replace("'./create-handover-button'", "'@/app/(cash-management)/handovers/create-handover-button'")


replacements = [
    # Status chip mapping
    (r"bg-amber-50 text-amber-700 border-amber-200", "bg-amber-500/20 text-amber-300 border-amber-500/30"),
    (r"bg-emerald-50 text-emerald-700 border-emerald-200", "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"),
    (r"bg-slate-100 text-slate-700 border-slate-200", "bg-slate-500/20 text-slate-300 border-slate-500/30"),

    # Backgrounds and borders
    (r"bg-slate-50/60", "bg-white/5"),
    (r"bg-slate-50/90", "bg-white/[0.07]"),
    (r"bg-slate-50/80", "bg-white/10"),
    (r"bg-slate-50/70", "bg-white/[0.07]"),
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
]

for old, new in replacements:
    content = re.sub(old, new, content)

os.makedirs(os.path.dirname(dest_path), exist_ok=True)
with open(dest_path, 'w') as f:
    f.write(content)

print(f"Successfully converted and wrote to {dest_path}")
