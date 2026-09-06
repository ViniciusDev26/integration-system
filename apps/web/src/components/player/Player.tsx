import {
  ListMusic,
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
 * player store, plus a fixed control bar (cover, transport, seek, volume, repeat).
 * Rendered in the app shell so it survives navigation.
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

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const trackEnded = usePlayerStore((s) => s.trackEnded);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const playAt = usePlayerStore((s) => s.playAt);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);

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
    }
    if (isPlaying) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [isPlaying, src]);

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
    if (audio !== null && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    previous();
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (audio !== null) {
      audio.currentTime = value;
    }
    setCurrentTime(value);
  }

  const RepeatIcon = (REPEAT_ICON[repeat] ?? REPEAT_ICON.off).icon;
  const repeatActive = (REPEAT_ICON[repeat] ?? REPEAT_ICON.off).active;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
      {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded audio has no captions */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />

      {showQueue && (
        <div className="mx-auto max-h-64 max-w-5xl overflow-auto border-b border-border px-6 py-2">
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
                    onClick={() => playAt(i)}
                    className="min-w-0 flex-1 truncate text-left text-sm"
                  >
                    {i === index ? "▶ " : `${i + 1}. `}
                    {track.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(i)}
                    aria-label={`Remove ${track.name} from queue`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
            <div className="truncate text-xs text-muted-foreground uppercase">
              {current.genres.join(" · ")}
            </div>
          </div>
        </div>

        <div className="flex flex-[2] flex-col items-center gap-1">
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
              onValueChange={([v]) => handleSeek(v ?? 0)}
            />
            <span className="w-9 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
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
          <VolumeIcon
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Slider
            className="w-24"
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
