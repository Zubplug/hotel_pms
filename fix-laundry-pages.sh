#!/bin/bash
fix_page() {
  local dir=$1
  local compName=$2
  
  if [ -f "$dir/page.tsx" ]; then
    # Move original page to client
    mv "$dir/page.tsx" "$dir/client.tsx"
    
    # We also need to strip out the 'export default function Page() { ... }' from the bottom of client.tsx
    # because Next.js will complain if a client component exports default Page without being a page... wait, no it won't complain about client.tsx.
    
    cat << TSX > "$dir/page.tsx"
import { $compName } from './client';
export default function Page() {
  return <$compName />;
}
TSX
    echo "Fixed $dir"
  fi
}

fix_page "apps/web/src/app/(frontdesk)/laundry/catalog" "LaundryCatalogClient"
fix_page "apps/web/src/app/(frontdesk)/laundry/orders" "LaundryOrdersClient"
fix_page "apps/web/src/app/(frontdesk)/laundry" "LaundryDashboardClient"
