#!/bin/bash

# Add VarianceReasonCode enum
cat << 'ENUM' >> packages/db/prisma/schema.prisma

enum VarianceReasonCode {
  CASH_COUNTING_ERROR
  MISSING_RECEIPT
  UNAUTHORIZED_PAYOUT
  REFUND_ERROR
  WRONG_CHANGE
  CASH_DROP_ERROR
  TRANSFER_ERROR
  SYSTEM_ERROR
  CUSTOMER_DISPUTE
  UNKNOWN
  OTHER
}
ENUM

# Add to Property
sed -i.bak '/lockConfiguration Json/a\
\
  cashVarianceGeneralCashierLimit Decimal? @db.Decimal(18, 4)\
  cashVarianceFinanceManagerLimit Decimal? @db.Decimal(18, 4)' packages/db/prisma/schema.prisma

# Add to PosSession
sed -i.bak '/approvalNotes   String?/a\
  reasonCode      VarianceReasonCode?\
  reasonNotes     String?' packages/db/prisma/schema.prisma

# Add to FrontdeskSession
sed -i.bak '/approvalNotes          String?/a\
  reasonCode             VarianceReasonCode?\
  reasonNotes            String?' packages/db/prisma/schema.prisma

