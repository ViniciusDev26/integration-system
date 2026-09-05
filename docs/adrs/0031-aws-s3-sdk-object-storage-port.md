# 0031. Use the AWS S3 v3 SDK behind an ObjectStorage port for R2

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0007 chose Cloudflare R2 (S3-API compatible) to store audio files. We now
need the concrete client and an abstraction the rest of the app can depend on.
The app has two storage interactions: **upload** the audio bytes on music
creation, and hand out a **short-lived URL** to stream a track (so objects stay
private — no public bucket). Per ADR 0027 (ports/adapters, manual composition
root) and ADR 0022 (TDD), the app must talk to storage through a port that is
trivially faked in unit tests, with the real R2 wiring isolated to one adapter.

## Decision

Define an **`ObjectStorage` port** (`src/shared/storage/object-storage.ts`) with
two operations:

- `put({ key, body, contentType })` — store (or overwrite) an object.
- `getSignedUrl(key, { expiresInSeconds? })` — a time-limited read URL.

Implement it with the **AWS S3 v3 SDK** (`@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner`) pointed at R2's endpoint
(`https://<account-id>.r2.cloudflarestorage.com`, `region: "auto"`):

- `put` → `PutObjectCommand`; `getSignedUrl` → a presigned `GetObjectCommand`.
- The adapter takes an **injectable `S3Client` and `presign` function** (defaults
  build the real ones), mirroring the axios-instance DI of ADR 0028 — so unit
  tests assert the commands built (bucket/key/body/content-type, expiry) with
  simple fakes and no network.
- An **in-memory fake** (`createInMemoryObjectStorage`) implements the port for
  service unit tests.

Config is vendor-neutral (`STORAGE_ACCOUNT_ID`, `STORAGE_ACCESS_KEY_ID`,
`STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`) so the port name and env don't leak
"R2". Validated in `src/shared/env.ts` (ADR 0011).

## Consequences

- Services depend only on `ObjectStorage`; swapping R2 for S3/MinIO is an adapter
  + endpoint change, nothing else.
- Presigned GETs mean the app never proxies media bytes; the browser/`<audio>`
  streams straight from R2. URLs expire (default 1h), keeping the bucket private.
- The AWS SDK v3 is a sizeable dependency tree — accepted as the standard,
  best-supported S3 client; R2's compatibility is exercised through it.
- The adapter's unit tests verify command construction, not R2 itself; a real
  round-trip needs live credentials (a manual/integration smoke test remains an
  option, akin to the OAuth E2E caveat in ADR 0028).

## Alternatives considered

- **Cloudflare R2 SDK / raw REST + manual signing:** less portable and more code
  than the S3 SDK, which R2 explicitly supports.
- **`minio` client:** capable and lighter, but a second S3 dialect; the AWS SDK
  is the reference and matches "S3-compatible" most directly.
- **No port (call the SDK from services):** rejected — couples business logic to
  the SDK and makes ADR 0022 unit tests require network/mocks.
- **Public bucket + plain URLs (no presigning):** simplest, but exposes every
  track to anyone with the URL forever; presigned URLs keep objects private.
