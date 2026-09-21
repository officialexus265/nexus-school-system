import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import {
  deleteSchoolRole,
  listPermissionsCatalog,
  listSchoolRoles,
  saveSchoolRole,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/app/roles")({ component: RolesPage });

function RolesPage() {
  const q = useSnapshot();
  const [roles, setRoles] = useState<
    { id: string; name: string; is_system: boolean; permissions: string[] }[]
  >([]);
  const [catalog, setCatalog] = useState<{ id: string; code: string; description: string | null }[]>(
    [],
  );
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const schoolId = q.data?.school?.id;

  async function refresh() {
    if (!schoolId || schoolId === "none") return;
    try {
      const [r, p] = await Promise.all([
        listSchoolRoles({ data: { schoolId } }),
        listPermissionsCatalog(),
      ]);
      setRoles(r.roles);
      setCatalog(p.permissions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load roles");
    }
  }

  useEffect(() => {
    void refresh();
  }, [schoolId]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!schoolId || schoolId === "none") {
    return <p className="text-sm text-muted-foreground">No school selected.</p>;
  }

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Access control"
        title="Roles & permissions"
        description="Create custom roles and tick the permissions each role can use. Assign roles to staff from memberships."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">{editId ? "Edit role" : "New role"}</h2>
          <div className="mt-3 space-y-1.5">
            <Label>Role name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deputy head"
            />
          </div>
          <h3 className="mt-4 text-sm font-medium">Permissions</h3>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-sm">
            {catalog.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(p.code)}
                    onChange={() => toggle(p.code)}
                  />
                  <span>
                    <span className="font-medium">{p.code}</span>
                    {p.description ? (
                      <span className="block text-xs text-muted-foreground">{p.description}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveSchoolRole({
                    data: {
                      schoolId,
                      roleId: editId || undefined,
                      name,
                      permissionCodes: selected,
                    },
                  });
                  toast.success(editId ? "Role updated" : "Role created");
                  setName("");
                  setSelected([]);
                  setEditId(null);
                  await refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {editId ? "Save changes" : "Create role"}
            </Button>
            {editId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setSelected([]);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Existing roles</h2>
          <ul className="mt-3 divide-y divide-border">
            {roles.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">
                    {r.name}{" "}
                    {r.is_system ? (
                      <span className="text-xs text-muted-foreground">(system)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.permissions.length
                      ? r.permissions.join(", ")
                      : "No custom permissions listed"}
                  </p>
                </div>
                {!r.is_system && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditId(r.id);
                        setName(r.name);
                        setSelected([...r.permissions]);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={async () => {
                        if (!window.confirm(`Delete role “${r.name}”?`)) return;
                        try {
                          await deleteSchoolRole({ data: { schoolId, roleId: r.id } });
                          toast.success("Deleted");
                          await refresh();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
            {roles.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No roles yet — create one.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
