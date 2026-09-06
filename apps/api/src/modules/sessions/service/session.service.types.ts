import type { Session } from "../../../shared/db/schema/sessions.js";
import type { SessionRepository } from "../repository/session.repository.js";

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
