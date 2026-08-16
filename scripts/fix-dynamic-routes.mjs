import fs from 'fs';

const files = [
  "apps/web/src/app/(dashboard)/room-types/[id]/page.tsx",
  "apps/web/src/app/(dashboard)/buildings/[buildingId]/page.tsx",
  "apps/web/src/app/(dashboard)/payments/[id]/receipt/page.tsx",
  "apps/web/src/app/(dashboard)/reservations/[id]/page.tsx",
  "apps/web/src/app/(dashboard)/properties/[propertyId]/buildings/page.tsx",
  "apps/web/src/app/(dashboard)/properties/[propertyId]/edit/page.tsx",
  "apps/web/src/app/(dashboard)/properties/[propertyId]/page.tsx",
  "apps/web/src/app/(dashboard)/rooms/[roomId]/edit/page.tsx",
  "apps/web/src/app/(dashboard)/rooms/[roomId]/status-history/page.tsx",
  "apps/web/src/app/(dashboard)/rooms/[roomId]/page.tsx"
];

for (const f of files) {
  try {
    let content = fs.readFileSync(f, 'utf8');
    
    // Clean up incorrect placement if any
    content = content.replace("export function generateStaticParams() { return []; }\n", "");
    content = content.replace("export function generateStaticParams() { return []; }\n\n", "");
    
    if (!content.includes("generateStaticParams() {")) {
      if (content.includes("'use client';")) {
        content = content.replace("'use client';", "'use client';\n\nexport function generateStaticParams() { return []; }");
      } else if (content.includes("\"use client\";")) {
        content = content.replace("\"use client\";", "\"use client\";\n\nexport function generateStaticParams() { return []; }");
      } else {
        content = "export function generateStaticParams() { return []; }\n\n" + content;
      }
      fs.writeFileSync(f, content);
      console.log(`Updated ${f}`);
    }
  } catch(e) {
    console.error(`Failed ${f}:`, e.message);
  }
}
