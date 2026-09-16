import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { createDocument, deleteDocument, listDocuments } from "@/lib/nexus/server";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/documents")({ component: DocumentsPage });

function DocumentsPage() {
  const q = useSnapshot();
  const [docs, setDocs] = useState<
    {
      id: string;
      title: string;
      category: string | null;
      description: string | null;
      file_url: string | null;
      audience: string;
      created_at: string;
    }[]
  >([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("CIRCULAR");
  const [audience, setAudience] = useState("ALL");

  async function refresh(schoolId: string) {
    setDocs((await listDocuments({ data: { schoolId } })).documents);
  }

  useEffect(() => {
    if (q.data?.school?.id) void refresh(q.data.school.id).catch(() => {});
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const schoolId = q.data.school.id;

  return (
    <div>
      <PageHeader
        kicker="Files"
        title="Documents"
        description="Policies, circulars and forms. Link to Drive/Dropbox or any public URL until object storage is connected."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Add document</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>File URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["CIRCULAR", "POLICY", "REPORT", "FORM", "OTHER"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  {["ALL", "STAFF", "PARENTS"].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              onClick={async () => {
                if (!title.trim()) {
                  toast.error("Title required");
                  return;
                }
                try {
                  await createDocument({
                    data: {
                      schoolId,
                      title,
                      fileUrl: url || undefined,
                      category,
                      audience,
                    },
                  });
                  toast.success("Document saved");
                  setTitle("");
                  setUrl("");
                  await refresh(schoolId);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Save
            </Button>
          </div>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Library</h2>
          <ul className="mt-3 divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.category} · {d.audience} · {formatDate(d.created_at)}
                  </p>
                  {d.file_url && (
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-primary underline"
                    >
                      Open file
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await deleteDocument({ data: { schoolId, documentId: d.id } });
                      await refresh(schoolId);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Delete
                </Button>
              </li>
            ))}
            {docs.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No documents yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
