import { describe, expect, it } from "vitest";
import { forwardedSearch, isPublicAllowed } from "./public-allowlist";

describe("proxy public allowlist", () => {
  it("accepts the four public paths with their methods", () => {
    expect(isPublicAllowed("users/abc/public", "GET")).toBe(true);
    expect(isPublicAllowed("users/abc/profile", "PATCH")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/scores", "GET")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/scores.csv", "GET")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/spotlight", "GET")).toBe(true);
  });

  it("accepts the student-modal reads (history, media, audio) — GET only", () => {
    expect(isPublicAllowed("users/abc/literacy-test-scores", "GET")).toBe(true);
    expect(isPublicAllowed("users/abc/media", "GET")).toBe(true);
    expect(isPublicAllowed("media-meta-data/m1/audio", "GET")).toBe(true);
    expect(isPublicAllowed("users/abc/media", "POST")).toBe(false);
    expect(isPublicAllowed("media-meta-data/m1", "GET")).toBe(false);
    expect(isPublicAllowed("media-meta-data/m1/dashboard-transcript", "POST")).toBe(false);
    expect(isPublicAllowed("users/abc/metrics", "GET")).toBe(false);
  });

  it("accepts the student-modal letter chart reads (scores, letter-bins) — GET only", () => {
    expect(isPublicAllowed("users/abc/scores", "GET")).toBe(true);
    expect(isPublicAllowed("scores/letter-bins", "GET")).toBe(true);
    expect(isPublicAllowed("users/abc/scores", "POST")).toBe(false);
    expect(isPublicAllowed("scores/letter-bins", "POST")).toBe(false);
    expect(isPublicAllowed("scores", "GET")).toBe(false);
  });

  it("rejects staff detail and wrong methods", () => {
    expect(isPublicAllowed("users/abc", "GET")).toBe(false);
    expect(isPublicAllowed("users/abc", "PATCH")).toBe(false);
    expect(isPublicAllowed("users/abc/profile", "GET")).toBe(false);
    expect(isPublicAllowed("users/abc/public", "PATCH")).toBe(false);
    expect(isPublicAllowed("geo-entities/g1/scores", "POST")).toBe(false);
    expect(isPublicAllowed("geo-entities/g1/descendants", "GET")).toBe(false);
    expect(isPublicAllowed("users/dashboard", "GET")).toBe(false);
  });

  it("drops the staff-only onboarding param from the media feed for sessionless callers", () => {
    // public /d modal: the param never reaches pp-sketch
    expect(forwardedSearch("users/abc/media", "GET", "?onboarding=1", false)).toBe("");
    expect(forwardedSearch("users/abc/media", "GET", "?offset=100&onboarding=1", false)).toBe("?offset=100");
    expect(forwardedSearch("users/abc/media", "GET", "?onboarding=1&onboarding=1&offset=0", false)).toBe("?offset=0");
    // nothing to strip → forwarded untouched
    expect(forwardedSearch("users/abc/media", "GET", "?offset=100", false)).toBe("?offset=100");
    expect(forwardedSearch("users/abc/media", "GET", "", false)).toBe("");
    // staff session (admin /user/:id page): forwarded as sent
    expect(forwardedSearch("users/abc/media", "GET", "?offset=0&onboarding=1", true)).toBe("?offset=0&onboarding=1");
    // other paths are not touched
    expect(forwardedSearch("users/abc/scores", "GET", "?onboarding=1", false)).toBe("?onboarding=1");
    expect(forwardedSearch("geo-entities/g1/scores", "GET", "?metric=usage&range=30", false)).toBe("?metric=usage&range=30");
  });
});
