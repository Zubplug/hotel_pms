const fs = require('fs');
const code = fs.readFileSync('src/app/hq/custom-domains/page.tsx', 'utf8');
try {
  require('@babel/core').transformSync(code, {
    presets: ['@babel/preset-react', '@babel/preset-typescript'],
    filename: 'page.tsx'
  });
  console.log("Syntax OK");
} catch (e) {
  console.error(e.message);
}
