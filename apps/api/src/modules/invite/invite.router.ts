import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { INVITE_RESOURCE_TYPES } from "../../shared/db/schema/invites.js";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import {
  InviteExpiredError,
  InviteForbiddenError,
  InviteNotFoundError,
  InviteResourceNotFoundError,
  InviteRevokedError,
} from "./service/invite.service.errors.js";
import type { InviteService } from "./service/invite.service.types.js";

/** Maps an {@link InviteService} domain error to a tRPC error, else rethrows. */
function rethrowAsTRPC(err: unknown): never {
  if (err instanceof InviteForbiddenError) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (
    err instanceof InviteNotFoundError ||
    err instanceof InviteResourceNotFoundError
  ) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  // A link that was valid and no longer is — distinguishable from "never
  // existed", so the client can say why it stopped working.
  if (err instanceof InviteExpiredError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "invite_expired" });
  }
  if (err instanceof InviteRevokedError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "invite_revoked" });
  }
  throw err;
}

const resourceRefSchema = z.object({
  resourceType: z.enum(INVITE_RESOURCE_TYPES),
  resourceId: z.string().min(1),
});

/**
 * Invite tRPC procedures (ADR 0037, ADR 0040). Resource-agnostic: the input
 * names a `resourceType`, and the service routes it to that type's membership
 * adapter. Rooms become another enum member, not another router.
 */
export function createInviteRouter(inviteService: InviteService) {
  return router({
    create: protectedProcedure
      .input(resourceRefSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const invite = await inviteService.createForResource({
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            inviterId: ctx.user.id,
          });
          // Only the token and its lifetime: the row's internals are not the
          // client's business.
          return { token: invite.token, expiresAt: invite.expiresAt };
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    redeem: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await inviteService.redeem({
            token: input.token,
            userId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    list: protectedProcedure
      .input(resourceRefSchema)
      .query(async ({ ctx, input }) => {
        try {
          const invites = await inviteService.listForResource({
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            requesterId: ctx.user.id,
          });
          return invites.map((invite) => ({
            id: invite.id,
            token: invite.token,
            expiresAt: invite.expiresAt,
            revokedAt: invite.revokedAt,
            createdAt: invite.createdAt,
          }));
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    revoke: protectedProcedure
      .input(z.object({ inviteId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          await inviteService.revoke({
            inviteId: input.inviteId,
            requesterId: ctx.user.id,
          });
          return { ok: true };
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),
  });
}
