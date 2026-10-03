import {
  ListMusic,
  LogOut,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../../store/player";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Slider } from "../ui/slider";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const REPEAT_ICON: Record<string, { icon: typeof Repeat; active: boolean }> = {
  off: { icon: Repeat, active: false },
  all: { icon: Repeat, active: true },
  one: { icon: Repeat1, active: true },
};

/**
 * The one place audio plays (ADR 0011): a single hidden `<audio>` driven by the
 * player store, plus a control bar (cover, transport, seek, volume, repeat) on
 * the shell's bottom edge. Rendered in the app shell so it survives navigation.
 *
 * Its transport buttons call the store's `request*` actions, so inside a room
 * they command the room rather than this browser (ADR 0017).
 */
export function Player() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const repeat = usePlayerStore((s) => s.repeat);
  const pendingSeek = usePlayerStore((s) => s.pendingSeek);
  const remote = usePlayerStore((s) => s.remote);
  const autoplayBlocked = usePlayerStore((s) => s.autoplayBlocked);

  const toggle = usePlayerStore((s) => s.requestToggle);
  const next = usePlayerStore((s) => s.requestNext);
  const previous = usePlayerStore((s) => s.requestPrevious);
  const requestSeek = usePlayerStore((s) => s.requestSeek);
  const trackEnded = usePlayerStore((s) => s.trackEnded);
  const autoplayRefused = usePlayerStore((s) => s.autoplayRefused);
  const autoplayAllowed = usePlayerStore((s) => s.autoplayAllowed);
  const mediaReady = usePlayerStore((s) => s.mediaReady);
  const mediaLoading = usePlayerStore((s) => s.mediaLoading);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const requestPlayAt = usePlayerStore((s) => s.requestPlayAt);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const seekApplied = usePlayerStore((s) => s.seekApplied);

  const [showQueue, setShowQueue] = useState(false);

  const current = index >= 0 ? queue[index] : undefined;
  const src = current?.playbackUrl ?? "";

  // Load the current source and play/pause it (also plays a newly-selected track).
  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || src === "") {
      return;
    }
    if (audio.src !== src) {
      audio.src = src;
      // Until this one is ready, a seek against it would be applied late.
      mediaLoading();
    }
    if (isPlaying) {
      // A browser refuses to start audio before the viewer has interacted with
      // the page. Swallowing that made a room look like it was playing in
      // silence, so it is recorded and the bar offers a way to start.
      audio.play().then(autoplayAllowed, (err: unknown) => {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          autoplayRefused();
        }
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, src, autoplayAllowed, autoplayRefused, mediaLoading]);

  // Apply a seek asked for from outside the player — following a room's shared
  // position, for instance. Only the element can actually seek.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || pendingSeek === null) {
      return;
    }
    audio.currentTime = pendingSeek.toSeconds;
    seekApplied(pendingSeek.nonce);
  }, [pendingSeek, seekApplied]);

  // Keep the element volume in sync.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio !== null) {
      audio.volume = volume;
    }
  }, [volume]);

  if (current === undefined) {
    return null;
  }

  function handleEnded() {
    if (remote !== null) {
      // In a room nobody advances on their own: every listener would reach the
      // end at roughly the same moment and race to pick the next track. The
      // room waits for someone to choose. See ADR 0017.
      return;
    }
    const audio = audioRef.current;
    if (repeat === "one" && audio !== null) {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
      return;
    }
    trackEnded();
  }

  function handlePrevious() {
    const audio = audioRef.current;
    // "Restart the track if we are past the intro" is a local convenience, and
    // a room's previous means the previous track for everyone.
    if (remote === null && audio !== null && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    previous();
  }

  /** The first gesture that is allowed to start audio after a refusal. */
  function handleUnblock() {
    const audio = audioRef.current;
    if (audio === null) {
      return;
    }
    audio.play().then(autoplayAllowed, () => undefined);
  }

  const RepeatIcon = (REPEAT_ICON[repeat] ?? REPEAT_ICON.off).icon;
  const repeatActive = (REPEAT_ICON[repeat] ?? REPEAT_ICON.off).active;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  return (
    // A flex item in the shell column rather than `fixed`, so the scrolling
    // content is sized around it. The bar's height varies — two rows below
    // `sm`, plus a room banner, plus an autoplay notice — and a `pb-*` on the
    // content guessing at that height was already 6px from being wrong.
    <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur">
      {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded audio has no captions */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onCanPlay={mediaReady}
        onEmptied={mediaLoading}
        onEnded={handleEnded}
      />

      {showQueue && (
        <div className="mx-auto max-h-64 max-w-5xl overflow-auto border-b border-border px-4 py-2 sm:px-6">
          <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
            Queue ({queue.length})
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue is empty.</p>
          ) : (
            <ul className="space-y-1">
              {queue.map((track, i) => (
                <li
                  key={track.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 ${
                    i === index ? "bg-primary/10" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => requestPlayAt(i)}
                    className="min-w-0 flex-1 truncate text-left text-sm"
                  >
                    {i === index ? "▶ " : `${i + 1}. `}
                    {track.name}
                  </button>
                  {/* Removing is local-only, so it would silently desync a
                      room's queue. In a room, the room owns the queue. */}
                  {remote === null && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(i)}
                      aria-label={`Remove ${track.name} from queue`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* A browser will not start audio before the viewer has interacted with
          the page, and in a room the command to start comes from someone else.
          Saying so beats a bar that claims to be playing in silence. */}
      {autoplayBlocked && isPlaying && (
        <div className="border-b border-border bg-primary/10">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <span className="min-w-0 text-sm">
              Your browser is waiting for a tap before it plays audio.
            </span>
            <button
              type="button"
              onClick={handleUnblock}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground"
            >
              Tap to listen
            </button>
          </div>
        </div>
      )}

      {/* While a room owns playback, these buttons command everyone. The bar
          has to say so, and offer the way out (ADR 0017). */}
      {remote !== null && (
        <div className="border-b border-border bg-secondary/40">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              Listening together in{" "}
              <strong className="text-foreground">{remote.label}</strong> —
              these controls play for everyone.
            </span>
            <button
              type="button"
              onClick={remote.leave}
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </button>
          </div>
        </div>
      )}

      {/* Below `sm` the bar wraps into two rows: the track and the queue toggle
          share the first, and the transport + seek take a full-width second one
          (ADR 0016). Three columns on one 390px row left the title as an
          ellipsis. From `sm` up, `flex-nowrap` restores the single row. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Avatar className="h-12 w-12 rounded" size="lg">
            <AvatarImage
              src={current.thumbnailUrl ?? undefined}
              alt=""
              className="rounded"
            />
            <AvatarFallback className="rounded bg-muted">
              <Music className="h-5 w-5 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold">{current.name}</div>
            <div className="hidden truncate text-xs text-muted-foreground uppercase sm:block">
              {current.genres.join(" · ")}
            </div>
          </div>
        </div>

        <div className="order-last flex w-full flex-col items-center gap-1 sm:order-none sm:w-auto sm:flex-[2]">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handlePrevious}
              aria-label="Previous"
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition hover:scale-105"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={`Repeat: ${repeat}`}
              className={
                repeatActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              <RepeatIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
            <span className="w-9 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <Slider
              className="flex-1"
              min={0}
              max={duration || 0}
              step={1}
              value={[Math.min(currentTime, duration || 0)]}
              onValueChange={([v]) => requestSeek(v ?? 0)}
            />
            <span className="w-9 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:flex-1 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowQueue((v) => !v)}
            aria-label="Toggle queue"
            className={
              showQueue
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <ListMusic className="h-4 w-4" />
          </button>
          {/* Hidden on a phone: the device has a volume control, and the bar
              already holds transport and a seek (ADR 0016). */}
          <VolumeIcon
            className="hidden h-4 w-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <Slider
            className="hidden w-24 sm:block"
            min={0}
            max={1}
            step={0.05}
            value={[volume]}
            onValueChange={([v]) => setVolume(v ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}
