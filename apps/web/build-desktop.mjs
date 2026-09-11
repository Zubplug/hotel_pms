import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dirsToHide = [
  { src: path.join(process.cwd(), 'src/app/(admin)'), dest: path.join(process.cwd(), 'src/app/_admin_group') },
  { src: path.join(process.cwd(), 'src/app/(dashboard)'), dest: path.join(process.cwd(), 'src/app/_dashboard') },
  { src: path.join(process.cwd(), 'src/app/(cash-management)'), dest: path.join(process.cwd(), 'src/app/_cash-management') },
  { src: path.join(process.cwd(), 'src/app/(inventory)'), dest: path.join(process.cwd(), 'src/app/_inventory') },
  { src: path.join(process.cwd(), 'src/app/(fnb)'), dest: path.join(process.cwd(), 'src/app/_fnb') },
  { src: path.join(process.cwd(), 'src/app/hub'), dest: path.join(process.cwd(), 'src/app/_hub') },
  { src: path.join(process.cwd(), 'src/app/admin'), dest: path.join(process.cwd(), 'src/app/_admin') },
  { src: path.join(process.cwd(), 'src/app/night-audit'), dest: path.join(process.cwd(), 'src/app/_night-audit') }
];

// These cashier pages reuse admin POS screens. When the admin route group is
// hidden for static export, temporarily point their wrappers at its private
// build-time location so TypeScript can still resolve them.
const buildTimeImportBridges = [
  path.join(process.cwd(), 'src/app/(cash-management)/cashier/menu/page.tsx'),
  path.join(process.cwd(), 'src/app/(cash-management)/cashier/price-approvals/page.tsx'),
  path.join(process.cwd(), 'src/app/night-audit/handovers/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/cash-management/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/fnb/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/cashier-summary/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/departures-arrivals/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/detailed-revenue/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/in-house-guests/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/managers-flash/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/reports/print/trial-balance/page.tsx'),
  path.join(process.cwd(), 'src/app/(dashboard)/general-manager/night-audit/rooms/page.tsx')
];
const originalBridgeContents = new Map();

try {
  for (const file of buildTimeImportBridges) {
    if (fs.existsSync(file)) originalBridgeContents.set(file, fs.readFileSync(file, 'utf8'));
  }

  for (const { src, dest } of dirsToHide) {
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      console.log(`Successfully hid ${path.basename(src)} directory for static export.`);
    }
  }

  for (const [file, contents] of originalBridgeContents) {
    let bridgedContents = contents.replaceAll("@/app/(admin)/admin/pos/", "@/app/_admin_group/admin/pos/");
    bridgedContents = bridgedContents.replaceAll("@/app/(cash-management)/", "@/app/_cash-management/");
    bridgedContents = bridgedContents.replaceAll("@/app/(fnb)/", "@/app/_fnb/");
    bridgedContents = bridgedContents.replaceAll("@/app/night-audit/", "@/app/_night-audit/");
    
    let buildFile = file;
    buildFile = buildFile.replace(`${path.sep}app${path.sep}(cash-management)${path.sep}`, `${path.sep}app${path.sep}_cash-management${path.sep}`);
    buildFile = buildFile.replace(`${path.sep}app${path.sep}night-audit${path.sep}`, `${path.sep}app${path.sep}_night-audit${path.sep}`);
    buildFile = buildFile.replace(`${path.sep}app${path.sep}(dashboard)${path.sep}`, `${path.sep}app${path.sep}_dashboard${path.sep}`);
    
    if (bridgedContents !== contents) fs.writeFileSync(buildFile, bridgedContents);
  }

  // Run the build synchronously
  execSync('npx cross-env NEXT_PUBLIC_IS_DESKTOP=true next build --webpack', {
    stdio: 'inherit',
    env: process.env
  });

} catch (error) {
  console.error('Build failed.', error);
  process.exitCode = 1;
} finally {
  // Always restore the directory, even if the build fails
  for (const { src, dest } of dirsToHide) {
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, src);
      console.log(`Successfully restored ${path.basename(src)} directory after static export.`);
    }
  }

  for (const [file, contents] of originalBridgeContents) fs.writeFileSync(file, contents);
}
