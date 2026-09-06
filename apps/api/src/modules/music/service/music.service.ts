import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import {
  MUSIC_OBJECT_KEY_PREFIX,
  MUSIC_THUMBNAIL_KEY_PREFIX,
} from "./music.service.constants.js";
import type {
  MusicService,
  MusicServiceOptions,
} from "./music.service.types.js";

/** `<prefix><uuid><ext>` — random key, extension carried over from the filename. */
function keyFor(prefix: string, filename: string): string {
  const ext = extname(filename).toLowerCase();
  return `${prefix}${randomUUID()}${ext}`;
}

export function createMusicService(options: MusicServiceOptions): MusicService {
  const { musicRepository, objectStorage } = options;
  const generateObjectKey =
    options.generateObjectKey ??
    ((filename) => keyFor(MUSIC_OBJECT_KEY_PREFIX, filename));
  const generateThumbnailKey =
    options.generateThumbnailKey ??
    ((filename) => keyFor(MUSIC_THUMBNAIL_KEY_PREFIX, filename));

  return {
    async register({ name, genres, file, thumbnail, uploadedBy }) {
      const objectKey = generateObjectKey(file.originalname);

      // Store the bytes first, then the row (server-side path, e.g. the seed).
      await objectStorage.put({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });

      let thumbnailObjectKey: string | null = null;
      if (thumbnail !== undefined) {
        thumbnailObjectKey = generateThumbnailKey(thumbnail.originalname);
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

    async prepareUpload({ audio, thumbnail }) {
      const audioKey = generateObjectKey(audio.filename);
      const audioUrl = await objectStorage.getUploadUrl(
        audioKey,
        audio.contentType,
      );

      if (thumbnail === undefined) {
        return { audio: { objectKey: audioKey, uploadUrl: audioUrl } };
      }

      const thumbnailKey = generateThumbnailKey(thumbnail.filename);
      const thumbnailUrl = await objectStorage.getUploadUrl(
        thumbnailKey,
        thumbnail.contentType,
      );

      return {
        audio: { objectKey: audioKey, uploadUrl: audioUrl },
        thumbnail: { objectKey: thumbnailKey, uploadUrl: thumbnailUrl },
      };
    },

    async createFromKeys(input) {
      return musicRepository.create(input);
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
