import superjson from "superjson";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestContainer } from "../container-test.js";
import { SESSION_COOKIE } from "../modules/auth/http/auth.controller.constants.js";
import { createAuthController } from "../modules/auth/http/auth.controller.js";
import { createMediaController } from "../modules/media/media.controller.js";
import type { User } from "../shared/db/schema/users.js";
import { createContextFactory } from "./context.js";
import { createAppRouter } from "./router.js";

/**
 * Proves the superjson transformer is actually in force **over HTTP** (ADR 0042).
 *
 * Every other router test goes through `createCaller`, which invokes the router
 * in-process and never serializes anything — so those tests pass identically
 * with or without a transformer and cannot catch its removal. This one makes a
 * real request and asserts a `Date` survives the round trip as a `Date`, which
 * is the whole reason the dependency was taken.
 */

interface Harness {
  app: ReturnType<typeof createApp>;
  container: ReturnType<typeof createTestContainer>;
}

function setup(): Harness {
  const container = createTestContainer();
  const trpcRouter = createAppRouter({
    authService: container.authService,
    sessionService: container.sessionService,
    musicService: container.musicService,
    playlistService: container.playlistService,
    inviteService: container.inviteService,
    roomService: container.roomService,
    secureCookies: false,
  });

  const app = createApp({
    authController: createAuthController({
      authService: container.authService,
      secureCookies: false,
    }),
    mediaController: createMediaController({
      authService: container.authService,
      musicRepository: container.musicRepository,
      objectStorage: container.objectStorage,
    }),
    trpcRouter,
    createContext: createContextFactory(container.authService),
  });

  return { app, container };
}

/** Signs a user in the way the app does, returning the session cookie. */
async function signedInUser(
  container: Harness["container"],
): Promise<{ user: User; cookie: string }> {
  const user = await container.userRepository.upsertByGithubId({
    githubId: "gh-wire",
    name: "Ada",
    email: "ada@example.com",
    imageUrl: null,
  });
  const session = await container.sessionService.createForUser(user.id);
  return { user, cookie: `${SESSION_COOKIE}=${session.id}` };
}

describe("superjson over the wire", () => {
  it("returns a Date as a Date, not a string", async () => {
    const { app, container } = setup();
    const { cookie } = await signedInUser(container);
    const room = await container.roomService.createForUser({
      name: "Friday",
      ownerId: (await signedInUser(container)).user.id,
    });

    const response = await request(app)
      .get("/trpc/rooms.get")
      .set("Cookie", cookie)
      .query({ input: superjson.stringify({ roomId: room.id }) })
      .expect(200);

    const parsed = superjson.deserialize<{
      room: { playbackUpdatedAt: unknown };
      serverNow: unknown;
    }>(response.body.result.data);

    expect(parsed.serverNow).toBeInstanceOf(Date);
    expect(parsed.room.playbackUpdatedAt).toBeInstanceOf(Date);
  });

  it("puts the superjson envelope on the wire, not plain JSON", async () => {
    const { app, container } = setup();
    const { cookie } = await signedInUser(container);

    const response = await request(app)
      .get("/trpc/auth.me")
      .set("Cookie", cookie)
      .expect(200);

    // superjson wraps the payload as { json, meta } — plain JSON would have the
    // user's fields sitting directly on `data`.
    expect(response.body.result.data).toHaveProperty("json");
  });

  it("accepts a superjson-encoded input", async () => {
    const { app, container } = setup();
    const { cookie } = await signedInUser(container);

    const created = await request(app)
      .post("/trpc/rooms.create")
      .set("Cookie", cookie)
      .send(superjson.serialize({ name: "Encoded input" }))
      .expect(200);

    const room = superjson.deserialize<{ name: string; createdAt: unknown }>(
      created.body.result.data,
    );

    expect(room.name).toBe("Encoded input");
    expect(room.createdAt).toBeInstanceOf(Date);
  });
});
