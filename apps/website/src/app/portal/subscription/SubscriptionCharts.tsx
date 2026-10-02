"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────────────────────── */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 1200,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const start = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    const animate = (ts: number) => {
      if (start.current === null) start.current = ts;
      const elapsed = ts - start.current;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * value));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   SUBSCRIPTION HEALTH ARC GAUGE
   Shows % of billing period remaining as an animated SVG arc
───────────────────────────────────────────────────────────── */
export function SubscriptionHealthGauge({
  daysRemaining,
  totalDays,
  status,
  planName,
}: {
  daysRemaining: number;
  totalDays: number;
  status: string | null;
  planName: string;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 200); return () => clearTimeout(t); }, []);

  const pct = totalDays > 0 ? Math.max(0, Math.min(1, daysRemaining / totalDays)) : 0;
  const r = 52;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  const arcAngle = 240; // degrees of arc shown
  const arcLength = (arcAngle / 360) * circumference;
  const offset = arcLength - (animated ? pct : 0) * arcLength;

  const statusColor =
    status === "ACTIVE" ? "#3ef5a0" :
    status === "PAST_DUE" ? "#ff5f72" :
    status === "TRIALING" ? "#ffbe5a" :
    "#00d4e8";

  const rotation = -120; // start from bottom-left

  return (
    <div className="sub-gauge-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Background arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={statusColor}
          strokeWidth="10"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.25,.46,.45,.94)", filter: `drop-shadow(0 0 8px ${statusColor}80)` }}
        />
        {/* Glow dot at tip */}
        {pct > 0.03 && (
          <circle r="5" fill={statusColor} style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}>
            <animateMotion
              dur="0s"
              fill="freeze"
              path={`M ${cx} ${cy - r}`}
            />
          </circle>
        )}
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="22" fontWeight="800" fontFamily="Sora, system-ui">
          {daysRemaining}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="0.1em">
          DAYS LEFT
        </text>
        <text x={cx} y={cy + 26} textAnchor="middle" fill={statusColor} fontSize="8" fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="0.15em">
          {(pct * 100).toFixed(0)}%
        </text>
      </svg>
      <div className="sub-gauge-label">{planName}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   INVOICE TREND AREA CHART
   Shows monthly spend trend as a smooth SVG path
