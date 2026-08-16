import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const src = path.join(process.cwd(), 'src/app/(dashboard)');
const dest = path.join(process.cwd(), 'src/app/_dashboard');

try {
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
    console.log('Successfully hid (dashboard) directory for static export.');
  }

  // Run the build synchronously
  execSync('npx cross-env NEXT_PUBLIC_IS_DESKTOP=true next build', { 
    stdio: 'inherit',
    env: process.env
  });

} catch (error) {
  console.error('Build failed.');
  process.exitCode = 1;
} finally {
  // Always restore the directory, even if the build fails
  if (fs.existsSync(dest)) {
    fs.renameSync(dest, src);
    console.log('Successfully restored (dashboard) directory after static export.');
  }
}
