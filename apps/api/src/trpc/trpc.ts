import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

/**
 * tRPC initialization (ADR 0037). One `initTRPC` per app; exports the building
 * blocks used by feature routers. `protectedProcedure` requires an authenticated
 * user (401 → `UNAUTHORIZED`) and narrows `ctx.user` to non-null downstream.
 */
const t = initTRPC.context<Context>().create();

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
