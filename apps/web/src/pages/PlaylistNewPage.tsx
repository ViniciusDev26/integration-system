import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";

const schema = z.object({ name: z.string().min(1, "Name is required") });
type FormValues = z.infer<typeof schema>;

export function PlaylistNewPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const create = trpc.playlists.create.useMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues): Promise<void> {
    const playlist = await create.mutateAsync({ name: values.name });
    await utils.playlists.list.invalidate();
    navigate(`/playlists/${playlist.id}`);
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg bg-card p-6">
      <h1 className="text-xl font-bold">New playlist</h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Name
          </span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Road trip"
            {...register("name")}
          />
          {errors.name && (
            <span className="text-xs text-destructive">
              {errors.name.message}
            </span>
          )}
        </label>
        <Button type="submit" disabled={isSubmitting}>
          Create
        </Button>
      </form>
    </div>
  );
}
