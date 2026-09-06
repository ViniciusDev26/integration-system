import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  genres: z.string().min(1, "At least one genre (comma-separated)"),
  file: z
    .instanceof(FileList)
    .refine((list) => list.length > 0, "An audio file is required"),
  thumbnail: z.instanceof(FileList).optional(),
});
type FormValues = z.infer<typeof schema>;

/** Upload via presigned direct-to-R2 (api ADR 0038): prepare → PUT → create. */
async function putToR2(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function MusicUploadPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const prepareUpload = trpc.musics.prepareUpload.useMutation();
  const createMusic = trpc.musics.create.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues): Promise<void> {
    const audioFile = values.file[0];
    if (audioFile === undefined) {
      return;
    }
    const thumbFile =
      values.thumbnail && values.thumbnail.length > 0
        ? values.thumbnail[0]
        : undefined;

    const prepared = await prepareUpload.mutateAsync({
      audio: {
        filename: audioFile.name,
        contentType: audioFile.type || "application/octet-stream",
      },
      thumbnail: thumbFile
        ? {
            filename: thumbFile.name,
            contentType: thumbFile.type || "application/octet-stream",
          }
        : undefined,
    });

    await putToR2(prepared.audio.uploadUrl, audioFile);
    if (thumbFile && prepared.thumbnail) {
      await putToR2(prepared.thumbnail.uploadUrl, thumbFile);
    }

    const genres = values.genres
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    await createMusic.mutateAsync({
      name: values.name,
      genres,
      objectKey: prepared.audio.objectKey,
      thumbnailObjectKey: prepared.thumbnail?.objectKey ?? null,
    });

    await utils.musics.list.invalidate();
    navigate("/musics");
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg bg-card p-6">
      <h1 className="text-xl font-bold">Upload a track</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Name
          </span>
          <input className={fieldClass} {...register("name")} />
          {errors.name && (
            <span className="text-xs text-destructive">
              {errors.name.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Genres <small>(comma-separated)</small>
          </span>
          <input
            className={fieldClass}
            placeholder="classical, piano"
            {...register("genres")}
          />
          {errors.genres && (
            <span className="text-xs text-destructive">
              {errors.genres.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Audio file
          </span>
          <input
            type="file"
            accept="audio/*"
            className={fieldClass}
            {...register("file")}
          />
          {errors.file && (
            <span className="text-xs text-destructive">
              {errors.file.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Thumbnail <small>(optional)</small>
          </span>
          <input
            type="file"
            accept="image/*"
            className={fieldClass}
            {...register("thumbnail")}
          />
        </label>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
