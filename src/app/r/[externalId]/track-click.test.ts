import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, isPreviewBot, istDay, trackReferralClick, visitorHash } from "./track-click";

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

function tap(ua: string | null = PHONE_UA, ip = "203.0.113.7"): Request {
  const headers = new Headers({ "x-forwarded-for": `${ip}, 10.0.0.1` });
  if (ua) headers.set("user-agent", ua);
  return new Request("http://x/r/919999990001", { headers });
}

describe("trackReferralClick", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("PP_SKETCH_INTERNAL_URL", "http://pp-sketch.internal:3000");
    vi.stubEnv("PP_SKETCH_API_KEY", "test-key");
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the referrer and a visitor hash, never the IP or user agent", async () => {
    const now = new Date("2026-11-11T20:00:00Z"); // 01:30 on 12 Nov in IST
    await trackReferralClick("919999990001", tap(), now);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://pp-sketch.internal:3000/referral-clicks");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-api-key")).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      referrer: "919999990001",
      visitor_hash: visitorHash("test-key", "2026-11-12", "203.0.113.7", PHONE_UA),
    });
    expect(init.body).not.toContain("203.0.113.7");
    expect(init.body).not.toContain("Android");
  });

  it.each([
    ["WhatsApp preview", "WhatsApp/2.23.20.0 A"],
    ["Facebook crawler", "facebookexternalhit/1.1"],
    ["no user agent", null],
  ])("skips %s", async (_label, ua) => {
    await trackReferralClick("919999990001", tap(ua));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips a segment that is not a phone number", async () => {
    await trackReferralClick("hello", tap());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows pp-sketch errors so the redirect still happens", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(trackReferralClick("919999990001", tap())).resolves.toBeUndefined();
  });

  it("does nothing without an API key", async () => {
    vi.stubEnv("PP_SKETCH_API_KEY", "");
    await trackReferralClick("919999990001", tap());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("reads the first X-Forwarded-For hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.3" }))).toBe("198.51.100.3");
    expect(clientIp(new Headers())).toBe("");
  });

  it("uses the IST calendar day", () => {
    expect(istDay(new Date("2026-11-11T18:29:00Z"))).toBe("2026-11-11");
    expect(istDay(new Date("2026-11-11T18:31:00Z"))).toBe("2026-11-12");
  });

  it("treats ordinary phone browsers as people", () => {
    expect(isPreviewBot(PHONE_UA)).toBe(false);
  });

  it("gives the same visitor the same hash within a day and a new one the next day", () => {
    const a = visitorHash("k", "2026-11-11", "1.2.3.4", PHONE_UA);
    expect(visitorHash("k", "2026-11-11", "1.2.3.4", PHONE_UA)).toBe(a);
    expect(visitorHash("k", "2026-11-12", "1.2.3.4", PHONE_UA)).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
