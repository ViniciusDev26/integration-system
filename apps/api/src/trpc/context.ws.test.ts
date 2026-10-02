import { describe, expect, it, vi } from "vitest";
import type { User } from "../shared/db/schema/users.js";
import { createWSContextFactory } from "./context.js";

const user: User = {
  id: "user-1",
  githubId: "gh-1",
  name: "Ada",
  email: "ada@example.com",
  imageUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function authServiceReturning(result: User | null) {
  return { getCurrentUser: vi.fn(async () => result) };
}

describe("createWSContextFactory", () => {
  it("resolves the user from the session cookie on the upgrade request", async () => {
    const authService = authServiceReturning(user);
    const createContext = createWSContextFactory(authService);

    const ctx = await createContext({
      req: { headers: { cookie: "session=sess-abc" } },
    });

    expect(authService.getCurrentUser).toHaveBeenCalledWith("sess-abc");
    expect(ctx.user).toEqual(user);
  });

  it("reads the session cookie from among several", async () => {
    const authService = authServiceReturning(user);
    const createContext = createWSContextFactory(authService);

    await createContext({
      req: { headers: { cookie: "oauth_state=xyz; session=sess-abc" } },
    });

    expect(authService.getCurrentUser).toHaveBeenCalledWith("sess-abc");
  });

  it("yields an anonymous context when the upgrade carries no cookie header", async () => {
    const authService = authServiceReturning(user);
    const createContext = createWSContextFactory(authService);

    const ctx = await createContext({ req: { headers: {} } });

    expect(ctx.user).toBeNull();
    expect(authService.getCurrentUser).not.toHaveBeenCalled();
  });

  it("yields an anonymous context when the session cookie is absent", async () => {
    const authService = authServiceReturning(user);
    const createContext = createWSContextFactory(authService);

    const ctx = await createContext({
      req: { headers: { cookie: "oauth_state=xyz" } },
    });

    expect(ctx.user).toBeNull();
    expect(authService.getCurrentUser).not.toHaveBeenCalled();
  });

  it("yields an anonymous context when the session is unknown or expired", async () => {
    const authService = authServiceReturning(null);
    const createContext = createWSContextFactory(authService);

    const ctx = await createContext({
      req: { headers: { cookie: "session=stale" } },
    });

    expect(ctx.user).toBeNull();
  });

  it("exposes the parsed cookies, so procedures read them as over HTTP", async () => {
    const createContext = createWSContextFactory(authServiceReturning(user));

    const ctx = await createContext({
      req: { headers: { cookie: "session=sess-abc; oauth_state=xyz" } },
    });

    expect(ctx.req.cookies).toEqual({
      session: "sess-abc",
      oauth_state: "xyz",
    });
  });

  it("refuses cookie writes, which a WebSocket cannot deliver", async () => {
    const createContext = createWSContextFactory(authServiceReturning(user));

    const ctx = await createContext({
      req: { headers: { cookie: "session=sess-abc" } },
    });

    expect(() => ctx.res.cookie("session", "new")).toThrow(/WebSocket/);
    expect(() => ctx.res.clearCookie("session")).toThrow(/WebSocket/);
  });
});
