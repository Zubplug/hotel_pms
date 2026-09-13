const fs = require('fs');

const filesToProcess = [
  'apps/web/src/app/fnb/kitchen/page.tsx',
  'apps/web/src/app/(fnb)/fnb/controls/client.tsx',
  'apps/web/src/app/(fnb)/fnb/dashboard/client.tsx'
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove `dark:` prefixes and their values safely
  content = content.replace(/dark:[^\s"']+/g, '');

  if (filePath.includes('kitchen') || filePath.includes('controls')) {
    content = content.replace(/bg-\[\#040812\]/g, 'bg-slate-50');
    content = content.replace(/bg-\[\#060b18\](?:\/80)?/g, 'bg-white');
    content = content.replace(/bg-\[\#0c1222\]/g, 'bg-white');
    
    // Borders
    content = content.replace(/border-white\/\[0\.0[35678]\]/g, 'border-slate-200');
    content = content.replace(/border-white\/\[0\.1\]/g, 'border-slate-300');
    content = content.replace(/border-white\/5/g, 'border-slate-200');

    // Backgrounds
    content = content.replace(/bg-white\/\[0\.0[123]\]/g, 'bg-slate-50');
    content = content.replace(/bg-white\/\[0\.0[4567]\]/g, 'bg-slate-100');
    content = content.replace(/bg-white\/\[0\.08\]/g, 'bg-slate-100');
    content = content.replace(/bg-white\/10/g, 'bg-slate-100');
    content = content.replace(/bg-white\/5/g, 'bg-slate-50');
    
    // Text colors
    content = content.replace(/text-white/g, 'text-slate-900');
    content = content.replace(/text-slate-200/g, 'text-slate-700');
    content = content.replace(/text-slate-300/g, 'text-slate-600');
    content = content.replace(/text-slate-400/g, 'text-slate-500');

    // Scrollbar
    content = content.replace(/scrollbar-thumb-white\/10/g, 'scrollbar-thumb-slate-300');
  }

  if (filePath.includes('controls')) {
    content = content.replace(/background: 'linear-gradient[^']*'/g, "background: ''");
    content = content.replace(/style={{ background: '' }}/g, '');
    content = content.replace(/style={PAGE_BG}/g, 'className="bg-slate-50"');
    content = content.replace(/const PAGE_BG[^;]*;/g, '');
    content = content.replace(/rgba\(255,255,255,0.025\)/g, '#ffffff');
  }

  // Cleanup spaces inside quotes using a safe function
  content = content.replace(/className="([^"]+)"/g, (match, classes) => {
    // replace double spaces with single space, trim, remove empty spaces
    const cleanClasses = classes.replace(/\s+/g, ' ').trim();
    return `className="${cleanClasses}"`;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${filePath}`);
}

filesToProcess.forEach(processFile);
