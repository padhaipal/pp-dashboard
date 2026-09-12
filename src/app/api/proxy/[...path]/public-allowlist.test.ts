import { describe, expect, it } from "vitest";
import { isPublicAllowed } from "./public-allowlist";

describe("proxy public allowlist", () => {
  it("accepts the four public paths with their methods", () => {
    expect(isPublicAllowed("users/abc/public", "GET")).toBe(true);
    expect(isPublicAllowed("users/abc/profile", "PATCH")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/scores", "GET")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/scores.csv", "GET")).toBe(true);
    expect(isPublicAllowed("geo-entities/g1/spotlight", "GET")).toBe(true);
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
});
