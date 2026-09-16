import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
  tone = "paper",
}: {
  name: string;
  className?: string;
  tone?: "paper" | "ink" | "teal";
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        tone === "ink" && "bg-ink text-foam",
        tone === "teal" && "bg-primary text-primary-foreground",
        tone === "paper" && "bg-secondary text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
