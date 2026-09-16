/**
 * Object storage abstraction.
 *
 * STORAGE_PROVIDER=local (default) — returns the URL as-is (external links)
 * STORAGE_PROVIDER=s3 — S3-compatible (AWS/R2/MinIO) when env is set
 *
 * Upload of binary files from the browser can use presigned URLs later.
 * For now, schools paste public URLs; we register them in stored_files.
 */

export type StoredFile = {
  key: string;
  url: string;
  contentType?: string;
  sizeBytes?: number;
};

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function storageProvider(): "local" | "s3" {
  const p = (env("STORAGE_PROVIDER") || "local").toLowerCase();
  return p === "s3" ? "s3" : "local";
}

/** Register an already-hosted file URL (Drive, CDN, etc.). */
export function registerExternalUrl(url: string, purpose: string, schoolId: string): StoredFile {
  const key = `external/${schoolId}/${purpose}/${Date.now()}`;
  return { key, url, contentType: "application/octet-stream" };
}

/**
 * Build a public URL for a key when using S3.
 * Requires: S3_BUCKET, S3_PUBLIC_BASE_URL (or S3_ENDPOINT + bucket)
 */
export function publicUrlForKey(key: string): string {
  const base = env("S3_PUBLIC_BASE_URL");
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  const bucket = env("S3_BUCKET");
  const endpoint = env("S3_ENDPOINT");
  if (bucket && endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }
  return `/${key}`;
}
