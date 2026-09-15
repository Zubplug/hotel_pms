      // 8. Update Account Balance
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });

      // 8.5 Create the General Ledger Journal Entry for the Payment
      const cashAccCode = method === 'CASH' ? '1000' : '1010'; // Map method to Cash/Bank
      const debitAcc = await tx.chartOfAccount.findFirst({ where: { propertyId: account.propertyId, code: cashAccCode } });
      const creditAcc = await tx.chartOfAccount.findFirst({ where: { propertyId: account.propertyId, code: '1140' } }); // AR City Ledger

      if (debitAcc && creditAcc) {
        const jeEntryNumber = `JE-${account.propertyId.slice(0, 8).toUpperCase()}-${year}-${crypto.randomUUID().split('-')[0].toUpperCase().slice(0,6)}`;
        await tx.journalEntry.create({
          data: {
            propertyId: account.propertyId,
            entryDate: payment.createdAt,
            entryNumber: jeEntryNumber,
            reference: payment.receiptNumber,
            description: payment.notes || `AR Payment Collection`,
            source: 'AUTO_PAYMENT',
            status: 'POSTED',
            totalDebit: amount,
            totalCredit: amount,
            createdBy: session.user.id,
            lines: {
              create: [
                { accountId: debitAcc.id, description: \`Payment Received (\${method})\`, debit: amount, credit: 0, sourceType: 'PAYMENT', sourceId: payment.id },
                { accountId: creditAcc.id, description: 'AR Payment Collection', debit: 0, credit: amount, sourceType: 'PAYMENT', sourceId: payment.id }
              ]
            }
          }
        });
      }
