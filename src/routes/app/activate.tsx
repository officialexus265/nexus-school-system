
import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Activation fee removed — first subscription payment activates the school. */
export const Route = createFileRoute("/app/activate")({
  component: () => <Navigate to="/app/settings" search={{ billing: "1" } as never} />,
});
