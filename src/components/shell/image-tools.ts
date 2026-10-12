"use client";

import { paletteFromPixels } from "@/lib/backgrounds/palette";

const MAX_SIDE = 2560;

/** Scales a photo down to at most 2560 pixels a side, upright, as WebP where the browser can encode it and JPEG otherwise. */
export async function resizeImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", 0.88);
  if (!blob) throw new Error("This browser could not read that image.");
  return { blob, width, height };
}

/** Sends the resized photo with real upload progress, which `fetch` cannot report. */
export function uploadPhoto(image: { blob: Blob; width: number; height: number }, onProgress: (percent: number) => void, signal: AbortSignal) {
  return new Promise<{ id: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/backgrounds");
    request.setRequestHeader("Content-Type", image.blob.type);
    request.setRequestHeader("X-Image-Width", String(image.width));
    request.setRequestHeader("X-Image-Height", String(image.height));
    request.upload.onprogress = event => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100));
    request.onload = () => {
      const body = JSON.parse(request.responseText || "{}") as { id?: string; error?: string };
      if (request.status >= 200 && request.status < 300 && body.id) resolve({ id: body.id });
      else reject(new Error(body.error ?? "The upload did not finish."));
    };
    request.onerror = () => reject(new Error("The upload did not finish."));
    signal.addEventListener("abort", () => { request.abort(); reject(new Error("Cancelled")); });
    request.send(image.blob);
  });
}

/** The main colours of an uploaded photo, sampled small. */
export async function paletteFromImage(url: string, count = 4) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, 48, 48);
  return paletteFromPixels(context.getImageData(0, 0, 48, 48).data, count);
}
