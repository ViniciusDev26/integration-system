import { TRPCError, tracked } from "@trpc/server";
import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "../../shared/db/schema/room-messages.js";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import {
  RoomForbiddenError,
  RoomMusicNotFoundError,
  RoomNotFoundError,
} from "./application/room.service.errors.js";
import type { RoomService } from "./application/room.service.types.js";
import type { RoomMessageSummary } from "./repository/room-message.repository.js";
import type { RoomEvent } from "./room.events.js";

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

    sendMessage: protectedProcedure
      .input(
        roomIdSchema.extend({
          body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await roomService.sendMessage({
            roomId: input.roomId,
            requesterId: ctx.user.id,
            body: input.body,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    messages: protectedProcedure
      .input(roomIdSchema)
      .query(async ({ ctx, input }) => {
        try {
          return await roomService.listMessages({
            roomId: input.roomId,
            requesterId: ctx.user.id,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    /**
     * Live chat, with **durable replay** (ADR 0044) — the one subscription here
     * that needs it, because messages are the data rather than a signal.
     *
     * Each message is wrapped in `tracked(id, …)`, so the client records that id
     * and tRPC hands it back as `lastEventId` on reconnect; the service then
     * replays from PostgreSQL. The cursor is the message id itself, which is a
     * UUIDv7 and therefore already time-ordered.
     */
    onMessage: protectedProcedure
      .input(
        roomIdSchema.extend({
          // Supplied by tRPC on a reconnect, not by the client's own code.
          lastEventId: z.string().min(1).optional(),
        }),
      )
      .subscription(async function* ({ ctx, input, signal }) {
        let stream: AsyncIterable<RoomMessageSummary>;
        try {
          stream = await roomService.watchMessages({
            roomId: input.roomId,
            requesterId: ctx.user.id,
            lastEventId: input.lastEventId,
            signal,
          });
        } catch (err) {
          rethrowAsTRPC(err);
        }

        for await (const message of stream) {
          yield tracked(message.id, message);
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
