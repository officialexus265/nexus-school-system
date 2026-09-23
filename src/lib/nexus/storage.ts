/**
 * Object storage abstraction.
 *
 * STORAGE_PROVIDER=local (default) — external URLs as-is
 * STORAGE_PROVIDER=s3 — S3-compatible (AWS/R2/MinIO)
 * STORAGE_PROVIDER=cloudinary — Cloudinary upload + delivery URLs
 */

export type StoredFile = {
  key: string;
  url: string;
  contentType?: string;
  sizeBytes?: number;
  provider?: string;
};

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function storageProvider(): "local" | "s3" | "cloudinary" {
  const p = (env("STORAGE_PROVIDER") || "local").toLowerCase();
  if (p === "s3") return "s3";
  if (p === "cloudinary") return "cloudinary";
  return "local";
}

export function cloudinaryConfigured(): boolean {
  return Boolean(env("CLOUDINARY_CLOUD_NAME") && env("CLOUDINARY_API_KEY") && env("CLOUDINARY_API_SECRET"));
}

/** Register an already-hosted file URL (Drive, CDN, etc.). */
export function registerExternalUrl(url: string, purpose: string, schoolId: string): StoredFile {
  const key = `external/${schoolId}/${purpose}/${Date.now()}`;
  return { key, url, contentType: "application/octet-stream", provider: "external" };
}

export function publicUrlForKey(key: string): string {
  if (storageProvider() === "cloudinary") {
    const cloud = env("CLOUDINARY_CLOUD_NAME");
    if (cloud) {
      return `https://res.cloudinary.com/${cloud}/image/upload/${key}`;
    }
  }
  const base = env("S3_PUBLIC_BASE_URL");
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  const bucket = env("S3_BUCKET");
  const endpoint = env("S3_ENDPOINT");
  if (bucket && endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }
  return `/${key}`;
}

/**
 * Upload a file (base64 data URI or raw base64) to Cloudinary via unsigned or signed API.
 * Returns secure_url for use in school logo / documents.
 */
export async function uploadToCloudinary(input: {
  dataBase64: string;
  folder?: string;
  filename?: string;
  mimeType?: string;
}): Promise<StoredFile> {
  const cloud = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");
  const apiSecret = env("CLOUDINARY_API_SECRET");
  const preset = env("CLOUDINARY_UPLOAD_PRESET"); // optional unsigned preset

  if (!cloud) throw new Error("CLOUDINARY_CLOUD_NAME is not set");

  // Strip data URL prefix if present
  let b64 = input.dataBase64;
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(b64);
  let mime = input.mimeType || "application/octet-stream";
  if (dataUrlMatch) {
    mime = dataUrlMatch[1] || mime;
    b64 = dataUrlMatch[2] || b64;
  }
  const fileData = `data:${mime};base64,${b64}`;

  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`;
  const body = new URLSearchParams();
  body.set("file", fileData);
  if (input.folder) body.set("folder", input.folder);
  if (input.filename) body.set("public_id", input.filename.replace(/\.[^.]+$/, ""));

  if (preset) {
    // Unsigned upload (no signature)
    body.set("upload_preset", preset);
  } else {
    if (!apiKey || !apiSecret) {
      throw new Error(
        "Set CLOUDINARY_UPLOAD_PRESET (unsigned) or CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET",
      );
    }
    const timestamp = Math.floor(Date.now() / 1000);
    body.set("api_key", apiKey);
    body.set("timestamp", String(timestamp));
    // Simple signature: sha1 of sorted params + secret (Cloudinary convention)
    const { createHash } = await import("crypto");
    const toSign: string[] = [];
    if (input.folder) toSign.push(`folder=${input.folder}`);
    if (input.filename) {
      toSign.push(`public_id=${input.filename.replace(/\.[^.]+$/, "")}`);
    }
    toSign.push(`timestamp=${timestamp}`);
    toSign.sort();
    const signature = createHash("sha1")
      .update(toSign.join("&") + apiSecret)
      .digest("hex");
    body.set("signature", signature);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    bytes?: number;
    format?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.secure_url) {
    throw new Error(json.error?.message || `Cloudinary upload failed (${res.status})`);
  }
  return {
    key: json.public_id || `cloudinary/${Date.now()}`,
    url: json.secure_url,
    sizeBytes: json.bytes,
    contentType: mime,
    provider: "cloudinary",
  };
}
