/**
 * Maximum size of an uploaded audio file. Music files are held fully in memory
 * (multer memory storage) before streaming to object storage, so this doubles as
 * a rough per-request memory bound (ADR 0032).
 */
export const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MiB

/**
 * Audio MIME types accepted for music uploads (ADR 0032). Kept deliberately
 * small — the common lossy/lossless formats a browser `<audio>` element plays.
 */
export const DEFAULT_AUDIO_MIME_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a / AAC in MP4
  "audio/aac",
  "audio/ogg", // .ogg / Opus/Vorbis
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/webm",
] as const;
