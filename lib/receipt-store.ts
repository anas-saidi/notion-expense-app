/**
 * Receipt photos wait on this device until you press Read: kept in IndexedDB (photos are too big for
 * localStorage), shrunk first so they upload quickly and cost few tokens. Redrawing through a canvas also
 * drops the photo's metadata, including location.
 */

export type StoredReceipt = { id: string; mimeType: "image/jpeg"; data: string; takenAt: string };

const DB = "receipts";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export const saveReceipt = (receipt: StoredReceipt) => run("readwrite", store => store.put(receipt)).then(() => undefined);
export const loadReceipt = (id: string) => run<StoredReceipt | undefined>("readonly", store => store.get(id) as IDBRequest<StoredReceipt | undefined>);
export const deleteReceipt = (id: string) => run("readwrite", store => store.delete(id)).then(() => undefined);

/** Longest side in pixels: tall receipts stay legible, small enough for a quick, cheap read. */
export const RECEIPT_MAX_SIDE = 1400;

/** Scale a photo so its longest side is at most `max`, keeping the aspect ratio. */
export function fitSize(width: number, height: number, max = RECEIPT_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Shrink and re-encode a camera photo as JPEG (orientation applied, metadata dropped). Base64 without the data: prefix. */
export async function shrinkPhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}
