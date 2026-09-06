# 0007. Use Cloudflare R2 (S3-compatible) for audio file storage

- Status: Accepted
- Date: 2026-09-05

## Context

The API is a sample music service (Spotify-like). Music tracks have binary
audio files that must be stored and served (`GET /musics/:id` returns music info
plus a URL to listen). Binary media does not belong in the primary database;
it needs an object/file store. Metadata (playlists, music info) is stored
separately in the primary database (decision pending — see `memory.md`).

## Decision

Use **Cloudflare R2** as the object storage ("file database") for audio files.
R2 is **S3-API compatible**, so we will integrate using the standard S3 client
tooling/SDK.

## Consequences

- Audio binaries live in R2; the primary database stores only metadata plus a
  reference (object key) to the file in R2.
- Because R2 is S3-compatible, we can use the AWS S3 SDK and standard S3
  concepts (buckets, keys, presigned URLs). Presigned URLs are a natural way to
  implement the "URL to listen" for `GET /musics/:id`.
- Avoids S3 egress fees (an R2 selling point) while keeping portability: the
  S3-compatible surface means we are not deeply locked to one vendor.
- Requires R2 credentials/config (account, bucket, access keys, endpoint) to be
  managed as configuration/secrets — handling of secrets is a follow-up detail.

## Alternatives considered

- **AWS S3:** the reference implementation; R2 was chosen for cost (no egress
  fees) while remaining S3-API compatible.
- **Storing files in the primary database (BLOBs):** simple but bloats the DB,
  hurts performance, and is poor practice for large binary media.
- **Local/served filesystem:** not durable or scalable for a real deployment.
