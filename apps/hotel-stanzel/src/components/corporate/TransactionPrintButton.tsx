'use client';

export default function TransactionPrintButton() {
  return <button type="button" className="invoice-print-button" onClick={() => window.print()}><span aria-hidden="true">⎙</span> Print receipt</button>;
}
