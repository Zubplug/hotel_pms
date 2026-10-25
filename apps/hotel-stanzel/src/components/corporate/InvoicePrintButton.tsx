'use client';

export default function InvoicePrintButton() {
  return <button type="button" className="invoice-print-button" onClick={() => window.print()}><span aria-hidden="true">⎙</span> Print invoice</button>;
}
