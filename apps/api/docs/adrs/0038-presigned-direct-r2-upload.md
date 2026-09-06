# 0038. Presigned direct-to-R2 uploads (no server multipart)

- Status: Accepted
- Date: 2026-09-06
- Supersedes: [0032](./0032-multer-multipart-upload-middleware.md)

## Context

The API is now tRPC (ADR 0037), which is JSON-RPC and cannot carry multipart file
uploads. Music has an audio file (+ optional cover image) to store in R2. We need
an upload path that fits a JSON API and avoids streaming large binaries through
the Node process.

## Decision

Upload **directly from the browser to R2** using **presigned PUT URLs**; the API
never receives the bytes.

- The `ObjectStorage` port gains **`getUploadUrl(key, contentType, opts?)`** — a
  short-lived presigned **PUT** URL (R2 adapter via the S3 SDK's
  `PutObjectCommand` + `getSignedUrl`; in-memory fake for tests). Complements the
  existing `getSignedUrl` (GET, ADR 0031).
- Flow: a tRPC mutation **`musics.prepareUpload`** allocates the object key(s)
  (`musics/<uuid><ext>`, thumbnails under `musics/thumbnails/…`) and returns the
  presigned PUT URL(s). The browser `PUT`s the file(s) straight to R2. A second
  mutation **`musics.create`** persists the metadata row from the returned key(s).
- **Remove multer** and the multipart upload middleware (`src/shared/http/upload.ts`).
  **Supersedes ADR 0032.**
- The server-side seed script keeps `MusicService.register` (it has the files
  locally and uploads via `ObjectStorage.put`) — direct-upload is a browser path,
  not the only one.

## Consequences

- Large audio never passes through the API; upload load goes straight to R2.
- Two-step create (prepare → PUT → create). A row is only written after the bytes
  exist; a client that PUTs but never calls `create` leaks an orphan object
  (harmless, GC-able) — same trade-off direction as before.
- MIME/size limits move to the presign step (constrain `contentType`) and/or R2
  bucket policy, instead of multer's per-field checks. Validate the declared
  content type when issuing the URL.
- CORS on the **R2 bucket** must allow the browser `PUT` (bucket config, not app
  code).

## Alternatives considered

- **multer multipart through the API (ADR 0032):** doesn't fit tRPC and streams
  binaries through Node; superseded.
- **Base64 the file inside a tRPC input:** keeps one call but bloats payloads ~33%
  and buffers big files in memory/JSON — bad for audio.
- **A single REST multipart endpoint alongside tRPC:** viable, but keeps multer
  and a second transport; presigned direct upload is cleaner and offloads bytes.
