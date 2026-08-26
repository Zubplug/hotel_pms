const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const apiDir = path.join(__dirname, 'apps/web/src/app/api');

walkDir(apiDir, (filePath) => {
  if (!filePath.endsWith('route.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Regex to match the route handler signature:
  // e.g. export async function GET(request: Request, { params }: { params: { id: string } }) {
  // or req: Request
  
  const regex = /export\s+async\s+function\s+(GET|POST|PATCH|DELETE|PUT)\s*\(([^,]+),\s*\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{\s*id\s*:\s*string\s*\}\s*\}\s*\)\s*\{/g;
  
  content = content.replace(regex, (match, method, reqParam) => {
    return `export async function ${method}(${reqParam}, props: { params: Promise<{ id: string }> }) {\n  const params = await props.params;`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
});
