const DATABASE_NAME = "ecommerce360-uploaded-pdfs";
const STORE_NAME = "pdfs";
const DATABASE_VERSION = 1;

export interface UploadedPdf {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  file: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local PDF storage."));
  });
}

export async function saveUploadedPdfs(files: File[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const file of files) {
        store.add({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          file,
        } satisfies UploadedPdf);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the selected PDFs."));
      transaction.onabort = () => reject(transaction.error ?? new Error("PDF upload was cancelled."));
    });
  } finally {
    database.close();
  }
}

export async function listUploadedPdfs(): Promise<UploadedPdf[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as UploadedPdf[]).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
      request.onerror = () => reject(request.error ?? new Error("Could not read the uploaded PDFs."));
    });
  } finally {
    database.close();
  }
}

export async function deleteUploadedPdf(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not delete the PDF."));
    });
  } finally {
    database.close();
  }
}
