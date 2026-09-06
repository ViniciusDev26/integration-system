import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from "./object-storage.constants.js";
import type { ObjectStorage } from "./object-storage.js";

export interface R2ObjectStorageOptions {
  /** Cloudflare account id — used to derive the R2 S3 endpoint. */
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Bucket that holds the objects. */
  bucket: string;
  /** Default lifetime for signed URLs. Defaults to {@link DEFAULT_SIGNED_URL_TTL_SECONDS}. */
  defaultSignedUrlTtlSeconds?: number;
  /**
   * Injectable S3 client (ADR 0027/0028 DI style). Defaults to one configured
   * for R2. Overridden in unit tests with a fake `send`.
   */
  client?: S3Client;
  /**
   * Injectable presigner, defaulting to `@aws-sdk/s3-request-presigner`. Injected
   * in unit tests so the adapter's command-building is verified without the SDK's
   * real signing pipeline.
   */
  presign?: typeof getSignedUrl;
}

/** R2's S3-compatible endpoint for a given Cloudflare account (ADR 0007). */
function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Cloudflare R2 adapter for {@link ObjectStorage} (ADR 0007/0031). R2 is
 * S3-API-compatible, so this uses the AWS S3 v3 SDK pointed at R2's endpoint with
 * region `auto`. Uploads go through `PutObjectCommand`; playback URLs are
 * presigned `GetObjectCommand`s (short-lived, so objects stay private).
 */
export function createR2ObjectStorage(
  options: R2ObjectStorageOptions,
): ObjectStorage {
  const { accountId, accessKeyId, secretAccessKey, bucket } = options;
  const defaultTtl =
    options.defaultSignedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
  const presign = options.presign ?? getSignedUrl;
  const client =
    options.client ??
    new S3Client({
      region: "auto",
      endpoint: r2Endpoint(accountId),
      credentials: { accessKeyId, secretAccessKey },
    });

  return {
    async put(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },

    async getSignedUrl(key, urlOptions) {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return presign(client, command, {
        expiresIn: urlOptions?.expiresInSeconds ?? defaultTtl,
      });
    },
  };
}
