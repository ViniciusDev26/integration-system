import { useEffect, useRef } from "react";
import { usePlayerStore } from "../../store/player";
import { Slider } from "../ui/slider";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const REPEAT_LABEL: Record<string, { icon: string; active: boolean }> = {
  off: { icon: "🔁", active: false },
  all: { icon: "🔁", active: true },
  one: { icon: "🔂", active: true },
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

  const repeatUi = REPEAT_LABEL[repeat] ?? REPEAT_LABEL.off;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-gray-500/20 bg-white/95 backdrop-blur dark:bg-[#0d1117]/95">
      {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded audio has no captions */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleEnded}
      />
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {current.thumbnailUrl ? (
            <img
              src={current.thumbnailUrl}
              alt=""
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded bg-gray-500/10">
              🎵
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{current.name}</div>
            <div className="truncate text-xs text-gray-500 uppercase">
              {current.genres.join(" · ")}
            </div>
          </div>
        </div>

        <div className="flex flex-[2] flex-col items-center gap-1">
          <div className="flex items-center gap-4 text-lg">
            <button
              type="button"
              onClick={handlePrevious}
              aria-label="Previous"
            >
              ⏮️
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="text-2xl"
            >
              {isPlaying ? "⏸️" : "▶️"}
            </button>
            <button type="button" onClick={next} aria-label="Next">
              ⏭️
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={`Repeat: ${repeat}`}
              className={repeatUi?.active ? "opacity-100" : "opacity-40"}
            >
              {repeatUi?.icon}
            </button>
          </div>
          <div className="flex w-full items-center gap-2 text-xs text-gray-500">
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

        <div className="flex flex-1 items-center justify-end gap-2">
          <span aria-hidden="true">🔊</span>
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
