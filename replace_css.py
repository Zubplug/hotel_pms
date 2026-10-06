import sys

with open("apps/website/src/app/globals.css", "r") as f:
    content = f.read()

start_marker = "/* ══════════════════════════════════════════════════════════════\n   PUBLIC BOOKING ENGINE — PREMIUM PROPERTY TEMPLATES"

if start_marker not in content:
    print("Marker not found")
    sys.exit(1)

parts = content.split(start_marker)
base_content = parts[0]

new_css = """/* ══════════════════════════════════════════════════════════════
   PUBLIC BOOKING ENGINE — PREMIUM PROPERTY TEMPLATES (HOSPITALITY V2)
   ══════════════════════════════════════════════════════════════ */
.bk-site { 
  min-height: 100svh; 
  overflow-x: hidden; 
  color: var(--bk-text); 
  background: var(--bk-bg); 
  font-family: var(--font-body); 
  transition: background-color 0.4s ease, color 0.4s ease;
}
.bk-site *, .bk-site *::before, .bk-site *::after { box-sizing: border-box; }
.bk-template-width { width: min(100%, 1160px); margin: 0 auto; padding-left: 28px; padding-right: 28px; }

/* ── DISTINCT THEMES ────────────────────────────────────────── */
/* Classic Hotel: Charcoal/Ink + Champagne/Gold */
.bk-site-classic {
  --bk-bg: #141416;
  --bk-surface: #1e1e20;
  --bk-surface-raised: #28282b;
  --bk-border: rgba(212, 175, 55, 0.15);
  --bk-primary: #d4af37;
  --bk-primary-hover: #e6c55d;
  --bk-primary-dim: rgba(212, 175, 55, 0.1);
  --bk-secondary: #f3e5ab;
  --bk-text: #f5f5f5;
  --bk-muted: #a3a3a3;
}
.bk-site-classic .bk-header { background: rgba(20, 20, 22, 0.85); border-bottom: 1px solid rgba(212, 175, 55, 0.2); }
.bk-site-classic .bk-hero::before { background: radial-gradient(circle at 14% 10%, rgba(212, 175, 55, 0.08), transparent 45%), linear-gradient(135deg, #18181b 0%, #111112 100%); }

/* Modern Boutique: Deep Violet + Electric Lavender + Glass */
.bk-site-modern-boutique {
  --bk-bg: #0f0a17;
  --bk-surface: #171024;
  --bk-surface-raised: #201533;
  --bk-border: rgba(189, 147, 249, 0.2);
  --bk-primary: #bd93f9;
  --bk-primary-hover: #d6b4fc;
  --bk-primary-dim: rgba(189, 147, 249, 0.12);
  --bk-secondary: #ff79c6;
  --bk-text: #f8f8f2;
  --bk-muted: #9c92b8;
}
.bk-site-modern-boutique .bk-header { background: rgba(15, 10, 23, 0.8); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(189, 147, 249, 0.15); }
.bk-site-modern-boutique .bk-hero::before { background: radial-gradient(circle at 14% 10%, rgba(189,147,249, 0.12), transparent 40%), linear-gradient(140deg, #130c1d, #0b0712 62%, #191226); }

/* Resort: Deep Ocean/Emerald + #79e4bb */
.bk-site-resort {
  --bk-bg: #041210;
  --bk-surface: #071c19;
  --bk-surface-raised: #0a2622;
  --bk-border: rgba(121, 228, 187, 0.15);
  --bk-primary: #79e4bb;
  --bk-primary-hover: #98eccb;
  --bk-primary-dim: rgba(121, 228, 187, 0.1);
  --bk-secondary: #0ea5e9;
  --bk-text: #e6f7f2;
  --bk-muted: #8ab5a7;
}
.bk-site-resort .bk-header { background: rgba(4, 18, 16, 0.85); border-bottom: 1px solid rgba(121,228,187, 0.15); }
.bk-site-resort .bk-hero::before { background: radial-gradient(circle at 82% 0, rgba(14,165,233, 0.15), transparent 35%), linear-gradient(145deg, #051614, #030d0b 58%, #08211d); }

/* Business Hotel: Navy/Slate + Cyan/Blue */
.bk-site-business {
  --bk-bg: #060f1c;
  --bk-surface: #0a1628;
  --bk-surface-raised: #0f2038;
  --bk-border: rgba(56, 189, 248, 0.15);
  --bk-primary: #38bdf8;
  --bk-primary-hover: #7dd3fc;
  --bk-primary-dim: rgba(56, 189, 248, 0.1);
  --bk-secondary: #818cf8;
  --bk-text: #f0f6fc;
  --bk-muted: #94a3b8;
}
.bk-site-business .bk-header { background: rgba(6, 15, 28, 0.9); border-bottom: 1px solid rgba(56,189,248, 0.2); }
.bk-site-business .bk-hero::before { background: radial-gradient(circle at 75% 0, rgba(56,189,248, 0.12), transparent 34%), linear-gradient(135deg, #071220, #040b14 58%, #0c1a2d); }

/* ── HEADER ─────────────────────────────────────────────────── */
.bk-header { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(18px); }
.bk-header-inner { width: min(100%, 1160px); min-height: 78px; margin: 0 auto; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.bk-brand-link { color: inherit; text-decoration: none; }
.bk-brand { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
.bk-brand img { width: auto; height: 38px; max-width: 150px; object-fit: contain; }
.bk-brand-mark { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px; background: linear-gradient(135deg, var(--bk-primary), var(--bk-secondary)); color: #000; font: 800 12px var(--font-display); box-shadow: 0 8px 24px var(--bk-primary-dim); }
.bk-brand-name { max-width: 250px; overflow: hidden; color: var(--bk-text); font: 700 17px var(--font-display); letter-spacing: -.03em; text-overflow: ellipsis; white-space: nowrap; }
.bk-brand-compact img, .bk-brand-compact .bk-brand-mark { height: 32px; width: 32px; flex-basis: 32px; border-radius: 9px; font-size: 10px; }
.bk-brand-compact .bk-brand-name { font-size: 15px; }
.bk-header-meta { display: flex; align-items: center; gap: 20px; color: var(--bk-muted); font-size: 12px; }
.bk-header-tagline { max-width: 310px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-body); }
.bk-secure-label { display: inline-flex; align-items: center; gap: 8px; color: var(--bk-text); font: 600 11px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
.bk-secure-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bk-primary); box-shadow: 0 0 10px var(--bk-primary); }

/* ── HERO ───────────────────────────────────────────────────── */
.bk-hero { position: relative; min-height: 360px; display: grid; place-items: center; isolation: isolate; overflow: hidden; border-bottom: 1px solid var(--bk-border); }
.bk-hero::before { content: ""; position: absolute; inset: 0; z-index: -2; } /* Defined per theme above */
/* Removed neon glows and excessive orbits for premium hospitality feel */
.bk-hero-content { width: min(100%, 1160px); padding: 70px 28px 60px; text-align: center; display: flex; flex-direction: column; align-items: center; }
.bk-kicker { display: inline-flex; align-items: center; justify-content: center; gap: 12px; color: var(--bk-primary); font: 600 11px var(--font-mono); letter-spacing: .18em; text-transform: uppercase; margin-bottom: 16px; }
.bk-kicker-line { width: 32px; height: 1px; background: currentColor; }
.bk-hero h1, .bk-business-intro h1 { max-width: 800px; margin: 0 0 16px; color: var(--bk-text); font: 400 clamp(2.4rem, 5vw, 4.2rem)/1.1 var(--font-display); letter-spacing: -.03em; }
.bk-hero p, .bk-business-intro p { max-width: 580px; margin: 0; color: var(--bk-muted); font-size: 16px; line-height: 1.6; font-weight: 300; }
.bk-trust-bar { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 32px; }
.bk-trust-bar span { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--bk-border); border-radius: 100px; color: var(--bk-text); background: var(--bk-surface); font: 500 11px var(--font-mono); letter-spacing: .05em; transition: background 0.3s; }
.bk-trust-bar span:hover { background: var(--bk-surface-raised); }
.bk-trust-bar i { color: var(--bk-primary); font-style: normal; }

/* ── CONTENT ────────────────────────────────────────────────── */
.bk-content { padding-top: 40px; padding-bottom: 100px; }
.bk-section-rule { display: flex; align-items: center; gap: 16px; margin: 0 0 28px; color: var(--bk-text); font: 500 12px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.bk-section-rule::after { content: ""; height: 1px; flex: 1; background: linear-gradient(90deg, var(--bk-border), transparent); }
.bk-section-rule span { white-space: nowrap; color: var(--bk-primary); }

/* ── FOOTER ─────────────────────────────────────────────────── */
.bk-footer { border-top: 1px solid var(--bk-border); background: var(--bk-surface); }
.bk-footer-inner { width: min(100%, 1160px); min-height: 80px; margin: 0 auto; padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; gap: 20px; color: var(--bk-muted); font-size: 12px; }
.bk-footer-inner > div:last-child { display: flex; align-items: center; gap: 10px; }
.bk-footer-divider { color: var(--bk-border); }

/* ── MISC UTILS ─────────────────────────────────────────────── */
.bk-site .bk-content a:not(.btn) { color: var(--bk-primary); transition: opacity 0.2s; }
.bk-site .bk-content a:not(.btn):hover { opacity: 0.8; }
.bk-site input:focus, .bk-site select:focus, .bk-site textarea:focus, .bk-site button:focus-visible, .bk-site a:focus-visible { outline: 2px solid var(--bk-primary); outline-offset: 2px; }

@media (max-width: 720px) {
  .bk-template-width, .bk-header-inner, .bk-hero-content, .bk-footer-inner { padding-left: 20px; padding-right: 20px; }
  .bk-header-inner { min-height: 70px; }
  .bk-header-tagline { display: none; }
  .bk-secure-label { font-size: 10px; }
  .bk-hero { min-height: 300px; }
  .bk-hero-content { padding-top: 48px; padding-bottom: 48px; }
  .bk-hero h1 { font-size: clamp(2.2rem, 9vw, 3rem); }
  .bk-trust-bar { gap: 8px; }
  .bk-trust-bar span { font-size: 10px; padding: 7px 12px; }
  .bk-content { padding-top: 32px; padding-bottom: 80px; }
  .bk-footer-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
}
"""

with open("apps/website/src/app/globals.css", "w") as f:
    f.write(base_content + new_css)
print("CSS injected successfully")
