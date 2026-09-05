import { randomBytes } from "node:crypto";
import {
  DEFAULT_SESSION_TTL_MS,
  SESSION_TOKEN_BYTES,
} from "./session.service.constants.js";
import type {
  SessionService,
  SessionServiceOptions,
} from "./session.service.types.js";

export function createSessionService(
  options: SessionServiceOptions,
): SessionService {
  const { sessionRepository } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => new Date());
  const generateToken =
    options.generateToken ??
    (() => randomBytes(SESSION_TOKEN_BYTES).toString("base64url"));

  return {
    async createForUser(userId) {
      const id = generateToken();
      const expiresAt = new Date(now().getTime() + ttlMs);
      return sessionRepository.create({ id, userId, expiresAt });
    },

    async validate(sessionId) {
      const session = await sessionRepository.findById(sessionId);
      if (session === null) {
        return null;
      }
      if (session.expiresAt.getTime() <= now().getTime()) {
        await sessionRepository.deleteById(session.id);
        return null;
      }
      return session;
    },

    async revoke(sessionId) {
      await sessionRepository.deleteById(sessionId);
    },
  };
}
