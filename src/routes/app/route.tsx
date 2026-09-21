import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { readCachedUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const cached =
    typeof window !== "undefined" ? readCachedUser() : null;
  const effective = user || (offline ? cached : null);

  if (isPending && !effective) {
    return (
      <div className="min-h-dvh bg-background p-6">
        <Skeleton className="h-10 w-48" />
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }
  if (!effective) return <RedirectToSignIn />;
  return <AppShell />;
}
