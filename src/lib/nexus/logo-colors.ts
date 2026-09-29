/**
 * Client-side dominant colour extraction from a school logo (canvas sampling).
 * Returns hex colours sorted by frequency; caller picks primary/secondary.
 */

export function extractColorsFromImageDataUrl(
  dataUrl: string,
  options?: { maxColors?: number; sampleStep?: number },
): Promise<string[]> {
  const maxColors = options?.maxColors ?? 6;
  const sampleStep = options?.sampleStep ?? 8;

  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve(["#0f766e", "#134e4a"]);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(img.naturalWidth || img.width, 200);
        const h = Math.min(img.naturalHeight || img.height, 200);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(["#0f766e"]);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const buckets = new Map<string, number>();

        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const a = data[i + 3] ?? 0;
          if (a < 128) continue; // skip transparent
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          // Skip near-white / near-black noise for brand suggestions
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max > 245 && min > 230) continue;
          if (max < 25) continue;
          // Quantize to reduce unique colours
          const qr = Math.round(r / 24) * 24;
          const qg = Math.round(g / 24) * 24;
          const qb = Math.round(b / 24) * 24;
          const key = `${qr},${qg},${qb}`;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }

        const sorted = [...buckets.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxColors)
          .map(([key]) => {
            const [r, g, b] = key.split(",").map(Number);
            return rgbToHex(r!, g!, b!);
          });

        resolve(sorted.length ? sorted : ["#0f766e", "#134e4a"]);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Could not load image for colour extraction"));
    img.src = dataUrl;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
