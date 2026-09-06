import type { RequestHandler } from "express";
import multer from "multer";
import { DEFAULT_MAX_UPLOAD_BYTES } from "./upload.constants.js";

/** A file rejected by our own boundary checks (as opposed to multer's limits). */
class UploadValidationError extends Error {}

/** One expected file field of a multipart upload (at most one file each). */
export interface UploadFieldSpec {
  /** Multipart field name. */
  name: string;
  /** Accepted MIME types for this field. */
  allowedMimeTypes: readonly string[];
  /** Whether the field must be present. Defaults to `false`. */
  required?: boolean;
  /** Max size for this field in bytes. Defaults to {@link DEFAULT_MAX_UPLOAD_BYTES}. */
  maxBytes?: number;
}

type MulterFiles =
  | Record<string, Express.Multer.File[]>
  | Express.Multer.File[]
  | undefined;

/** Reads multer's `.fields()` output (`{ field: File[] }`) as `{ field: File }`. */
function fileFor(
  files: MulterFiles,
  field: string,
): Express.Multer.File | undefined {
  if (files === undefined || Array.isArray(files)) {
    return undefined;
  }
  return files[field]?.[0];
}

/**
 * Multipart upload middleware for one or more named file fields (ADR 0032).
 * Buffers each file in memory (so handlers can stream them to object storage) and
 * enforces every file at the HTTP boundary: at most one file per field, an
 * allowed MIME type, presence for required fields, and a per-field size limit.
 * Failures are mapped to `400`/`413` JSON here so handlers stay thin and only
 * ever see valid files (read via {@link getUploadedFile}/{@link getOptionalFile}).
 */
export function createUpload(fields: UploadFieldSpec[]): RequestHandler {
  const specByName = new Map(fields.map((spec) => [spec.name, spec]));
  // multer's fileSize limit is global; use the largest field as a hard,
  // memory-safety cap that aborts mid-stream, then enforce each field's own
  // limit precisely below (files are fully buffered, so `size` is exact).
  const globalMax = Math.max(
    ...fields.map((spec) => spec.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES),
  );

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: globalMax },
    fileFilter(_req, file, cb) {
      const spec = specByName.get(file.fieldname);
      if (spec === undefined) {
        cb(new UploadValidationError(`unexpected field "${file.fieldname}"`));
        return;
      }
      if (!spec.allowedMimeTypes.includes(file.mimetype)) {
        cb(
          new UploadValidationError(
            `unsupported type for "${file.fieldname}": ${file.mimetype}`,
          ),
        );
        return;
      }
      cb(null, true);
    },
  }).fields(fields.map((spec) => ({ name: spec.name, maxCount: 1 })));

  return (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof UploadValidationError) {
        res.status(400).json({ error: "invalid_upload", message: err.message });
        return;
      }
      if (err instanceof multer.MulterError) {
        // File-too-large is the one limit worth its own status; other multer
        // errors (too many files, unexpected field) are client mistakes → 400.
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

      for (const spec of fields) {
        const file = fileFor(req.files, spec.name);
        if (file === undefined) {
          if (spec.required) {
            res.status(400).json({
              error: "invalid_upload",
              message: `missing file field "${spec.name}"`,
            });
            return;
          }
          continue;
        }
        const maxBytes = spec.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
        if (file.size > maxBytes) {
          res.status(413).json({
            error: "invalid_upload",
            message: `"${spec.name}" exceeds ${maxBytes} bytes`,
          });
          return;
        }
      }

      next();
    });
  };
}

/**
 * Reads a required file established by {@link createUpload}. Call only for a field
 * declared `required`: a missing file here is a wiring bug (the middleware would
 * already have 400'd), so it throws rather than returning `undefined`.
 */
export function getUploadedFile(
  req: { files?: MulterFiles },
  field: string,
): Express.Multer.File {
  const file = fileFor(req.files, field);
  if (file === undefined) {
    throw new Error(
      `getUploadedFile: no file on req for "${field}" — is createUpload mounted before this handler?`,
    );
  }
  return file;
}

/** Reads an optional file established by {@link createUpload} (may be absent). */
export function getOptionalFile(
  req: { files?: MulterFiles },
  field: string,
): Express.Multer.File | undefined {
  return fileFor(req.files, field);
}
