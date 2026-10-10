/**
 * POST /api/enquiry
 * Server-side enquiry submission handler.
 * Validates, rate-limits, and delivers via Resend.
 * If Resend is not configured, logs to console and returns success
 * (production should always configure RESEND_API_KEY).
 */
import { NextRequest, NextResponse } from 'next/server';

const ENQUIRY_TYPES = ['general', 'booking', 'dining', 'pool', 'event', 'other'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limit: 5 requests per IP per 10 minutes
const RL = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  const entry = RL.get(key);
  if (!entry || entry.reset < now) {
    RL.set(key, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { type, name, email, phone, message, honeypot } = body as Record<string, string>;

  // Honeypot check — bots typically fill hidden fields
  if (honeypot) return NextResponse.json({ success: true }); // Silent reject

  // Validate
  if (!type || !ENQUIRY_TYPES.includes(type as typeof ENQUIRY_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid enquiry type' }, { status: 400 });
  }
  if (!name?.trim() || name.trim().length < 2) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!email?.trim() || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  if (!message?.trim() || message.trim().length < 10) return NextResponse.json({ error: 'Message is required (min 10 characters)' }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });

  const subject = `[Stanzel Grand Resort] ${type.charAt(0).toUpperCase() + type.slice(1)} Enquiry — ${name}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e4ddd3;border-radius:12px;">
      <h2 style="color:#1a3c34;margin-bottom:4px;">New Enquiry — Stanzel Grand Resort</h2>
      <p style="color:#6b6b6b;font-size:13px;margin-bottom:24px;">Received via stanzelgrandresort.com</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0ece4;color:#6b6b6b;font-size:13px;width:120px;">Type</td><td style="padding:8px 0;border-bottom:1px solid #f0ece4;font-weight:600;">${type}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0ece4;color:#6b6b6b;font-size:13px;">Name</td><td style="padding:8px 0;border-bottom:1px solid #f0ece4;font-weight:600;">${name}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0ece4;color:#6b6b6b;font-size:13px;">Email</td><td style="padding:8px 0;border-bottom:1px solid #f0ece4;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0ece4;color:#6b6b6b;font-size:13px;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #f0ece4;">${phone || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#6b6b6b;font-size:13px;vertical-align:top;">Message</td><td style="padding:8px 0;white-space:pre-wrap;">${message}</td></tr>
      </table>
    </div>
  `;

  const toEmail = process.env.CONTACT_EMAIL_TO ?? 'info@stanzelgrandresort.com';
  const fromEmail = process.env.CONTACT_EMAIL_FROM ?? 'noreply@stanzelgrandresort.com';
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey && resendKey !== 're_REPLACE_ME') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: fromEmail, to: [toEmail], reply_to: email, subject, html }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('[Enquiry] Resend error:', err);
        return NextResponse.json({ error: 'Could not send enquiry. Please email us directly.' }, { status: 500 });
      }
    } catch (e) {
      console.error('[Enquiry] Network error sending via Resend:', e);
      return NextResponse.json({ error: 'Could not send enquiry. Please email us directly.' }, { status: 500 });
    }
  } else {
    // Development fallback — log to console
    console.log('[Enquiry — DEV MODE] Would send email:', { to: toEmail, subject, name, email, phone, type, message });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
