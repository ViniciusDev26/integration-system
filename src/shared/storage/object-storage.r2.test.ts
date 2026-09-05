import type { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from "./object-storage.constants.js";
import { createR2ObjectStorage } from "./object-storage.r2.js";

/** Records the commands passed to `send`, standing in for a real S3Client. */
function fakeClient(): { client: S3Client; sent: unknown[] } {
  const sent: unknown[] = [];
  const client = {
    async send(command: unknown) {
      sent.push(command);
      return {};
    },
  } as unknown as S3Client;
  return { client, sent };
}

/** Records the presign call and returns a canned URL. */
function fakePresign(): {
  presign: typeof getSignedUrl;
  calls: Array<{ command: unknown; expiresIn: number | undefined }>;
} {
  const calls: Array<{ command: unknown; expiresIn: number | undefined }> = [];
  const presign = (async (_client, command, options) => {
    calls.push({ command, expiresIn: options?.expiresIn });
    return "https://signed.test/url";
  }) as typeof getSignedUrl;
  return { presign, calls };
}

const baseOptions = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "music-bucket",
};

describe("R2 ObjectStorage — put", () => {
  it("sends a PutObjectCommand with the bucket, key, body, and content type", async () => {
    const { client, sent } = fakeClient();
    const storage = createR2ObjectStorage({ ...baseOptions, client });

    await storage.put({
      key: "musics/1.mp3",
      body: Buffer.from("audio-bytes"),
      contentType: "audio/mpeg",
    });

    expect(sent).toHaveLength(1);
    const command = sent[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: "music-bucket",
      Key: "musics/1.mp3",
      ContentType: "audio/mpeg",
    });
  });
});

describe("R2 ObjectStorage — getSignedUrl", () => {
  it("presigns a GetObjectCommand and returns its URL", async () => {
    const { client } = fakeClient();
    const { presign, calls } = fakePresign();
    const storage = createR2ObjectStorage({ ...baseOptions, client, presign });

    const url = await storage.getSignedUrl("musics/1.mp3");

    expect(url).toBe("https://signed.test/url");
    expect(calls).toHaveLength(1);
    const command = calls[0]?.command;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toMatchObject({
      Bucket: "music-bucket",
      Key: "musics/1.mp3",
    });
  });

  it("defaults the expiry and honors an explicit override", async () => {
    const { client } = fakeClient();
    const { presign, calls } = fakePresign();
    const storage = createR2ObjectStorage({ ...baseOptions, client, presign });

    await storage.getSignedUrl("musics/1.mp3");
    await storage.getSignedUrl("musics/1.mp3", { expiresInSeconds: 120 });

    expect(calls[0]?.expiresIn).toBe(DEFAULT_SIGNED_URL_TTL_SECONDS);
    expect(calls[1]?.expiresIn).toBe(120);
  });
});
