import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { MUSIC_OBJECT_KEY_PREFIX } from "./music.service.constants.js";
import type {
  MusicService,
  MusicServiceOptions,
  UploadedAudio,
} from "./music.service.types.js";

/** `musics/<uuid><ext>` — random key, extension carried over from the upload. */
function defaultObjectKey(file: UploadedAudio): string {
  const ext = extname(file.originalname).toLowerCase();
  return `${MUSIC_OBJECT_KEY_PREFIX}${randomUUID()}${ext}`;
}

export function createMusicService(options: MusicServiceOptions): MusicService {
  const { musicRepository, objectStorage } = options;
  const generateObjectKey = options.generateObjectKey ?? defaultObjectKey;

  return {
    async register({ name, genre, file, uploadedBy }) {
      const objectKey = generateObjectKey(file);

      // Store the bytes first, then the row: if the row insert fails we leak an
      // orphan object (harmless, GC-able later), whereas a row pointing at a
      // never-stored object would be a broken record.
      await objectStorage.put({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });

      return musicRepository.create({ name, genre, objectKey, uploadedBy });
    },
  };
}
