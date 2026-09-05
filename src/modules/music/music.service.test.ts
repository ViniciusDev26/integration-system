import { describe, expect, it } from "vitest";
import { createInMemoryObjectStorage } from "../../shared/storage/object-storage.in-memory.js";
import { createInMemoryMusicRepository } from "./music.repository.in-memory.js";
import { MUSIC_OBJECT_KEY_PREFIX } from "./music.service.constants.js";
import { createMusicService } from "./music.service.js";

function setup(generateObjectKey?: (file: { originalname: string }) => string) {
  const musicRepository = createInMemoryMusicRepository();
  const objectStorage = createInMemoryObjectStorage();
  const service = createMusicService({
    musicRepository,
    objectStorage,
    generateObjectKey,
  });
  return { service, musicRepository, objectStorage };
}

const file = {
  buffer: Buffer.from("audio-bytes"),
  mimetype: "audio/mpeg",
  originalname: "nocturne.mp3",
};

describe("MusicService.register", () => {
  it("stores the audio and persists a row referencing its key", async () => {
    const { service, musicRepository, objectStorage } = setup(
      () => "musics/fixed.mp3",
    );

    const music = await service.register({
      name: "Nocturne",
      genre: "classical",
      file,
      uploadedBy: "user-1",
    });

    expect(music.name).toBe("Nocturne");
    expect(music.genre).toBe("classical");
    expect(music.uploadedBy).toBe("user-1");
    expect(music.objectKey).toBe("musics/fixed.mp3");

    const stored = objectStorage.get("musics/fixed.mp3");
    expect(stored?.body.toString()).toBe("audio-bytes");
    expect(stored?.contentType).toBe("audio/mpeg");

    const persisted = await musicRepository.findById(music.id);
    expect(persisted?.objectKey).toBe("musics/fixed.mp3");
  });

  it("defaults the object key to the prefix + a uuid + the file extension", async () => {
    const { service } = setup();

    const music = await service.register({
      name: "Nocturne",
      genre: "classical",
      file,
      uploadedBy: "user-1",
    });

    expect(music.objectKey.startsWith(MUSIC_OBJECT_KEY_PREFIX)).toBe(true);
    expect(music.objectKey.endsWith(".mp3")).toBe(true);
  });
});
