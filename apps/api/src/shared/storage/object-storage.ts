/** An object to store: its key (path in the bucket), bytes, and MIME type. */
export interface PutObjectInput {
  /** Object key (path within the bucket), e.g. `musics/<uuid>.mp3`. */
  key: string;
  /** The raw bytes to store (e.g. an uploaded file held in memory). */
  body: Buffer | Uint8Array;
  /** MIME type recorded on the object, e.g. `audio/mpeg`. */
  contentType: string;
}

/** Options for issuing a time-limited download URL. */
export interface SignedUrlOptions {
  /** How long the URL stays valid, in seconds. Adapters supply a default. */
  expiresInSeconds?: number;
}

/**
 * Port for binary object storage (ADR 0007/0031). The app stores audio bytes and
 * later hands out a short-lived URL to stream them; it never proxies the media
 * itself. Adapters: `createR2ObjectStorage` (Cloudflare R2 via the S3 SDK) and an
 * in-memory fake for tests (ADR 0027).
 */
export interface ObjectStorage {
  /** Stores (or overwrites) the object at `input.key` (server-side upload). */
  put(input: PutObjectInput): Promise<void>;
  /**
   * Returns a time-limited URL that grants read access to the object at `key`,
   * without requiring the object to be public. Does not verify the object
   * exists — that is deferred to the eventual GET.
   */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  /**
   * Returns a time-limited presigned **PUT** URL so a client can upload the bytes
   * for `key` directly to storage (ADR 0038), constrained to `contentType`. The
   * app never sees the bytes.
   */
  getUploadUrl(
    key: string,
    contentType: string,
    options?: SignedUrlOptions,
  ): Promise<string>;
}
