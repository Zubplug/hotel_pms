import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'src/app/_dashboard');
const dest = path.join(process.cwd(), 'src/app/(dashboard)');

if (fs.existsSync(src)) {
  fs.renameSync(src, dest);
  console.log('Successfully restored (dashboard) directory after static export.');
} else {
  console.log('_dashboard directory not found, skipping restore.');
}
