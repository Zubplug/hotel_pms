import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'src/app/(dashboard)');
const dest = path.join(process.cwd(), 'src/app/_dashboard');

if (fs.existsSync(src)) {
  fs.renameSync(src, dest);
  console.log('Successfully hid (dashboard) directory for static export.');
} else {
  console.log('(dashboard) directory not found, skipping hide.');
}
