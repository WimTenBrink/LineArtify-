import { SourceImage, QueueItem, AppOptions } from '../types';

const DB_NAME = 'lineartify_db';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';

// Types for DB Storage
interface DBState {
  id: 'workspace';
  uploads: SourceImage[];
  queue: any[]; // Queue items with Blobs instead of URLs where needed
  options: AppOptions;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'id' });
      }
    };
  });
};

export const saveWorkspace = async (
  uploads: SourceImage[],
  queue: QueueItem[],
  options: AppOptions
): Promise<void> => {
  try {
    // 1. Serialize Queue: Convert Result Blob URLs to actual Blobs
    const serializedQueue = await Promise.all(queue.map(async (item) => {
        const serializableItem = { ...item };
        
        // If result exists and has a URL, fetch it as a blob for storage
        if (item.result && item.result.url && item.result.url.startsWith('blob:')) {
            try {
                const response = await fetch(item.result.url);
                const blob = await response.blob();
                serializableItem.result = {
                    ...item.result,
                    url: '', // Clear ephemeral URL
                    blob: blob // Store persistent Blob
                };
            } catch (e) {
                console.warn('Failed to serialize result blob for item', item.id);
            }
        }
        
        // Thumbnail URL is usually just the Source Image's thumbnail, which we can regenerate from the SourceImage File
        // So we don't strictly need to store the item.thumbnailUrl blob if we link it back, 
        // BUT for simplicity, we'll let the App regenerate URLs on load.
        serializableItem.thumbnailUrl = ''; 
        
        return serializableItem;
    }));

    // 2. Serialize Uploads: SourceImage already contains File objects which IDB can store.
    // We just need to clear the ephemeral thumbnailUrl
    const serializedUploads = uploads.map(u => ({
        ...u,
        thumbnailUrl: ''
    }));

    const state: DBState = {
      id: 'workspace',
      uploads: serializedUploads,
      queue: serializedQueue,
      options,
      timestamp: Date.now()
    };

    const db = await openDB();
    const tx = db.transaction(STORE_STATE, 'readwrite');
    const store = tx.objectStore(STORE_STATE);
    store.put(state);
    
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

  } catch (err) {
    console.error('Failed to save workspace to DB:', err);
  }
};

export const loadWorkspace = async (): Promise<{ uploads: SourceImage[], queue: QueueItem[], options: AppOptions } | null> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_STATE, 'readonly');
        const store = tx.objectStore(STORE_STATE);
        const request = store.get('workspace');
        
        const result = await new Promise<DBState | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!result) return null;

        // Rehydrate Uploads
        const uploads = result.uploads.map(u => ({
            ...u,
            thumbnailUrl: URL.createObjectURL(u.file)
        }));

        // Rehydrate Queue
        const queue = result.queue.map((item: any) => {
            // Restore thumbnail from matching upload
            const source = uploads.find(u => u.id === item.sourceId);
            const thumbnailUrl = source ? source.thumbnailUrl : '';

            // Restore result URL from Blob
            let resultObj = undefined;
            if (item.result && item.result.blob) {
                resultObj = {
                    ...item.result,
                    url: URL.createObjectURL(item.result.blob),
                    blob: undefined // Clear blob from memory model to save RAM
                };
            }

            return {
                ...item,
                thumbnailUrl,
                result: resultObj
            };
        });

        return {
            uploads,
            queue,
            options: result.options
        };

    } catch (err) {
        console.error('Failed to load workspace from DB:', err);
        return null;
    }
};

export const clearWorkspace = async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_STATE, 'readwrite');
    tx.objectStore(STORE_STATE).delete('workspace');
};