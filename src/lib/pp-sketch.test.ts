import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_KEY_HEADER, ppSketchBaseUrl, ppSketchFetch, ppSketchHeaders } from "./pp-sketch";

describe("pp-sketch client", () => {
  beforeEach(() => {
    vi.stubEnv("PP_SKETCH_INTERNAL_URL", "http://pp-sketch.railway.internal:3000/");
    vi.stubEnv("PP_SKETCH_API_KEY", "dash-badge");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("base url drops trailing slashes; both env vars are required", () => {
    expect(ppSketchBaseUrl()).toBe("http://pp-sketch.railway.internal:3000");
    vi.stubEnv("PP_SKETCH_INTERNAL_URL", "");
    expect(() => ppSketchBaseUrl()).toThrow("PP_SKETCH_INTERNAL_URL is not set");
    vi.stubEnv("PP_SKETCH_API_KEY", "");
    expect(() => ppSketchHeaders()).toThrow("PP_SKETCH_API_KEY is not set");
  });

  it("headers: the badge on top of whatever the caller passes (and it cannot be overridden)", () => {
    const h = ppSketchHeaders({ "Content-Type": "application/json", [API_KEY_HEADER]: "spoof" });
    expect(h.get("content-type")).toBe("application/json");
    expect(h.get(API_KEY_HEADER)).toBe("dash-badge");
  });

  it("fetch: joins the path (leading slash or not, query kept) and sends the badge with the caller's init", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    await ppSketchFetch("/users/u1/media?offset=20", { method: "GET", cache: "no-store" });
    await ppSketchFetch("quiz/stats", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    const [url1, init1] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const [url2, init2] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url1).toBe("http://pp-sketch.railway.internal:3000/users/u1/media?offset=20");
    expect(init1.cache).toBe("no-store");
    expect(new Headers(init1.headers).get(API_KEY_HEADER)).toBe("dash-badge");
    expect(url2).toBe("http://pp-sketch.railway.internal:3000/quiz/stats");
    expect(init2.body).toBe("{}");
    expect(new Headers(init2.headers).get("content-type")).toBe("application/json");
    expect(new Headers(init2.headers).get(API_KEY_HEADER)).toBe("dash-badge");
  });
});
