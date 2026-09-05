import { randomBytes } from "node:crypto";
import type { Session } from "../../shared/db/schema/sessions.js";
import type { SessionRepository } from "./session.repository.js";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_BYTES = 32; // 256 bits of entropy

export interface SessionServiceOptions {
  sessionRepository: SessionRepository;
  /** Session lifetime in ms. Defaults to 30 days. */
  ttlMs?: number;
  /** Clock, injectable for tests. Defaults to `() => new Date()`. */
  now?: () => Date;
  /** Token generator, injectable for tests. Defaults to a random 256-bit token. */
  generateToken?: () => string;
}

/**
 * Session business logic used by the auth flow (ADR 0016/0019/0020): mint a
 * session on login, validate the cookie's session id on each request, and revoke
 * on logout. Depends on the {@link SessionRepository} port (ADR 0027).
 */
export interface SessionService {
  createForUser(userId: string): Promise<Session>;
  validate(sessionId: string): Promise<Session | null>;
  revoke(sessionId: string): Promise<void>;
}

export function createSessionService(
  options: SessionServiceOptions,
): SessionService {
  const { sessionRepository } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? (() => new Date());
  const generateToken =
    options.generateToken ??
    (() => randomBytes(TOKEN_BYTES).toString("base64url"));

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
