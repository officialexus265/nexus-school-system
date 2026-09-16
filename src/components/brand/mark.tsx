import { cn } from "@/lib/utils";

export function NexusMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <circle cx="16" cy="6.5" r="2.2" fill="currentColor" />
      <circle cx="25.5" cy="16" r="2.2" fill="currentColor" className="text-primary" />
      <circle cx="16" cy="25.5" r="2.2" fill="currentColor" />
      <circle cx="6.5" cy="16" r="2.2" fill="currentColor" />
      <path
        d="M16 6.5L25.5 16L16 25.5L6.5 16Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NexusWordmark({
  className,
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <NexusMark className={light ? "text-foam" : "text-ink"} />
      <span
        className={cn(
          "font-display text-lg font-medium tracking-tight",
          light ? "text-foam" : "text-ink",
        )}
      >
        NEXUS
      </span>
    </span>
  );
}
