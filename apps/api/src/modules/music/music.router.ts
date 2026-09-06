import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/trpc.js";
import type { MusicService } from "./service/music.service.types.js";

const fileMetaSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

/**
 * Music tRPC procedures (ADR 0037/0038). Upload is presigned direct-to-R2:
 * `prepareUpload` hands back PUT URL(s), the browser uploads, then `create`
 * persists the row from the returned keys.
 */
export function createMusicRouter(musicService: MusicService) {
  return router({
    list: protectedProcedure.query(() => musicService.listAll()),

    prepareUpload: protectedProcedure
      .input(
        z.object({
          audio: fileMetaSchema,
          thumbnail: fileMetaSchema.optional(),
        }),
      )
      .mutation(({ input }) => musicService.prepareUpload(input)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          genres: z.array(z.string().min(1)).min(1),
          objectKey: z.string().min(1),
          thumbnailObjectKey: z.string().min(1).nullable().default(null),
        }),
      )
      .mutation(({ ctx, input }) =>
        musicService.createFromKeys({
          name: input.name,
          genres: input.genres,
          objectKey: input.objectKey,
          thumbnailObjectKey: input.thumbnailObjectKey,
          uploadedBy: ctx.user.id,
        }),
      ),
  });
}
