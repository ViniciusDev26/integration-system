import { describe, expect, it } from "vitest";
import { createInMemorySessionRepository } from "../repository/session.repository.in-memory.js";
import { createSessionService } from "./session.service.js";

const userId = "01920000-0000-7000-8000-000000000001";
const fixedNow = new Date("2026-01-01T00:00:00.000Z");

describe("SessionService", () => {
  it("creates a session for a user, persisted, with token + future expiry", async () => {
    const repository = createInMemorySessionRepository();
    const service = createSessionService({
      sessionRepository: repository,
      now: () => fixedNow,
      ttlMs: 1000,
    });

    const session = await service.createForUser(userId);

    expect(session.userId).toBe(userId);
    expect(session.id).toBeTruthy();
    expect(session.expiresAt.getTime()).toBe(fixedNow.getTime() + 1000);
    expect(await repository.findById(session.id)).not.toBeNull();
  });

  it("uses the injected token generator", async () => {
    const service = createSessionService({
      sessionRepository: createInMemorySessionRepository(),
      generateToken: () => "fixed-token",
    });

    const session = await service.createForUser(userId);

    expect(session.id).toBe("fixed-token");
  });

  it("generates unique, high-entropy tokens by default", async () => {
    const service = createSessionService({
      sessionRepository: createInMemorySessionRepository(),
    });

    const a = await service.createForUser(userId);
    const b = await service.createForUser(userId);

    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThanOrEqual(32);
  });

  it("validate returns the session when it is not expired", async () => {
    const service = createSessionService({
      sessionRepository: createInMemorySessionRepository(),
      now: () => fixedNow,
      ttlMs: 60_000,
    });
    const created = await service.createForUser(userId);

    const found = await service.validate(created.id);

    expect(found?.id).toBe(created.id);
  });

  it("validate returns null and deletes the session when expired", async () => {
    const repository = createInMemorySessionRepository();
    let current = fixedNow;
    const service = createSessionService({
      sessionRepository: repository,
      now: () => current,
      ttlMs: 1000,
    });
    const created = await service.createForUser(userId);

    current = new Date(fixedNow.getTime() + 5000);
    const found = await service.validate(created.id);

    expect(found).toBeNull();
    expect(await repository.findById(created.id)).toBeNull();
  });

  it("validate returns null for an unknown id", async () => {
    const service = createSessionService({
      sessionRepository: createInMemorySessionRepository(),
    });

    expect(await service.validate("does-not-exist")).toBeNull();
  });

  it("revoke deletes the session", async () => {
    const repository = createInMemorySessionRepository();
    const service = createSessionService({ sessionRepository: repository });
    const created = await service.createForUser(userId);

    await service.revoke(created.id);

    expect(await repository.findById(created.id)).toBeNull();
  });
});
