/**
 * Reference photos for sculpting against. A reference is kept as a small JPEG
 * data URL so it can live in the saved project (browser storage has a few MB
 * in total) and be drawn over or beside the 3D viewer.
 */

export const REFERENCE_MAX_SIDE = 900;

function drawToDataUrl(image: CanvasImageSource, width: number, height: number, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas image processing is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected file could not be decoded as an image."));
  });
}

/** Decode an image file and shrink it to a reference-sized JPEG data URL. */
export async function fileToReferenceDataUrl(file: File, maxSide = REFERENCE_MAX_SIDE): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a PNG, JPEG, WebP, GIF or other browser-supported image.");
  if (file.size > 18 * 1024 * 1024) throw new Error("Please use an image smaller than 18 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return drawToDataUrl(image, image.naturalWidth, image.naturalHeight, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Shrink an existing data URL (e.g. the generator's 1024px preview) to reference size. */
export async function dataUrlToReferenceDataUrl(dataUrl: string, maxSide = REFERENCE_MAX_SIDE): Promise<string> {
  const image = await loadImage(dataUrl);
  if (Math.max(image.naturalWidth, image.naturalHeight) <= maxSide) return dataUrl;
  return drawToDataUrl(image, image.naturalWidth, image.naturalHeight, maxSide);
}

export function isReferenceDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/") && value.length < 4_000_000;
}
