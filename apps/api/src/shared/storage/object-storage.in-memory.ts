import type { ObjectStorage, PutObjectInput } from "./object-storage.js";

/** A stored object as retained by the in-memory fake. */
export interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * In-memory fake of {@link ObjectStorage} for unit tests (ADR 0027). Keeps the
 * bytes in a Map and mints a deterministic fake URL for `getSignedUrl` so
 * services can be tested without R2. Not shipped in the build.
 */
export interface InMemoryObjectStorage extends ObjectStorage {
  /** Test helper: read back a stored object, or `undefined` if absent. */
  get(key: string): StoredObject | undefined;
}

export function createInMemoryObjectStorage(): InMemoryObjectStorage {
  const objects = new Map<string, StoredObject>();

  return {
    async put(input: PutObjectInput) {
      objects.set(input.key, {
        body: Buffer.from(input.body),
        contentType: input.contentType,
      });
    },

    async getSignedUrl(key, options) {
      const url = new URL(`https://storage.test/${key}`);
      if (options?.expiresInSeconds !== undefined) {
        url.searchParams.set("expires", String(options.expiresInSeconds));
      }
      return url.toString();
    },

    async getUploadUrl(key, contentType) {
      const url = new URL(`https://upload.storage.test/${key}`);
      url.searchParams.set("contentType", contentType);
      return url.toString();
    },

    get(key) {
      return objects.get(key);
    },
  };
}
