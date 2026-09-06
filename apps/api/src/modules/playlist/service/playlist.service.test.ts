import { describe, expect, it } from "vitest";
import { createInMemoryObjectStorage } from "../../../shared/storage/object-storage.in-memory.js";
import { createInMemoryMusicRepository } from "../../music/repository/music.repository.in-memory.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import { createInMemoryPlaylistRepository } from "../repository/playlist.repository.in-memory.js";
import {
  MusicNotFoundError,
  PlaylistForbiddenError,
  PlaylistNotFoundError,
} from "./playlist.service.errors.js";
import { createPlaylistService } from "./playlist.service.js";

function setup() {
  const musicRepository = createInMemoryMusicRepository();
  const playlistRepository = createInMemoryPlaylistRepository({
    resolveMusic: (id) => musicRepository.findById(id),
  });
  const objectStorage = createInMemoryObjectStorage();
  const service = createPlaylistService({
    playlistRepository,
    musicRepository,
    objectStorage,
  });
  return { service, playlistRepository, musicRepository };
}

async function seedMusic(
  musicRepository: MusicRepository,
  name: string,
): Promise<string> {
  const music = await musicRepository.create({
    name,
    genres: ["pop"],
    objectKey: `musics/${name}.mp3`,
    thumbnailObjectKey: null,
    uploadedBy: "u1",
  });
  return music.id;
}

describe("PlaylistService.createForUser", () => {
  it("creates a playlist and makes the creator its OWNER", async () => {
    const { service, playlistRepository } = setup();

    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    expect(playlist.name).toBe("Mix");
    expect(await playlistRepository.getMemberType(playlist.id, "u1")).toBe(
      "OWNER",
    );
  });
});

describe("PlaylistService.listForUser", () => {
  it("returns only the user's playlists", async () => {
    const { service } = setup();
    await service.createForUser({ name: "Mine", ownerId: "u1" });
    await service.createForUser({ name: "Theirs", ownerId: "u2" });

    const mine = await service.listForUser("u1");
    expect(mine.map((p) => p.name)).toEqual(["Mine"]);
  });
});

describe("PlaylistService.addMusic", () => {
  it("lets a member add a track, visible via getWithMusics", async () => {
    const { service, musicRepository } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "A");

    await service.addMusic({
      playlistId: playlist.id,
      musicId,
      requesterId: "u1",
    });

    const { musics } = await service.getWithMusics({
      playlistId: playlist.id,
      requesterId: "u1",
    });
    expect(musics.map((m) => m.name)).toEqual(["A"]);
    expect(musics[0]?.playbackUrl).toContain("musics/A.mp3");
  });

  it("rejects a non-member with PlaylistForbiddenError", async () => {
    const { service, musicRepository } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "A");

    await expect(
      service.addMusic({ playlistId: playlist.id, musicId, requesterId: "u2" }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });

  it("rejects an unknown playlist with PlaylistNotFoundError", async () => {
    const { service, musicRepository } = setup();
    const musicId = await seedMusic(musicRepository, "A");

    await expect(
      service.addMusic({ playlistId: "nope", musicId, requesterId: "u1" }),
    ).rejects.toBeInstanceOf(PlaylistNotFoundError);
  });

  it("rejects an unknown music with MusicNotFoundError", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    await expect(
      service.addMusic({
        playlistId: playlist.id,
        musicId: "nope",
        requesterId: "u1",
      }),
    ).rejects.toBeInstanceOf(MusicNotFoundError);
  });
});

describe("PlaylistService.getWithMusics", () => {
  it("rejects a non-member with PlaylistForbiddenError", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    await expect(
      service.getWithMusics({ playlistId: playlist.id, requesterId: "u2" }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });

  it("rejects an unknown playlist with PlaylistNotFoundError", async () => {
    const { service } = setup();

    await expect(
      service.getWithMusics({ playlistId: "nope", requesterId: "u1" }),
    ).rejects.toBeInstanceOf(PlaylistNotFoundError);
  });
});
