import { Project, SyntaxKind, CallExpression, PropertyAccessExpression, ObjectLiteralExpression } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/**/*.ts');

interface Violation {
  file: string;
  line: number;
  type: string;
  message: string;
}

const violations: Violation[] = [];

function report(file: string, line: number, type: string, message: string) {
  violations.push({ file, line, type, message });
}

// Global/Indirect models that require scoped access (from model-ownership.md)
const scopedModels = [
  'seasonalRate', 'guestDocument', 'reservationGuest', 'reservationRoom',
  'refundApproval', 'rolePermission', 'lockCredential', 'lockCommand',
  'reservationPriority', 'stockItemUnit', 'purchaseOrderItem',
  'goodsReceivedNoteItem', 'posTable', 'posProductModifier', 'recipeVersion',
  'recipeIngredient', 'cashExpenseJournal', 'cashExpenseAudit',
  'frontdeskSessionAudit', 'posOrderItem', 'posOrderItemModifier', 'posCheck',
  'posProductionBatch', 'posProductionBatchEvent', 'posProductionBatchItem',
  'laundryOrderItem', 'stockTransferItem', 'stocktakeItem', 'bankDepositAllocation',
  
  // Standard models that are strictly tenant owned
  'property', 'room', 'reservation', 'posOrder', 'staff', 'folio',
  'posOutlet', 'stockItem', 'purchaseOrder', 'goodsReceivedNote'
];

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath().replace(project.getFileSystem().getCurrentDirectory(), '');
  
  sourceFile.forEachDescendant(node => {
    // 1. Legacy Auth Functions
    if (NodeIsCallExpression(node)) {
      const expr = node.getExpression();
      const text = expr.getText();
      if (text === 'assertPropertyAccess' || text === 'getUserPropertyIds') {
        report(filePath, node.getStartLineNumber(), 'LEGACY_AUTH', `Used legacy auth function: ${text}`);
      }

      // Check for raw SQL
      if (text.endsWith('.$queryRaw') || text.endsWith('.$executeRaw')) {
        report(filePath, node.getStartLineNumber(), 'RAW_SQL', `Used unsafe raw SQL query: ${text}`);
      }

      // Check for unscoped Prisma operations (findUnique, update, delete)
      if (text.startsWith('prisma.') && 
         (text.endsWith('.findUnique') || text.endsWith('.update') || text.endsWith('.delete'))) {
        
        const modelNameMatch = text.match(/prisma\.([a-zA-Z0-9_]+)\./);
        if (modelNameMatch) {
          const modelName = modelNameMatch[1];
          if (scopedModels.includes(modelName)) {
            const args = node.getArguments();
            if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
              const obj = args[0] as ObjectLiteralExpression;
              const whereProp = obj.getProperty('where');
              if (whereProp && whereProp.getKind() === SyntaxKind.PropertyAssignment) {
                const whereInit = whereProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
                if (whereInit) {
                  const hasPropertyId = whereInit.getProperty('propertyId') || whereInit.getProperty('organizationId');
                  const nestedScope = whereInit.getProperties().some(p => {
                    if (p.getKind() === SyntaxKind.PropertyAssignment) {
                      const init = p.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
                      return init && (init.getProperty('propertyId') || init.getProperty('organizationId'));
                    }
                    return false;
                  });

                  if (!hasPropertyId && !nestedScope) {
                    report(filePath, node.getStartLineNumber(), 'UNSCOPED_MUTATION', `Unscoped prisma operation on ${modelName}`);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2. Direct session.user.id usage for auth (naive check)
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const text = node.getText();
      if (text === 'session.user.id') {
        const parent = node.getParent();
        if (parent && parent.getKind() === SyntaxKind.CallExpression) {
          const callText = (parent as CallExpression).getExpression().getText();
          if (callText !== 'requireOrganizationContext') {
            // It's being passed to something else
            if (callText !== 'assertPropertyAccess' && callText !== 'getUserPropertyIds') {
               report(filePath, node.getStartLineNumber(), 'DIRECT_SESSION_USE', `Used session.user.id outside requireOrganizationContext in ${callText}`);
            }
          }
        }
      }

      // 3. Client-controlled organization authority
      if (text.includes('organizationId')) {
        const parent = node.getParent();
        if (parent && parent.getKind() === SyntaxKind.VariableDeclaration) {
          const init = parent.getInitializer();
          if (init && (init.getText().includes('searchParams') || init.getText().includes('req.json'))) {
             report(filePath, node.getStartLineNumber(), 'CLIENT_ORGANIZATION', `Derived organizationId directly from client payload: ${text}`);
          }
        }
      }
    }
  });
}

console.log(`\nAudit Complete. Found ${violations.length} violations in ${sourceFiles.length} API routes.\n`);

const grouped = violations.reduce((acc, v) => {
  if (!acc[v.type]) acc[v.type] = [];
  acc[v.type].push(v);
  return acc;
}, {} as Record<string, Violation[]>);

for (const [type, list] of Object.entries(grouped)) {
  console.log(`=== ${type} (${list.length}) ===`);
  list.forEach(v => {
    console.log(`  ${v.file}:${v.line} -> ${v.message}`);
  });
  console.log('');
}

if (violations.length > 0) {
  process.exit(1);
}

// Helper
function NodeIsCallExpression(node: any): node is CallExpression {
  return node.getKind() === SyntaxKind.CallExpression;
}
