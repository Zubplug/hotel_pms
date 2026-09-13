const fs = require('fs');

const files = [
  'apps/web/src/app/(fnb)/fnb/purchasing/page.tsx',
  'apps/web/src/app/(fnb)/fnb/purchasing/receiving/page.tsx',
  'apps/web/src/app/(fnb)/fnb/events/page.tsx'
];

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove dark: classes from events
  if (filePath.includes('events')) {
    content = content.replace(/dark:[^\s"']+/g, '');
  }

  if (filePath.includes('purchasing')) {
    content = content.replace(/bg-\[\#040812\]/g, 'bg-slate-50');
    content = content.replace(/text-white/g, 'text-slate-900');
    content = content.replace(/text-slate-200/g, 'text-slate-900');
    content = content.replace(/text-slate-300/g, 'text-slate-700');
    content = content.replace(/text-slate-400/g, 'text-slate-500');
    content = content.replace(/text-slate-500/g, 'text-slate-600');
    
    // borders & bgs
    content = content.replace(/border-white\/\[0\.05\]/g, 'border-slate-200');
    content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-white');
    content = content.replace(/bg-white\/\[0\.05\]/g, 'bg-slate-50');
    
    // amber
    content = content.replace(/border-amber-500\/20/g, 'border-amber-200');
    content = content.replace(/bg-amber-500\/\[0\.02\]/g, 'bg-amber-50');
    content = content.replace(/text-amber-500\/70/g, 'text-amber-600');
    content = content.replace(/text-amber-400/g, 'text-amber-700');
    
    // emerald
    content = content.replace(/border-emerald-500\/20/g, 'border-emerald-200');
    content = content.replace(/bg-emerald-500\/\[0\.02\]/g, 'bg-emerald-50');
    content = content.replace(/text-emerald-500\/70/g, 'text-emerald-600');
    content = content.replace(/text-emerald-400/g, 'text-emerald-700');
    content = content.replace(/text-emerald-300/g, 'text-emerald-600');

    // teal
    content = content.replace(/border-teal-500\/20/g, 'border-teal-200');
    content = content.replace(/bg-teal-500\/\[0\.02\]/g, 'bg-teal-50');
    content = content.replace(/text-teal-500\/70/g, 'text-teal-600');
    content = content.replace(/text-teal-400/g, 'text-teal-700');
    
    // indigo
    content = content.replace(/border-indigo-500\/20/g, 'border-indigo-200');
    content = content.replace(/bg-indigo-500\/\[0\.02\]/g, 'bg-indigo-50');
    content = content.replace(/text-indigo-500\/70/g, 'text-indigo-600');
    content = content.replace(/text-indigo-400/g, 'text-indigo-600');
    content = content.replace(/text-indigo-300/g, 'text-indigo-600');
    
    // Status badges
    content = content.replace(/bg-slate-500\/20 text-slate-700/g, 'bg-slate-100 text-slate-700'); // wait, I already replaced 300 to 700 above
    content = content.replace(/bg-indigo-500\/20 text-indigo-600/g, 'bg-indigo-100 text-indigo-700');
    content = content.replace(/bg-emerald-500\/20 text-emerald-600/g, 'bg-emerald-100 text-emerald-700');
    content = content.replace(/bg-amber-500\/20 text-amber-700/g, 'bg-amber-100 text-amber-700');
    content = content.replace(/bg-teal-500\/20 text-teal-700/g, 'bg-teal-100 text-teal-700');
    content = content.replace(/bg-rose-500\/20 text-rose-300/g, 'bg-rose-100 text-rose-700');
    
    // Top border link buttons
    content = content.replace(/border-emerald-500\/30 bg-emerald-500\/10/g, 'border-emerald-200 bg-emerald-50');
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

files.forEach(processFile);
