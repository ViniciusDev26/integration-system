import { describe, expect, it } from "vitest";
import { createInMemoryObjectStorage } from "../../shared/storage/object-storage.in-memory.js";
import { createInMemoryMusicRepository } from "./music.repository.in-memory.js";
import { MUSIC_OBJECT_KEY_PREFIX } from "./music.service.constants.js";
import { createMusicService } from "./music.service.js";
import type { MusicServiceOptions } from "./music.service.types.js";

function setup(overrides: Partial<MusicServiceOptions> = {}) {
  const musicRepository = createInMemoryMusicRepository();
  const objectStorage = createInMemoryObjectStorage();
  const service = createMusicService({
    musicRepository,
    objectStorage,
    ...overrides,
  });
  return { service, musicRepository, objectStorage };
}

const file = {
  buffer: Buffer.from("audio-bytes"),
  mimetype: "audio/mpeg",
  originalname: "nocturne.mp3",
};

const thumbnail = {
  buffer: Buffer.from("png-bytes"),
  mimetype: "image/png",
  originalname: "cover.png",
};

describe("MusicService.register", () => {
  it("stores the audio and persists a row referencing its key", async () => {
    const { service, musicRepository, objectStorage } = setup({
      generateObjectKey: () => "musics/fixed.mp3",
    });

    const music = await service.register({
      name: "Nocturne",
      genres: ["classical"],
      file,
      uploadedBy: "user-1",
    });

    expect(music.name).toBe("Nocturne");
    expect(music.objectKey).toBe("musics/fixed.mp3");
    expect(music.thumbnailObjectKey).toBeNull();

    const stored = objectStorage.get("musics/fixed.mp3");
    expect(stored?.body.toString()).toBe("audio-bytes");
    expect(stored?.contentType).toBe("audio/mpeg");

    const persisted = await musicRepository.findById(music.id);
    expect(persisted?.objectKey).toBe("musics/fixed.mp3");
  });

  it("stores an optional thumbnail and records its key", async () => {
    const { service, objectStorage } = setup({
      generateObjectKey: () => "musics/fixed.mp3",
      generateThumbnailKey: () => "musics/thumbnails/fixed.png",
    });

    const music = await service.register({
      name: "Nocturne",
      genres: ["classical"],
      file,
      thumbnail,
      uploadedBy: "user-1",
    });

    expect(music.thumbnailObjectKey).toBe("musics/thumbnails/fixed.png");

    const storedThumb = objectStorage.get("musics/thumbnails/fixed.png");
    expect(storedThumb?.body.toString()).toBe("png-bytes");
    expect(storedThumb?.contentType).toBe("image/png");
  });

  it("defaults the object key to the prefix + a uuid + the file extension", async () => {
    const { service } = setup();

    const music = await service.register({
      name: "Nocturne",
      genres: ["classical"],
      file,
      uploadedBy: "user-1",
    });

    expect(music.objectKey.startsWith(MUSIC_OBJECT_KEY_PREFIX)).toBe(true);
    expect(music.objectKey.endsWith(".mp3")).toBe(true);
  });
});

describe("MusicService.listAll", () => {
  it("returns every track (newest first) with a presigned playback URL", async () => {
    let n = 0;
    const { service } = setup({
      generateObjectKey: () => {
        n += 1;
        return `musics/key-${n}.mp3`;
      },
    });

    await service.register({
      name: "First",
      genres: ["rock"],
      file,
      uploadedBy: "user-1",
    });
    await service.register({
      name: "Second",
      genres: ["jazz"],
      file,
      uploadedBy: "user-2",
    });

    const all = await service.listAll();

    expect(all.map((m) => m.name)).toEqual(["Second", "First"]);
    expect(all[0]?.playbackUrl).toContain("musics/key-2.mp3");
    expect(all[1]?.playbackUrl).toContain("musics/key-1.mp3");
    expect(all[0]).not.toHaveProperty("objectKey");
  });

  it("includes a thumbnail URL only when the track has one", async () => {
    const { service } = setup({
      generateObjectKey: () => "musics/a.mp3",
      generateThumbnailKey: () => "musics/thumbnails/a.png",
    });

    await service.register({
      name: "WithThumb",
      genres: ["pop"],
      file,
      thumbnail,
      uploadedBy: "user-1",
    });
    await service.register({
      name: "NoThumb",
      genres: ["pop"],
      file,
      uploadedBy: "user-1",
    });

    const [noThumb, withThumb] = await service.listAll();
    expect(noThumb?.thumbnailUrl).toBeNull();
    expect(withThumb?.thumbnailUrl).toContain("musics/thumbnails/a.png");
  });

  it("returns an empty array when there are no tracks", async () => {
    const { service } = setup();
    expect(await service.listAll()).toEqual([]);
  });
});

describe("MusicService.prepareUpload", () => {
  it("returns presigned PUT targets for audio (+ optional thumbnail)", async () => {
    const { service } = setup({
      generateObjectKey: () => "musics/x.mp3",
      generateThumbnailKey: () => "musics/thumbnails/x.png",
    });

    const result = await service.prepareUpload({
      audio: { filename: "song.mp3", contentType: "audio/mpeg" },
      thumbnail: { filename: "cover.png", contentType: "image/png" },
    });

    expect(result.audio.objectKey).toBe("musics/x.mp3");
    expect(result.audio.uploadUrl).toContain("musics/x.mp3");
    expect(result.audio.uploadUrl).toContain("contentType=audio%2Fmpeg");
    expect(result.thumbnail?.objectKey).toBe("musics/thumbnails/x.png");
  });

  it("omits the thumbnail target when none is requested", async () => {
    const { service } = setup({ generateObjectKey: () => "musics/x.mp3" });
    const result = await service.prepareUpload({
      audio: { filename: "song.mp3", contentType: "audio/mpeg" },
    });
    expect(result.thumbnail).toBeUndefined();
  });
});

describe("MusicService.createFromKeys", () => {
  it("persists a row from already-uploaded keys (no storage write)", async () => {
    const { service, musicRepository, objectStorage } = setup();

    const music = await service.createFromKeys({
      name: "Nocturne",
      genres: ["classical"],
      objectKey: "musics/uploaded.mp3",
      thumbnailObjectKey: "musics/thumbnails/uploaded.png",
      uploadedBy: "user-1",
    });

    expect(music.objectKey).toBe("musics/uploaded.mp3");
    expect(music.thumbnailObjectKey).toBe("musics/thumbnails/uploaded.png");
    expect(await musicRepository.findById(music.id)).not.toBeNull();
    // createFromKeys does not upload bytes (the client already did).
    expect(objectStorage.get("musics/uploaded.mp3")).toBeUndefined();
  });
});
