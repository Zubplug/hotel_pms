#!/bin/bash
fix_page() {
  local dir=$1
  local compName=$2
  
  if [ -f "$dir/page.tsx" ]; then
    mv "$dir/page.tsx" "$dir/client.tsx"
    cat << TSX > "$dir/page.tsx"
import $compName from './client';
export default function Page() {
  return <$compName />;
}
TSX
    echo "Fixed $dir"
  fi
}

fix_page "apps/web/src/app/night-audit" "NightAuditDashboard"
fix_page "apps/web/src/app/night-audit/reports" "NightAuditReports"
