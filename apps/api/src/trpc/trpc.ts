import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.js";

/**
 * tRPC initialization (ADR 0037). One `initTRPC` per app; exports the building
 * blocks used by feature routers. `protectedProcedure` requires an authenticated
 * user (401 → `UNAUTHORIZED`) and narrows `ctx.user` to non-null downstream.
 *
 * The **superjson transformer** (ADR 0042) is what makes the inferred types
 * true: without it a `Date` crosses the wire as a string while the client's
 * types still claim `Date`, and `expiresAt.getTime()` compiles but throws.
 * Every client link must configure the same transformer.
 */
const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use((opts) => {
  const { ctx } = opts;
  if (ctx.user === null) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({ ctx: { user: ctx.user } });
});
