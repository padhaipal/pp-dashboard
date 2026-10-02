import { describe, expect, it } from "vitest";
import { actsAsStaff, proxyRequestHeaders, VIEWER_ID_HEADER, VIEWER_STAFF_HEADER, viewerForward } from "./proxy-viewer";

const UUID = "5c2a6f0e-1a2b-4c3d-9e8f-0a1b2c3d4e5f";

describe("viewerForward", () => {
  it("a staff session without a viewer param (the staff /user/[id] page) becomes the staff header", () => {
    expect(viewerForward("?metric=usage", true)).toEqual({
      headers: { [VIEWER_STAFF_HEADER]: "1" },
      search: "?metric=usage",
    });
  });

  it("a /d page's viewer param wins over a staff session: a logged-in dev sees what the link holder sees", () => {
    expect(viewerForward(`?metric=usage&viewer=${UUID}`, true)).toEqual({
      headers: { [VIEWER_ID_HEADER]: UUID },
      search: "?metric=usage",
    });
    // …and a junk viewer still never falls back to staff
    expect(viewerForward("?viewer=abc", true)).toEqual({ headers: {}, search: "" });
    expect(actsAsStaff("?viewer=abc", true)).toBe(false);
    expect(actsAsStaff("?range=30", true)).toBe(true);
    expect(actsAsStaff("", false)).toBe(false);
  });

  it("a sessionless caller's uuid viewer becomes the viewer-id header (lower-cased) and leaves the query", () => {
    expect(viewerForward(`?viewer=${UUID.toUpperCase()}&range=30`, false)).toEqual({
      headers: { [VIEWER_ID_HEADER]: UUID },
      search: "?range=30",
    });
    expect(viewerForward(`?viewer=${UUID}`, false).search).toBe("");
  });

  it("a non-uuid viewer (a phone number, junk) is dropped: no header, anonymous to pp-sketch", () => {
    for (const v of ["919876543210", "abc", ""]) {
      expect(viewerForward(`?viewer=${v}&x=1`, false)).toEqual({ headers: {}, search: "?x=1" });
    }
    expect(viewerForward("", false)).toEqual({ headers: {}, search: "" });
  });
});

describe("proxyRequestHeaders", () => {
  it("forwards only content headers — never the cookie, the badge or a client-supplied viewer header — plus the viewer headers the proxy sets", () => {
    const incoming = new Headers({
      cookie: "authjs.session-token=secret",
      authorization: "Bearer nope",
      "x-pp-viewer-staff": "1",
      "x-pp-viewer-id": "attacker",
      "x-api-key": "spoof",
      "content-type": "application/json",
      accept: "application/json",
      "accept-language": "hi",
      range: "bytes=0-99",
      host: "dashboard.padhaipal.com",
    });
    const out = proxyRequestHeaders(incoming, { [VIEWER_ID_HEADER]: UUID });
    expect([...out.keys()].sort()).toEqual(["accept", "accept-language", "content-type", "range", VIEWER_ID_HEADER]);
    expect(out.get(VIEWER_ID_HEADER)).toBe(UUID);
    expect(out.get("cookie")).toBeNull();
    expect(out.get(VIEWER_STAFF_HEADER)).toBeNull();
    expect(out.get("x-api-key")).toBeNull();
  });
});
