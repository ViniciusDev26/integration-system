import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** shadcn-style single-value slider on Radix (ADR 0003) — used for seek + volume. */
export function Slider({
  className,
  ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label="value"
        className="block h-3 w-3 rounded-full bg-primary shadow transition-transform hover:scale-110 focus:outline-none"
      />
    </SliderPrimitive.Root>
  );
}
