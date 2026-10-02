import { describe, expect, it } from "vitest";
import { parseCookieHeader, readCookie } from "./cookies.js";

describe("readCookie", () => {
  it("reads a cookie set by cookie-parser", () => {
    expect(readCookie({ cookies: { session: "abc" } }, "session")).toBe("abc");
  });

  it("returns an empty string when the cookie is absent", () => {
    expect(readCookie({ cookies: { other: "x" } }, "session")).toBe("");
  });

  it("returns an empty string when the jar is malformed", () => {
    expect(readCookie({ cookies: "not-an-object" }, "session")).toBe("");
    expect(readCookie({ cookies: undefined }, "session")).toBe("");
  });
});

describe("parseCookieHeader", () => {
  it("parses a single cookie", () => {
    expect(parseCookieHeader("session=abc")).toEqual({ session: "abc" });
  });

  it("parses several cookies", () => {
    expect(parseCookieHeader("session=abc; oauth_state=xyz")).toEqual({
      session: "abc",
      oauth_state: "xyz",
    });
  });

  it("tolerates missing whitespace after the separator", () => {
    expect(parseCookieHeader("a=1;b=2")).toEqual({ a: "1", b: "2" });
  });

  it("returns an empty jar when the header is absent or empty", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });

  it("decodes percent-encoded values, like cookie-parser does", () => {
    expect(parseCookieHeader("redirect=%2Fmusics%3Fa%3D1")).toEqual({
      redirect: "/musics?a=1",
    });
  });

  it("keeps a value that is not valid percent-encoding verbatim", () => {
    expect(parseCookieHeader("weird=100%")).toEqual({ weird: "100%" });
  });

  it("keeps the first occurrence of a repeated cookie", () => {
    expect(parseCookieHeader("session=first; session=second")).toEqual({
      session: "first",
    });
  });

  it("ignores segments without a value separator", () => {
    expect(parseCookieHeader("broken; session=abc")).toEqual({
      session: "abc",
    });
  });

  it("keeps an empty value", () => {
    expect(parseCookieHeader("session=")).toEqual({ session: "" });
  });

  it("preserves '=' inside the value", () => {
    expect(parseCookieHeader("token=a=b=c")).toEqual({ token: "a=b=c" });
  });

  it("feeds readCookie, so the ws upgrade reads the same session cookie", () => {
    const cookies = parseCookieHeader("session=from-upgrade");

    expect(readCookie({ cookies }, "session")).toBe("from-upgrade");
  });
});
