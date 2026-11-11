// Records one tap on a /r/<phone> referral link in pp-sketch
// (POST /referral-clicks → referral_link_clicks). Best effort: the redirect
// must never fail or stall because of tracking, so every error is swallowed
// and the call gives up after TRACK_TIMEOUT_MS.
//
// No IP or user agent leaves this file: pp-sketch only gets an HMAC of
// (IST day, IP, user agent) keyed with the dashboard's API key, enough to
// count distinct visitors per day but not to recover who they were.

import { createHmac } from "node:crypto";
import { ppSketchFetch } from "@/lib/pp-sketch";

export const TRACK_TIMEOUT_MS = 1500;

// Link-preview fetchers and crawlers. WhatsApp loads every shared link once
// to build its preview card; counting those would count shares, not taps.
const BOT_UA = /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

// The visitor's IP as Railway's proxy reports it (first X-Forwarded-For hop).
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}

// YYYY-MM-DD in IST, so "distinct visitors per day" matches the rest of the
// dashboard's day boundaries.
export function istDay(now: Date): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function visitorHash(key: string, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", key).update(`${day}|${ip}|${userAgent}`).digest("hex");
}

export async function trackReferralClick(referrer: string, req: Request, now: Date = new Date()): Promise<void> {
  try {
    if (!/^\d{6,15}$/.test(referrer)) return;
    const userAgent = req.headers.get("user-agent");
    if (isPreviewBot(userAgent)) return;
    const key = process.env.PP_SKETCH_API_KEY;
    if (!key) return;
    const hash = visitorHash(key, istDay(now), clientIp(req.headers), userAgent ?? "");
    await ppSketchFetch("referral-clicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrer, visitor_hash: hash }),
      signal: AbortSignal.timeout(TRACK_TIMEOUT_MS),
    });
  } catch {
    // Tracking is best effort; the redirect carries on regardless.
  }
}
