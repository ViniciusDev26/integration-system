import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  MUSIC_OBJECT_KEY_PREFIX,
  MUSIC_THUMBNAIL_KEY_PREFIX,
} from "./music.service.constants.js";
import type {
  MusicService,
  MusicServiceOptions,
  UploadedFile,
} from "./music.service.types.js";

/** `<prefix><uuid><ext>` — random key, extension carried over from the upload. */
function keyFor(prefix: string, file: UploadedFile): string {
  const ext = extname(file.originalname).toLowerCase();
  return `${prefix}${randomUUID()}${ext}`;
}

export function createMusicService(options: MusicServiceOptions): MusicService {
  const { musicRepository, objectStorage } = options;
  const generateObjectKey =
    options.generateObjectKey ??
    ((file) => keyFor(MUSIC_OBJECT_KEY_PREFIX, file));
  const generateThumbnailKey =
    options.generateThumbnailKey ??
    ((file) => keyFor(MUSIC_THUMBNAIL_KEY_PREFIX, file));

  return {
    async register({ name, genres, file, thumbnail, uploadedBy }) {
      const objectKey = generateObjectKey(file);

      // Store the bytes first, then the row: if the row insert fails we leak an
      // orphan object (harmless, GC-able later), whereas a row pointing at a
      // never-stored object would be a broken record.
      await objectStorage.put({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });

      let thumbnailObjectKey: string | null = null;
      if (thumbnail !== undefined) {
        thumbnailObjectKey = generateThumbnailKey(thumbnail);
        await objectStorage.put({
          key: thumbnailObjectKey,
          body: thumbnail.buffer,
          contentType: thumbnail.mimetype,
        });
      }

      return musicRepository.create({
        name,
        genres,
        objectKey,
        thumbnailObjectKey,
        uploadedBy,
      });
    },

    async listAll() {
      const tracks = await musicRepository.list();
      return Promise.all(
        tracks.map(async (track) => ({
          id: track.id,
          name: track.name,
          genres: track.genres,
          playbackUrl: await objectStorage.getSignedUrl(track.objectKey),
          thumbnailUrl:
            track.thumbnailObjectKey === null
              ? null
              : await objectStorage.getSignedUrl(track.thumbnailObjectKey),
        })),
      );
    },
  };
}
