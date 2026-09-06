import { describe, expect, it } from "vitest";
import { createInMemoryObjectStorage } from "./object-storage.in-memory.js";

describe("in-memory ObjectStorage", () => {
  it("stores bytes + content type and reads them back", async () => {
    const storage = createInMemoryObjectStorage();

    await storage.put({
      key: "musics/1.mp3",
      body: Buffer.from("audio-bytes"),
      contentType: "audio/mpeg",
    });

    const stored = storage.get("musics/1.mp3");
    expect(stored?.body.toString()).toBe("audio-bytes");
    expect(stored?.contentType).toBe("audio/mpeg");
  });

  it("returns undefined for an unknown key", () => {
    const storage = createInMemoryObjectStorage();
    expect(storage.get("missing")).toBeUndefined();
  });

  it("mints a URL that embeds the key", async () => {
    const storage = createInMemoryObjectStorage();

    const url = await storage.getSignedUrl("musics/1.mp3", {
      expiresInSeconds: 30,
    });

    expect(url).toContain("musics/1.mp3");
    expect(url).toContain("expires=30");
  });
});
