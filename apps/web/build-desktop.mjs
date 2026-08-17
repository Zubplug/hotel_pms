import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dirsToHide = [
  { src: path.join(process.cwd(), 'src/app/(dashboard)'), dest: path.join(process.cwd(), 'src/app/_dashboard') },
  { src: path.join(process.cwd(), 'src/app/hub'), dest: path.join(process.cwd(), 'src/app/_hub') },
  { src: path.join(process.cwd(), 'src/app/admin'), dest: path.join(process.cwd(), 'src/app/_admin') }
];

try {
  for (const { src, dest } of dirsToHide) {
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
      console.log(`Successfully hid ${path.basename(src)} directory for static export.`);
    }
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
  for (const { src, dest } of dirsToHide) {
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, src);
      console.log(`Successfully restored ${path.basename(src)} directory after static export.`);
    }
  }
}
