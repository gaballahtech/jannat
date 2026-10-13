import { idbDel, refKey, storeUpload } from '../admin/db';

/* Optional Cloudinary direct upload (no server needed).
   Set in .env (see .env.example):
     VITE_CLOUDINARY_CLOUD_NAME=xxxx
     VITE_CLOUDINARY_PRESET=pearlin_unsigned   (unsigned preset, folder pearlin/products)
   When unset, admin uploads fall back to device-local IndexedDB (`idb:` refs). */

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const PRESET = import.meta.env.VITE_CLOUDINARY_PRESET as string | undefined;

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

/** Downscale + WebP-compress so continuous uploads stay tiny (~100–200KB). */
export async function compressToWebP(file: File, maxDim = 1000, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    // Prefer WebP, fall back to JPEG for old browsers.
    const webp = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', quality),
    );
    if (webp) return webp;
    const jpg = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality),
    );
    if (!jpg) throw new Error('compression failed');
    return jpg;
  } finally {
    bitmap.close();
  }
}

export async function uploadToCloudinary(file: File, folder = 'pearlin/products'): Promise<string> {
  if (!CLOUD || !PRESET) throw new Error('Cloudinary not configured — set VITE_CLOUDINARY_* in .env');
  const blob = await compressToWebP(file);
  const fd = new FormData();
  fd.append('file', blob, file.name.replace(/\.[a-z]+$/i, '') + '.webp');
  fd.append('upload_preset', PRESET);
  fd.append('folder', folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);
  const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!json.secure_url) throw new Error(json.error?.message ?? 'Cloudinary upload failed');
  return json.secure_url;
}

/** Cloudinary when configured (shared URL for all devices), else local IndexedDB. */
export async function storeProductImage(file: File, key: string): Promise<string> {
  if (cloudinaryConfigured()) {
    return uploadToCloudinary(file);
  }
  return storeUpload(file, key);
}

/** Delete the old ref when a photo is replaced (idb keys only — Cloudinary URLs are kept). */
export async function deleteOldRef(ref: string | undefined): Promise<void> {
  if (!ref || !ref.startsWith('idb:')) return;
  const k = refKey(ref);
  if (k) await idbDel(k);
}
