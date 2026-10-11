'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { goBack } from '@/lib/frontdesk-navigation';
import {
  ArrowLeft, QrCode, Printer, Search, Hotel, CheckCircle2,
  Download, RefreshCw, Grid3X3, LayoutList, Eye, Loader2,
  Smartphone, Wifi, Star,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ─────────────────────────────────────────────────────────────────────────────
// URL builder — uses signed token, not raw IDs
// ─────────────────────────────────────────────────────────────────────────────
function buildRoomServiceUrl(token: string, roomNo: string): string {
  const base =
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.getlodgecore.com');
  return `${base}/room-service?t=${encodeURIComponent(token)}&rn=${encodeURIComponent(roomNo)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tent Card Component (screen preview — uses QRCodeSVG, fully offline)
// ─────────────────────────────────────────────────────────────────────────────
function TentCard({ room, token, propertyName }: {
  room: { id: string; number: string; name?: string; roomType?: { name: string } };
  token: string;
  propertyName: string;
}) {
  const url = token ? buildRoomServiceUrl(token, room.number) : '';
  return (
    <div
      className="tent-card bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 w-[320px] shrink-0"
      style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
    >
      {/* Dark header */}
      <div className="bg-[#09152d] px-5 pt-5 pb-4 text-white text-center relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-amber-500/10" />
        <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full bg-cyan-500/10" />
        <div className="relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Hotel className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400/80 uppercase tracking-widest">In-Room Dining</span>
          </div>
          <h2 className="text-xl font-black tracking-tight">{propertyName}</h2>
          <p className="text-slate-400 text-xs mt-0.5">Room Service · Available 24/7</p>
        </div>
      </div>

      {/* QR Code — client-side SVG, no external network call */}
      <div className="bg-white px-6 py-5 flex flex-col items-center gap-3">
        <div className="bg-slate-50 p-3 rounded-2xl border-2 border-amber-200 shadow-inner">
          {url
            ? <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
            : <div className="w-[160px] h-[160px] flex items-center justify-center text-slate-300 text-xs">Generating…</div>
          }
        </div>
        <div className="text-center">
          <div className="text-3xl font-black text-slate-900 tracking-tight">Room {room.number}</div>
          {room.roomType?.name && (
            <div className="text-xs text-slate-400 font-medium mt-0.5">{room.roomType.name}</div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border-t border-amber-100 px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Smartphone className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-800">How to order</span>
        </div>
        <ol className="text-[11px] text-amber-700 space-y-1 text-left max-w-[220px] mx-auto">
          <li className="flex gap-2"><span className="font-black text-amber-500">1.</span><span>Point your phone camera at this code</span></li>
          <li className="flex gap-2"><span className="font-black text-amber-500">2.</span><span>Browse our menu and add items to your cart</span></li>
          <li className="flex gap-2"><span className="font-black text-amber-500">3.</span><span>Checkout — charge to room or pay on delivery</span></li>
        </ol>
      </div>

      {/* Footer */}
      <div className="bg-[#09152d]/5 border-t border-slate-100 px-5 py-3 flex items-center justify-center gap-2">
        <Wifi className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] text-slate-400 font-medium">Connect to hotel Wi-Fi · Dial 0 for assistance</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function QrRoomServicePage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewRoom, setPreviewRoom] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  // roomId → signed HMAC token (fetched from /api/v1/room-service/room-tokens)
  const [tokenMap, setTokenMap] = useState<Record<string, string>>({});
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // ── Property name ─────────────────────────────────────────────────
  const [propertyName, setPropertyName] = useState('LodgeCore Hotel');
  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/v1/properties/${propertyId}`)
      .then(r => r.json())
      .then(d => { if (d?.data?.name) setPropertyName(d.data.name); })
      .catch(() => {});
  }, [propertyId]);

  // ── Fetch rooms ───────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['qr-room-service', 'rooms', propertyId],
    queryFn: () => provider.rooms.list(propertyId, { filter: 'ALL' }),
    enabled: !!propertyId,
  });
  const rawRooms: any[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);

  // ── Fetch signed tokens once rooms are loaded ─────────────────────
  // Tokens are signed server-side with HMAC-SHA256.  Staff auth (session
  // cookie) is required so unauthenticated callers cannot enumerate tokens.
  useEffect(() => {
    if (!rawRooms.length || !propertyId) return;
    const roomIds = rawRooms.map(r => r.id);
    fetch('/api/v1/room-service/room-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ roomIds }),
    })
      .then(r => r.json())
      .then(json => {
        const map: Record<string, string> = {};
        (json?.data?.tokens || []).forEach((t: { roomId: string; token: string }) => {
          map[t.roomId] = t.token;
        });
        setTokenMap(map);
      })
      .catch(() => {}); // QR shows "Generating…" placeholder on failure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRooms.length, propertyId]);

  const filteredRooms = rawRooms.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.number?.toLowerCase().includes(q) || r.roomType?.name?.toLowerCase().includes(q) || r.floor?.number?.toString().includes(q);
  });

  // ── Selection helpers ─────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredRooms.map(r => r.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedRooms = filteredRooms.filter(r => selectedIds.has(r.id));

  // ── Print engine ──────────────────────────────────────────────────
  // QR codes are generated as inline SVG using qrcode.react (no external
  // network call — works 100% offline and in air-gapped environments).
  const handlePrint = useCallback(async (rooms: any[]) => {
    if (!rooms.length) return;
    setIsPrinting(true);

    // Dynamically import to avoid SSR issues
    const { QRCodeSVG: QrSvg } = await import('qrcode.react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = (await import('react')).default;

    const toSvgString = (url: string): string => {
      try {
        return renderToStaticMarkup(
          React.createElement(QrSvg as any, { value: url, size: 180, level: 'M', includeMargin: false })
        );
      } catch {
        return '<rect width="180" height="180" fill="#f1f5f9"/><text x="90" y="95" text-anchor="middle" font-size="10" fill="#94a3b8">QR unavailable</text>';
      }
    };

    const cards = rooms.map(room => {
      const token = tokenMap[room.id] || '';
      const url = token ? buildRoomServiceUrl(token, room.number) : '';
      const svgInner = url
        ? toSvgString(url)
        : '<rect width="180" height="180" fill="#f1f5f9"/>';
      return `
        <div class="card">
          <div class="card-header">
            <div class="property-badge">In-Room Dining</div>
            <div class="property-name">${propertyName}</div>
            <div class="sub">Room Service · Available 24/7</div>
          </div>
          <div class="card-body">
            <div class="qr-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">${svgInner}</svg>
            </div>
            <div class="room-number">Room ${room.number}</div>
            ${room.roomType?.name ? `<div class="room-type">${room.roomType.name}</div>` : ''}
          </div>
          <div class="card-instructions">
            <div class="how-title">📱 How to order</div>
            <ol>
              <li>Point your phone camera at the QR code</li>
              <li>Browse our menu and add items to your cart</li>
              <li>Checkout — charge to room or pay on delivery</li>
            </ol>
          </div>
          <div class="card-footer">Connect to hotel Wi-Fi · Dial 0 for assistance</div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Room Service QR Cards — ${propertyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A6 portrait; margin: 6mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; }
    .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .card { break-inside: avoid; page-break-inside: avoid; border: 1.5pt solid #e2e8f0; border-radius: 12pt; overflow: hidden; box-shadow: 0 2pt 8pt rgba(0,0,0,0.08); }
    .card-header { background: #09152d; color: #fff; padding: 14pt 16pt 10pt; text-align: center; }
    .property-badge { font-size: 7pt; font-weight: 800; color: #f59e0b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3pt; }
    .property-name { font-size: 13pt; font-weight: 900; letter-spacing: -0.03em; }
    .sub { font-size: 7pt; color: #94a3b8; margin-top: 2pt; }
    .card-body { background: #fff; padding: 14pt 16pt 10pt; display: flex; flex-direction: column; align-items: center; gap: 8pt; }
    .qr-wrap { border: 2pt solid #fcd34d; border-radius: 8pt; padding: 6pt; background: #fefce8; }
    .room-number { font-size: 22pt; font-weight: 900; color: #0f172a; letter-spacing: -0.04em; }
    .room-type { font-size: 8pt; color: #94a3b8; font-weight: 500; }
    .card-instructions { background: #fffbeb; border-top: 1pt solid #fde68a; padding: 10pt 16pt; }
    .how-title { font-size: 8pt; font-weight: 800; color: #92400e; margin-bottom: 5pt; }
    ol { padding-left: 14pt; color: #78350f; font-size: 7.5pt; line-height: 1.6; }
    .card-footer { background: rgba(15,23,45,0.04); border-top: 1pt solid #f1f5f9; padding: 6pt 16pt; text-align: center; font-size: 7pt; color: #94a3b8; }
    @media print { .cards-grid { grid-template-columns: 1fr 1fr; } .card { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="cards-grid">${cards}</div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'width=900,height=700');
    if (!win) {
      const iframe = printFrameRef.current;
      if (iframe) {
        iframe.src = blobUrl;
        iframe.onload = () => {
          setTimeout(() => { iframe.contentWindow?.print(); setIsPrinting(false); }, 300);
        };
        return;
      }
    }
    setIsPrinting(false);
  }, [propertyName, tokenMap]);

  // ── Stats ─────────────────────────────────────────────────────────
  const totalRooms = rawRooms.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-amber-500/15 blur-[80px]" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-[60px]" />
        <div className="relative mx-auto max-w-[1440px]">
          {/* Breadcrumb */}
          <div className="mb-7 flex items-center gap-3">
            <button
              onClick={() => goBack(router, '/frontdesk')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span>
            <span className="text-slate-700">/</span>
            <span className="text-xs font-semibold text-amber-300">QR Room Service</span>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-amber-300">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-400/15">
                  <QrCode className="h-3.5 w-3.5" />
                </span>
                Tent Card Manager
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">QR Room Service Cards</h1>
              <p className="mt-2 text-sm text-slate-400">
                Generate and print QR tent cards for guest rooms. Guests scan to order food and amenities directly from their phones.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-3">
              {[
                { label: 'Total Rooms', value: totalRooms, color: 'text-white' },
                { label: 'Selected', value: selectedIds.size, color: 'text-amber-300' },
              ].map(stat => (
                <div key={stat.label} className="flex min-w-[80px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                  <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[24px] border border-white/70 bg-white/90 p-4 shadow-lg backdrop-blur">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search room number or type…"
              className="w-full pl-10 pr-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition placeholder:text-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggles */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 transition ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 transition ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {selectedIds.size === 0 ? (
              <button
                onClick={selectAll}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
              >
                Select All
              </button>
            ) : (
              <button
                onClick={clearSelection}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium transition"
              >
                Clear ({selectedIds.size})
              </button>
            )}

            <button
              onClick={() => handlePrint(selectedIds.size > 0 ? selectedRooms : filteredRooms)}
              disabled={isPrinting || (filteredRooms.length === 0)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition disabled:opacity-50"
            >
              {isPrinting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                : <><Printer className="w-4 h-4" /> Print {selectedIds.size > 0 ? `${selectedIds.size} Selected` : `All (${filteredRooms.length})`}</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Instruction Banner ────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
            <Star className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-900">How it works</p>
            <p className="text-xs text-indigo-600/80 mt-0.5">
              Each QR code is cryptographically signed and unique to the room. Print and place the tent card on the room desk.
              Guests scan with any smartphone camera — no app needed. Orders arrive instantly in the POS with an audio chime.
              <span className="font-bold"> Room charge requires an active checked-in reservation.</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Room Grid / List ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-500">Loading rooms…</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <QrCode className="w-12 h-12 text-slate-300" />
            <h3 className="font-bold text-slate-700">No rooms found</h3>
            <p className="text-sm text-slate-400">Try adjusting your search.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-in fade-in duration-500">
            {filteredRooms.map(room => {
              const isSelected = selectedIds.has(room.id);
              const token = tokenMap[room.id] || '';
              const url = token ? buildRoomServiceUrl(token, room.number) : '';
              return (
                <div
                  key={room.id}
                  className={`group relative bg-white rounded-2xl border-2 shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-0.5 ${
                    isSelected ? 'border-amber-400 shadow-amber-100' : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {/* Selection checkbox */}
                  <button
                    onClick={() => toggleSelect(room.id)}
                    className="absolute top-2 left-2 z-10"
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300 group-hover:border-indigo-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>

                  {/* Card body */}
                  <div className="p-4 pt-8 flex flex-col items-center gap-2 text-center">
                    {/* Mini QR preview — inline SVG */}
                    <div className={`w-14 h-14 rounded-xl overflow-hidden border flex items-center justify-center ${
                      isSelected ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50'
                    }`}>
                      {url
                        ? <QRCodeSVG value={url} size={56} level="L" includeMargin={false} />
                        : <QrCode className="w-6 h-6 text-slate-300" />
                      }
                    </div>
                    <div className="text-2xl font-black text-slate-900">{room.number}</div>
                    <div className="text-[10px] text-slate-400 font-medium leading-tight">{room.roomType?.name || 'Room'}</div>
                    {room.floor?.number && (
                      <div className="text-[10px] text-slate-300">Floor {room.floor.number}</div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className={`absolute bottom-0 inset-x-0 flex gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`}>
                    <button
                      onClick={() => setPreviewRoom(room)}
                      title="Preview card"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 text-[10px] font-semibold transition"
                    >
                      <Eye className="w-3 h-3" /> Preview
                    </button>
                    <button
                      onClick={() => handlePrint([room])}
                      title="Print this card"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-[10px] font-semibold transition"
                    >
                      <Printer className="w-3 h-3" /> Print
                    </button>
                  </div>
                  {/* spacer for hover actions */}
                  <div className="h-8" />
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div className="space-y-2 animate-in fade-in duration-500">
            {filteredRooms.map(room => {
              const isSelected = selectedIds.has(room.id);
              const token = tokenMap[room.id] || '';
              const url = token ? buildRoomServiceUrl(token, room.number) : '';
              return (
                <div
                  key={room.id}
                  className={`flex items-center gap-4 bg-white rounded-2xl border-2 p-4 shadow-sm transition-all ${
                    isSelected ? 'border-amber-400 shadow-amber-50' : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <button onClick={() => toggleSelect(room.id)}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>

                  {/* Mini QR — inline SVG */}
                  <div className="w-10 h-10 rounded-lg border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                    {url
                      ? <QRCodeSVG value={url} size={40} level="L" includeMargin={false} />
                      : <QrCode className="w-5 h-5 text-slate-300" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900">Room {room.number}</div>
                    <div className="text-xs text-slate-400">
                      {room.roomType?.name || 'Standard'}{room.floor?.number ? ` · Floor ${room.floor.number}` : ''}
                      {room.building?.name ? ` · ${room.building.name}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewRoom(room)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 text-xs font-semibold transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      onClick={() => handlePrint([room])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Preview Modal ─────────────────────────────────────────────── */}
      {previewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900">Tent Card Preview</h3>
                <p className="text-xs text-slate-500">Room {previewRoom.number}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint([previewRoom])}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setPreviewRoom(null)}
                  className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tent card preview */}
            <div className="p-6 flex justify-center bg-slate-50">
              <TentCard
                room={previewRoom}
                token={tokenMap[previewRoom.id] || ''}
                propertyName={propertyName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hidden print iframe */}
      <iframe ref={printFrameRef} className="hidden" title="print-frame" />
    </div>
  );
}
