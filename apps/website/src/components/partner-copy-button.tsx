"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";

export function PartnerCopyButton({ value }: { value: string }) {
  const [label, setLabel] = useState("Copy link");
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  async function copy() {
    await navigator.clipboard?.writeText(value);
    setLabel("Copied");
    window.setTimeout(() => setLabel("Copy link"), 1600);
  }
  function downloadQr() { const svg = qrRef.current?.querySelector("svg"); if (!svg) return; const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "lodgecore-reach-qr.svg"; anchor.click(); URL.revokeObjectURL(url); }
  return <>{<button type="button" className="reach-button secondary small" onClick={() => void copy()} disabled={!value}>{label}</button>}{value && <button type="button" className="reach-button secondary small" onClick={() => setShowQr(true)}>QR code</button>}{showQr && <div className="reach-modal-backdrop" role="presentation" onClick={() => setShowQr(false)}><div className="reach-modal" role="dialog" aria-modal="true" aria-label="Referral QR code" onClick={(event) => event.stopPropagation()}><button className="reach-modal-close" type="button" onClick={() => setShowQr(false)} aria-label="Close">×</button><h2>Scan to refer</h2><p>Use the supported LodgeCore referral destination.</p><div className="reach-qr-box" ref={qrRef}><QRCodeSVG value={value} size={220} includeMargin /></div><button type="button" className="reach-button primary" onClick={downloadQr}>Download QR code</button></div></div>}</>;
}