───────────────────────────────────────────────────────────── */
export function InvoiceTrendChart({
  invoices,
  currency,
}: {
  invoices: { createdAt: string; total: number; status: string }[];
  currency: string;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t); }, []);

  const sorted = [...invoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-8);
  if (sorted.length < 2) {
    return (
      <div className="sub-chart-empty">
        <span>Billing history will appear after your first cycle</span>
      </div>
    );
  }

  const W = 340;
  const H = 90;
  const PAD = { top: 10, right: 8, bottom: 20, left: 8 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...sorted.map(i => i.total), 1);

  const points = sorted.map((inv, idx) => ({
    x: PAD.left + (idx / (sorted.length - 1)) * iw,
    y: PAD.top + ih - (inv.total / maxVal) * ih,
    inv,
  }));

  // Smooth bezier path
  const pathD = points.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = points[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    return acc + ` C ${cx1},${prev.y} ${cx1},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  // Area fill
  const areaD = pathD + ` L ${points[points.length - 1].x},${H - PAD.bottom} L ${PAD.left},${H - PAD.bottom} Z`;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="sub-chart-wrap" style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="invoiceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d4e8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00d4e8" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="invoiceClip">
            <rect x="0" y="0" width={animated ? W : 0} height={H} style={{ transition: "width 1.4s cubic-bezier(.25,.46,.45,.94)" }} />
          </clipPath>
        </defs>
        {/* Area fill */}
        <path d={areaD} fill="url(#invoiceGrad)" clipPath="url(#invoiceClip)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#00d4e8" strokeWidth="2" strokeLinecap="round" clipPath="url(#invoiceClip)" style={{ filter: "drop-shadow(0 0 4px rgba(0,212,232,0.5))" }} />
        {/* Dots */}
        {points.map((pt, i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
            <circle cx={pt.x} cy={pt.y} r={hovered === i ? 5 : 3} fill={hovered === i ? "#00d4e8" : "#0c1624"} stroke="#00d4e8" strokeWidth="1.5" style={{ transition: "r .15s" }} />
          </g>
        ))}
        {/* Tooltip */}
        {hovered !== null && (
          <g>
            <rect x={Math.min(points[hovered].x - 50, W - 110)} y={points[hovered].y - 36} width={100} height={28} rx="6" fill="rgba(8,15,26,0.95)" stroke="rgba(0,212,232,0.3)" strokeWidth="1" />
            <text x={Math.min(points[hovered].x - 50, W - 110) + 50} y={points[hovered].y - 22} textAnchor="middle" fill="#eaf1f8" fontSize="10" fontWeight="700" fontFamily="Sora, system-ui">
              {new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(points[hovered].inv.total / 100)}
            </text>
            <text x={Math.min(points[hovered].x - 50, W - 110) + 50} y={points[hovered].y - 11} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8" fontFamily="JetBrains Mono, monospace">
              {new Date(points[hovered].inv.createdAt).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
            </text>
          </g>
        )}
        {/* X-axis labels */}
        {points.map((pt, i) => (
          <text key={i} x={pt.x} y={H - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontFamily="JetBrains Mono, monospace">
            {new Date(pt.inv.createdAt).toLocaleDateString("en-GB", { month: "short" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MODULE COVERAGE BAR
   Horizontal stacked bar showing entitlement categories
───────────────────────────────────────────────────────────── */
export function ModuleCoverageBar({
  entitlements,
}: {
  entitlements: { code: string; name: string }[];
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 600); return () => clearTimeout(t); }, []);

  const categories = [
    { label: "Core PMS", codes: ["CORE", "PMS", "RESERVATION", "FRONT_DESK"], color: "#00d4e8", icon: "◈" },
    { label: "Operations", codes: ["POS", "HOUSEKEEPING", "MAINTENANCE", "INVENTORY", "KDS"], color: "#3ef5a0", icon: "⚙" },
    { label: "Commerce", codes: ["BOOKING_ENGINE", "CHANNEL", "COMMERCE", "OTA"], color: "#ffbe5a", icon: "◇" },
    { label: "Finance", codes: ["FINANCE", "LEDGER", "ACCOUNTING", "GL", "AP"], color: "#a78bfa", icon: "◎" },
    { label: "Guest", codes: ["GUEST", "LOYALTY", "CRM", "MESSAGING"], color: "#f472b6", icon: "✦" },
    { label: "Intelligence", codes: ["INTELLIGENCE", "AI", "REVENUE", "FORECAST"], color: "#fb923c", icon: "◈" },
    { label: "Connected", codes: ["SMART", "ACCESS", "IOT", "LOCK", "ESG"], color: "#34d399", icon: "⟳" },
    { label: "Enterprise", codes: ["ENTERPRISE", "MULTI_PROPERTY", "API", "SSO"], color: "#60a5fa", icon: "▣" },
  ];

  const active = entitlements.map(e => e.code.toUpperCase());
  const matched = categories.map(cat => ({
    ...cat,
    count: active.filter(code => cat.codes.some(c => code.includes(c))).length,
    total: cat.codes.length,
  }));

  const totalActive = matched.reduce((s, c) => s + (c.count > 0 ? 1 : 0), 0);

  return (
    <div className="sub-module-coverage">
      {matched.map((cat, i) => {
        const pct = cat.count > 0 ? 100 : 0;
        return (
          <div key={cat.label} className="sub-module-row" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="sub-module-label">
              <span style={{ color: cat.color, marginRight: 6, fontSize: 10 }}>{cat.icon}</span>
              <span>{cat.label}</span>
            </div>
            <div className="sub-module-track">
              <div
                className="sub-module-fill"
                style={{
                  width: animated ? `${pct}%` : "0%",
                  background: cat.color,
                  boxShadow: pct > 0 ? `0 0 8px ${cat.color}60` : "none",
                  transition: `width 0.8s cubic-bezier(.25,.46,.45,.94) ${i * 60}ms`,
                }}
              />
            </div>
            <div className="sub-module-status" style={{ color: pct > 0 ? cat.color : "rgba(255,255,255,0.2)" }}>
              {pct > 0 ? "Active" : "—"}
            </div>
          </div>
        );
      })}
      <div className="sub-module-summary">
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
          {totalActive}/{categories.length} module categories active
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROPERTY READINESS GRID
   Shows property status as animated circle indicators
───────────────────────────────────────────────────────────── */
export function PropertyReadinessGrid({
  properties,
}: {
  properties: { id: string; name: string; isActive: boolean; ready: boolean }[];
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);

  if (!properties.length) {
    return <div className="sub-chart-empty"><span>No properties configured yet</span></div>;
  }

  return (
    <div className="sub-property-grid">
      {properties.map((prop, i) => {
        const color = prop.ready ? "#3ef5a0" : prop.isActive ? "#ffbe5a" : "#4e6678";
        const label = prop.ready ? "Live" : prop.isActive ? "Setting up" : "Inactive";
        return (
          <div key={prop.id} className="sub-property-item" title={`${prop.name} — ${label}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div
              className="sub-property-dot"
              style={{
                background: animated ? color : "rgba(255,255,255,0.06)",
                boxShadow: animated && prop.ready ? `0 0 10px ${color}80` : "none",
                transition: `background 0.5s ease ${i * 40}ms, box-shadow 0.5s ease ${i * 40}ms`,
              }}
            />
            <div className="sub-property-name">{prop.name.slice(0, 14)}</div>
            <div className="sub-property-status" style={{ color }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BILLING HEALTH MINI DONUT
───────────────────────────────────────────────────────────── */
export function BillingHealthDonut({
  paid,
  due,
  failed,
}: {
  paid: number;
  due: number;
  failed: number;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 500); return () => clearTimeout(t); }, []);

  const total = paid + due + failed;
  if (total === 0) return null;

  const segments = [
    { value: paid, color: "#3ef5a0", label: "Paid" },
    { value: due, color: "#ffbe5a", label: "Due" },
    { value: failed, color: "#ff5f72", label: "Failed" },
  ].filter(s => s.value > 0);

  const r = 28;
  const cx = 36;
  const cy = 36;
  const circumference = 2 * Math.PI * r;
  let runningPct = 0;

  return (
    <div className="sub-donut-wrap">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        {segments.map((seg, i) => {
          const segPct = seg.value / total;
          const dashArray = circumference * (animated ? segPct : 0);
          const dashOffset = -circumference * runningPct;
          runningPct += segPct;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="8"
              strokeLinecap="butt"
              strokeDasharray={`${dashArray} ${circumference}`}
              strokeDashoffset={dashOffset - circumference * 0.25}
              style={{ transition: `stroke-dasharray 0.8s cubic-bezier(.25,.46,.45,.94) ${i * 100}ms`, filter: `drop-shadow(0 0 4px ${seg.color}60)` }}
            />
          );
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="13" fontWeight="800" fontFamily="Sora, system-ui">
          {Math.round((paid / total) * 100)}%
        </text>
      </svg>
      <div className="sub-donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="sub-donut-leg-row">
            <span className="sub-donut-dot" style={{ background: seg.color }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{seg.label}</span>
            <span style={{ color: seg.color, fontSize: 10, fontWeight: 700 }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SPEND FORECAST BAR
   Simple bar chart of monthly spend vs budget
───────────────────────────────────────────────────────────── */
export function SpendForecastBars({
  invoices,
  currency,
}: {
  invoices: { createdAt: string; total: number; amountPaid: number; amountDue: number }[];
  currency: string;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 500); return () => clearTimeout(t); }, []);

  const fmt = (n: number) =>
    n >= 1_000_000_00
      ? `${(n / 100_000_000).toFixed(1)}M`
      : n >= 1_000_00
      ? `${(n / 100_000).toFixed(0)}K`
      : `${(n / 100).toFixed(0)}`;

  const sorted = [...invoices]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-6);

  if (!sorted.length) return null;

  const maxTotal = Math.max(...sorted.map(i => i.total), 1);

  return (
    <div className="sub-spend-bars">
      {sorted.map((inv, i) => {
        const paidPct = animated ? (inv.amountPaid / maxTotal) * 100 : 0;
        const duePct = animated ? (inv.amountDue / maxTotal) * 100 : 0;
        return (
          <div key={i} className="sub-spend-bar-col">
            <div className="sub-spend-bar-track">
              <div
                className="sub-spend-bar-paid"
                style={{
                  height: `${paidPct}%`,
                  transition: `height 0.8s cubic-bezier(.25,.46,.45,.94) ${i * 80}ms`,
                }}
                title={`Paid: ${fmt(inv.amountPaid)} ${currency}`}
              />
              {duePct > 0 && (
                <div
                  className="sub-spend-bar-due"
                  style={{
                    height: `${duePct}%`,
                    transition: `height 0.8s cubic-bezier(.25,.46,.45,.94) ${i * 80 + 100}ms`,
                  }}
                  title={`Due: ${fmt(inv.amountDue)} ${currency}`}
                />
              )}
            </div>
            <div className="sub-spend-bar-label">
              {new Date(inv.createdAt).toLocaleDateString("en-GB", { month: "short" })}
            </div>
            <div className="sub-spend-bar-value">{fmt(inv.total)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RENEWAL PROGRESS BAR
───────────────────────────────────────────────────────────── */
export function RenewalProgressBar({
  periodStart,
  periodEnd,
}: {
  periodStart: string;
  periodEnd: string;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 300); return () => clearTimeout(t); }, []);

  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();
  const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const remaining = 1 - elapsed;

  const color = remaining > 0.4 ? "#3ef5a0" : remaining > 0.2 ? "#ffbe5a" : "#ff5f72";

  return (
    <div className="sub-renewal-bar-wrap">
      <div className="sub-renewal-bar-track">
        <div
          className="sub-renewal-bar-fill"
          style={{
            width: animated ? `${elapsed * 100}%` : "0%",
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
            transition: "width 1.2s cubic-bezier(.25,.46,.45,.94)",
          }}
        />
      </div>
      <div className="sub-renewal-bar-labels">
        <span>{new Date(periodStart).toLocaleDateString("en-GB")}</span>
        <span style={{ color, fontWeight: 700 }}>{(remaining * 100).toFixed(0)}% remaining</span>
        <span>{new Date(periodEnd).toLocaleDateString("en-GB")}</span>
      </div>
    </div>
  );
}
