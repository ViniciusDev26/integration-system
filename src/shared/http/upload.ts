import type { RequestHandler } from "express";
import multer from "multer";
import {
  DEFAULT_AUDIO_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
} from "./upload.constants.js";

/** A file rejected by our own boundary checks (as opposed to multer's limits). */
class UploadValidationError extends Error {}

export interface AudioUploadOptions {
  /** Multipart field name that carries the file. Defaults to `"file"`. */
  field?: string;
  /** Max accepted file size in bytes. Defaults to {@link DEFAULT_MAX_UPLOAD_BYTES}. */
  maxBytes?: number;
  /** Accepted MIME types. Defaults to {@link DEFAULT_AUDIO_MIME_TYPES}. */
  allowedMimeTypes?: readonly string[];
}

/**
 * Multipart upload middleware for a single audio file (ADR 0032). Buffers the
 * file in memory (so the handler can stream it to object storage) and enforces
 * the file at the HTTP boundary: exactly one file, an allowed audio MIME type,
 * and the size limit. Failures are mapped to `400`/`413` JSON here so handlers
 * stay thin and only ever see a valid file (read via {@link getUploadedFile}).
 */
export function createAudioUpload(
  options: AudioUploadOptions = {},
): RequestHandler {
  const field = options.field ?? "file";
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const allowed = new Set(options.allowedMimeTypes ?? DEFAULT_AUDIO_MIME_TYPES);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (!allowed.has(file.mimetype)) {
        cb(
          new UploadValidationError(`unsupported audio type: ${file.mimetype}`),
        );
        return;
      }
      cb(null, true);
    },
  }).single(field);

  return (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof UploadValidationError) {
        res.status(400).json({ error: "invalid_upload", message: err.message });
        return;
      }
      if (err instanceof multer.MulterError) {
        // File-too-large is the one limit worth its own status; other multer
        // errors (too many files/parts, wrong field) are client mistakes → 400.
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        res
          .status(status)
          .json({ error: "invalid_upload", message: err.message });
        return;
      }
      if (err !== null && err !== undefined) {
        next(err);
        return;
      }
      if (req.file === undefined) {
        res.status(400).json({
          error: "invalid_upload",
          message: `missing file field "${field}"`,
        });
        return;
      }
      next();
    });
  };
}

/**
 * Reads the file established by {@link createAudioUpload}. Call only from handlers
 * mounted behind that middleware: a missing file there is a wiring bug (the
 * middleware would already have 400'd otherwise), so it throws rather than
 * returning `undefined`.
 */
export function getUploadedFile(req: {
  file?: Express.Multer.File;
}): Express.Multer.File {
  if (req.file === undefined) {
    throw new Error(
      "getUploadedFile: no file on req — is createAudioUpload mounted before this handler?",
    );
  }
  return req.file;
}
