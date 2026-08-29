const fs = require('fs');

let schema = fs.readFileSync('packages/db/prisma/schema.prisma', 'utf8');

const enumsAndModels = `

enum HandoverStatus {
  PENDING
  COMPLETED
  REJECTED
  CANCELLED
}

enum BankDepositStatus {
  DRAFT
  PENDING_HANDOVER
  HANDED_OVER
  DEPOSITED
  UNDER_RECONCILIATION
  RECONCILED
  EXCEPTION
  CANCELLED
  REJECTED
}

model CashHandover {
  id                String         @id @default(uuid()) @db.Uuid
  propertyId        String         @db.Uuid
  handoverReference String
  amount            Decimal        @db.Decimal(18, 4)
  handedOverById    String         @db.Uuid
  receivedById      String?        @db.Uuid
  witnessedById     String?        @db.Uuid
  safeReference     String?
  status            HandoverStatus @default(PENDING)
  handedOverAt      DateTime       @default(now())
  receivedAt        DateTime?
  notes             String?
  
  posSessions       PosSession[]
  frontdeskSessions FrontdeskSession[]
  
  property          Property       @relation(fields: [propertyId], references: [id])
  handedOverBy      Staff          @relation("HandoverGiver", fields: [handedOverById], references: [id])
  receivedBy        Staff?         @relation("HandoverReceiver", fields: [receivedById], references: [id])
}

model BankDeposit {
  id                  String               @id @default(uuid()) @db.Uuid
  propertyId          String               @db.Uuid
  depositReference    String
  status              BankDepositStatus    @default(DRAFT)
  expectedAmount      Decimal              @db.Decimal(18, 4)
  declaredAmount      Decimal?             @db.Decimal(18, 4)
  bankConfirmedAmount Decimal?             @db.Decimal(18, 4)
  difference          Decimal?             @db.Decimal(18, 4)
  bankName            String?
  bankAccount         String?
  depositDate         DateTime?
  
  createdById         String               @db.Uuid
  submittedById       String?              @db.Uuid
  verifiedById        String?              @db.Uuid
  reconciledById      String?              @db.Uuid
  
  createdAt           DateTime             @default(now())
  submittedAt         DateTime?
  depositedAt         DateTime?
  verifiedAt          DateTime?
  reconciledAt        DateTime?
  
  bankReceiptUrl      String?
  bankReference       String?
  notes               String?
  
  allocations         BankDepositAllocation[]
  property            Property             @relation(fields: [propertyId], references: [id])
}

model BankDepositAllocation {
  id                 String            @id @default(uuid()) @db.Uuid
  bankDepositId      String            @db.Uuid
  posSessionId       String?           @db.Uuid
  frontdeskSessionId String?           @db.Uuid
  allocatedAmount    Decimal           @db.Decimal(18, 4)
  createdAt          DateTime          @default(now())
  
  bankDeposit        BankDeposit       @relation(fields: [bankDepositId], references: [id])
  posSession         PosSession?       @relation(fields: [posSessionId], references: [id])
  frontdeskSession   FrontdeskSession? @relation(fields: [frontdeskSessionId], references: [id])
  
  @@unique([posSessionId, frontdeskSessionId])
}
`;

// Append models to the end
schema += enumsAndModels;

// Insert relations into Property
schema = schema.replace(
  /cashVarianceFinanceManagerLimit Decimal\?                  @db\.Decimal\(18, 4\)/g,
  `cashVarianceFinanceManagerLimit Decimal?                  @db.Decimal(18, 4)\n  cashHandovers      CashHandover[]\n  bankDeposits       BankDeposit[]`
);

// Insert relations into Staff
schema = schema.replace(
  /posSessions          PosSession\[\]/g,
  `posSessions          PosSession[]\n  handoversGiven       CashHandover[] @relation("HandoverGiver")\n  handoversReceived    CashHandover[] @relation("HandoverReceiver")`
);

// Insert relations into PosSession
schema = schema.replace(
  /reasonCode       VarianceReasonCode\?/g,
  `reasonCode       VarianceReasonCode?\n  cashHandoverId   String?           @db.Uuid\n  cashHandover     CashHandover?     @relation(fields: [cashHandoverId], references: [id])\n  bankDepositAllocations BankDepositAllocation[]`
);

// Insert relations into FrontdeskSession
schema = schema.replace(
  /reasonCode             VarianceReasonCode\?/g,
  `reasonCode             VarianceReasonCode?\n  cashHandoverId         String?           @db.Uuid\n  cashHandover           CashHandover?     @relation(fields: [cashHandoverId], references: [id])\n  bankDepositAllocations BankDepositAllocation[]`
);

fs.writeFileSync('packages/db/prisma/schema.prisma', schema);
console.log('Schema updated successfully.');

