import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import type { RoomEvent } from "./room.events.js";
import {
  RoomForbiddenError,
  RoomMusicNotFoundError,
  RoomNotFoundError,
} from "./service/room.service.errors.js";
import type { RoomService } from "./service/room.service.types.js";

/** Maps a {@link RoomService} domain error to a tRPC error, else rethrows. */
function rethrowAsTRPC(err: unknown): never {
  if (err instanceof RoomForbiddenError) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (
    err instanceof RoomNotFoundError ||
    err instanceof RoomMusicNotFoundError
  ) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  throw err;
}

const roomIdSchema = z.object({ roomId: z.string().min(1) });

/** The four things that move the playback anchor (ADR 0041). */
const playbackCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLAY") }),
  z.object({ type: z.literal("PAUSE") }),
  z.object({ type: z.literal("SEEK"), positionMs: z.number().int().min(0) }),
  z.object({
    type: z.literal("SELECT_TRACK"),
    musicId: z.string().min(1),
  }),
]);

/**
 * Room tRPC procedures (ADR 0037, ADR 0041). Playback commands are ordinary
 * mutations — only the resulting anchor is pushed, over `onChanged`.
 */
export function createRoomRouter(roomService: RoomService) {
  return router({
    list: protectedProcedure.query(({ ctx }) =>
      roomService.listForUser(ctx.user.id),
    ),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(({ ctx, input }) =>
        roomService.createForUser({ name: input.name, ownerId: ctx.user.id }),
      ),

    get: protectedProcedure
      .input(roomIdSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await roomService.get({
            roomId: input.roomId,
            requesterId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    members: protectedProcedure
      .input(roomIdSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await roomService.listMembers({
            roomId: input.roomId,
            requesterId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    queueMusic: protectedProcedure
      .input(roomIdSchema.extend({ musicId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        try {
          await roomService.queueMusic({
            roomId: input.roomId,
            musicId: input.musicId,
            requesterId: ctx.user.id,
          });
          return { ok: true };
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    commandPlayback: protectedProcedure
      .input(roomIdSchema.extend({ command: playbackCommandSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await roomService.commandPlayback({
            roomId: input.roomId,
            requesterId: ctx.user.id,
            command: input.command,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    /**
     * Live room events. Opening this marks the subscriber **present**, and
     * closing it removes them — presence is the stream's lifetime (ADR 0041),
     * so a dropped socket needs no cleanup of its own.
     */
    onChanged: protectedProcedure
      .input(roomIdSchema)
      .subscription(async function* ({ ctx, input, signal }) {
        let stream: AsyncIterable<RoomEvent>;
        try {
          stream = await roomService.watch({
            roomId: input.roomId,
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
  });
}
