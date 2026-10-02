import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import type { PlaylistEvent } from "./playlist.events.js";
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

    members: protectedProcedure
      .input(z.object({ playlistId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        try {
          return await playlistService.listMembers({
            playlistId: input.playlistId,
            requesterId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    /**
     * Live changes to a playlist, for its members (ADR 0039). The events are
     * signals rather than state: a client reacts by refetching, which is what
     * makes a missed event harmless and replay unnecessary here.
     *
     * Membership is checked before anything is yielded — but note a generator
     * resolver only runs once the stream is first pulled, so an outsider's
     * `FORBIDDEN` reaches them as a subscription error, not a failed call.
     */
    onChanged: protectedProcedure
      .input(z.object({ playlistId: z.string().min(1) }))
      .subscription(async function* ({ ctx, input, signal }) {
        let stream: AsyncIterable<PlaylistEvent>;
        try {
          // Checked up front so an outsider is rejected rather than handed a
          // subscription that silently never yields.
          stream = await playlistService.watch({
            playlistId: input.playlistId,
            requesterId: ctx.user.id,
            signal,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }

        for await (const event of stream) {
          yield event;
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
