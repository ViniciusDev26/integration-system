import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

/** Minimal shadcn-style button (ADR 0003); more UI primitives added as needed. */
export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
        variant === "primary"
          ? "bg-[#1db954] text-white hover:opacity-90"
          : "border border-gray-300 bg-transparent hover:bg-gray-500/10 dark:border-gray-600",
        className,
      )}
      {...props}
    />
  );
}
