import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        muted: "border-transparent bg-secondary text-muted-foreground",
        ok: "border-transparent bg-ok/12 text-ok",
        warn: "border-transparent bg-warn/12 text-warn",
        danger: "border-transparent bg-destructive/12 text-destructive",
        outline: "border-border text-foreground",
        ink: "border-transparent bg-ink text-foam",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
