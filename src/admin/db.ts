/* Image storage in IndexedDB (best practice for offline-first admin uploads):
   - localStorage is synchronous + ~5MB: great for small JSON, terrible for images.
   - IndexedDB is async + large quota: the right home for compressed image Blobs.
   Product records only keep a tiny `idb:<key>` reference; blobs resolve to object URLs at render. */

const DB_NAME = 'pearlin';
const STORE = 'images';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    } catch (e) {
      reject(e);
    }
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        let result: T;
        try {
          const req = fn(store);
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        } catch (e) {
          reject(e);
          return;
        }
        transaction.oncomplete = () => {
          db.close();
          resolve(result!);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('IndexedDB transaction failed'));
        };
      }),
  );
}

export async function idbSet(key: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, key));
}

export async function idbGet(key: string): Promise<Blob | null> {
  try {
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(key));
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* already gone — nothing to do */
  }
}

export async function idbAll(): Promise<{ key: string; blob: Blob }[]> {
  const db = await openDb();
  return new Promise((resolve) => {
    const out: { key: string; blob: Blob }[] = [];
    try {
      const transaction = db.transaction(STORE, 'readonly');
      const store = transaction.objectStore(STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          if (typeof cursor.key === 'string' && cursor.value instanceof Blob) {
            out.push({ key: cursor.key, blob: cursor.value });
          }
          cursor.continue();
        }
      };
      cursorReq.onerror = () => resolve(out);
      transaction.oncomplete = () => {
        db.close();
        resolve(out);
      };
      transaction.onerror = () => {
        db.close();
        resolve(out);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(out);
    }
  });
}

export async function idbClear(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

export { blobToDataUrl };

export async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

/* Object-URL cache so the same blob isn't re-created per render. */
const urlCache = new Map<string, string>();

export async function idbUrl(key: string): Promise<string | null> {
  const hit = urlCache.get(key);
  if (hit) return hit;
  const blob = await idbGet(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function idbForget(key: string) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

/** Downscale + JPEG-compress an upload so catalog images stay light (~100–250KB). */
export async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<Blob> {
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
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('compression failed');
    return blob;
  } finally {
    bitmap.close();
  }
}

/** Compress + persist an upload, returning the `idb:<key>` reference for product records. */
export async function storeUpload(file: File, key: string): Promise<string> {
  const blob = await compressImage(file);
  await idbSet(key, blob);
  idbForget(key);
  return `idb:${key}`;
}

export function refKey(ref: string | undefined): string | null {
  if (!ref || !ref.startsWith('idb:')) return null;
  return ref.slice(4);
}
