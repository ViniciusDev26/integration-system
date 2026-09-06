# 0032. Use multer (memory storage) for multipart audio uploads

- Status: Superseded by [0038](./0038-presigned-direct-r2-upload.md)
- Date: 2026-09-05

## Context

Music creation is a file upload: the client posts `multipart/form-data` with the
audio file plus text fields (name, genre). Express does not parse multipart
bodies, and the audio bytes must reach the `ObjectStorage` port (ADR 0031) to be
streamed to R2. We want the file validated at the HTTP boundary (ADR 0011/0012)
— size and type — so handlers stay thin and only ever see a valid file, and the
text fields still flow through the existing `express-zod-safe` validation.

## Decision

Use **multer** (v2) as the multipart middleware, configured with **memory
storage**, wrapped in a small factory `createAudioUpload()`
(`src/shared/http/upload.ts`):

- **Memory storage** — the file arrives as a `Buffer` on `req.file.buffer`, which
  the handler hands straight to `ObjectStorage.put`. No temp files on disk; the
  size limit doubles as a per-request memory bound.
- **Boundary validation** — a single file (`.single(field)`), an allowlist of
  audio MIME types, and a byte-size limit (defaults in `upload.constants.ts`).
- **HTTP error mapping** — the wrapper translates multer/validation failures to
  JSON at the boundary: unsupported type or missing file → `400`, over the size
  limit → `413`. Handlers never see multer errors.
- **Typed read** — `getUploadedFile(req)` returns the validated file (throws if
  the middleware wasn't mounted), mirroring `getAuthenticatedUser` (ADR on
  requireAuth). Text fields are still validated by `express-zod-safe`.

## Consequences

- Handlers stay thin: they receive a guaranteed-valid file and validated text
  fields, and only orchestrate storage + persistence.
- Whole-file buffering caps practical upload size (memory). Fine for a sample
  music service; a future move to streaming/multipart-to-R2 or presigned direct
  uploads is possible without changing the port.
- multer v2 is the maintained line (v1 is deprecated with open advisories); we
  pin v2.
- MIME type is taken from the request part and is client-asserted; the allowlist
  reduces but does not eliminate spoofing. Content-sniffing/transcoding is a
  possible later hardening step, out of scope here.

## Alternatives considered

- **busboy directly:** what multer wraps; lower-level and more wiring for no gain
  at this size.
- **multer disk storage:** avoids buffering large files in memory, but adds temp
  files, cleanup, and a second read to stream to R2. Memory storage is simpler
  and sufficient given the size cap.
- **Presigned direct-to-R2 upload from the browser:** scales best (bytes skip the
  API) but needs client-side upload flow + a confirm step; heavier than warranted
  now. Left as a future option (the `ObjectStorage` port already presigns URLs).
