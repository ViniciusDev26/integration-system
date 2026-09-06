import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import {
  MusicNotFoundError,
  PlaylistForbiddenError,
  PlaylistNotFoundError,
} from "./service/playlist.service.errors.js";
import type { PlaylistService } from "./service/playlist.service.types.js";

/** Maps a {@link PlaylistService} domain error to a tRPC error, else rethrows. */
function rethrowAsTRPC(err: unknown): never {
  if (err instanceof PlaylistForbiddenError) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (
    err instanceof PlaylistNotFoundError ||
    err instanceof MusicNotFoundError
  ) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  throw err;
}

/**
 * Playlist tRPC procedures (ADR 0037). Membership is enforced by the service;
 * its typed errors become tRPC `FORBIDDEN`/`NOT_FOUND`.
 */
export function createPlaylistRouter(playlistService: PlaylistService) {
  return router({
    list: protectedProcedure.query(({ ctx }) =>
      playlistService.listForUser(ctx.user.id),
    ),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(({ ctx, input }) =>
        playlistService.createForUser({
          name: input.name,
          ownerId: ctx.user.id,
        }),
      ),

    get: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        try {
          return await playlistService.getWithMusics({
            playlistId: input.id,
            requesterId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    addMusic: protectedProcedure
      .input(
        z.object({
          playlistId: z.string().min(1),
          musicId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          await playlistService.addMusic({
            playlistId: input.playlistId,
            musicId: input.musicId,
            requesterId: ctx.user.id,
          });
          return { ok: true };
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),
  });
}
