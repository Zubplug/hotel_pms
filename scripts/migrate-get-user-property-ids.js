const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error("Please provide a file path");
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');

// Basic string replacement for speed on simple cases, since we know exactly what we're looking for.
const importOld = "import { getUserPropertyIds } from '@/lib/property-access';";
const importNew = "import { requireOrganizationContext } from '@/lib/organization-access';";

// If the file imports getUserPropertyIds along with other things like assertPropertyAccess, we need a regex:
code = code.replace(/import \{.*?getUserPropertyIds.*?\} from '@\/lib\/property-access';/g, (match) => {
  if (match === importOld) {
    return importNew;
  }
  // If it's a mixed import, we just add the new import and remove getUserPropertyIds from the old one
  const remaining = match.replace(/getUserPropertyIds,? ?/, '');
  return `${remaining}\n${importNew}`;
});

code = code.replace(/import \{\s*getUserPropertyIds\s*\} from '@\/lib\/property-access';/, importNew);

// We want to replace `await getUserPropertyIds(something)` 
// with `(await requireOrganizationContext(something)).propertyIds`
code = code.replace(/await getUserPropertyIds\((.*?)\)/g, "(await requireOrganizationContext($1)).propertyIds");

fs.writeFileSync(filePath, code);
console.log(`Migrated ${filePath}`);
