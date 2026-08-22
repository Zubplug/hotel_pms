import re

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'r') as f:
    content = f.read()

# Pattern to find blocks like:
# if (typeof window !== 'undefined' && navigator.onLine) {
#   try { return await OnlineDataProvider... } catch (e) { console.warn('Online failed', e); }
# }
pattern = re.compile(r"(\s+if\s*\(typeof window !== 'undefined' && navigator\.onLine\)\s*\{\s*try\s*\{\s*return await OnlineDataProvider\.[^}]+\}\s*catch\s*\([^)]*\)\s*\{\s*console\.warn\('Online failed', e\);\s*\}\s*\})")
content = pattern.sub('', content)

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'w') as f:
    f.write(content)
