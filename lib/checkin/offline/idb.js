// Minimal promise wrapper over the check-in IndexedDB. Every call resolves (null / false / []) instead of throwing,
// so a browser without IndexedDB (or with storage blocked) degrades to online-only scanning.

const DB_NAME = "geiger-checkin";
const DB_VERSION = 1;

export const STORES = { snapshots: "snapshots", tickets: "tickets", queue: "queue" };

let dbPromise = null;

export function openCheckinDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        console.error("[checkin.idb] open", e);
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.snapshots)) {
          db.createObjectStore(STORES.snapshots, { keyPath: "eventId" });
        }
        if (!db.objectStoreNames.contains(STORES.tickets)) {
          db.createObjectStore(STORES.tickets, { keyPath: "key" }).createIndex("eventId", "eventId");
        }
        if (!db.objectStoreNames.contains(STORES.queue)) {
          db.createObjectStore(STORES.queue, { keyPath: "clientId" }).createIndex("eventId", "eventId");
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        console.error("[checkin.idb] open", req.error);
        dbPromise = null;
        resolve(null);
      };
      req.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

const settle = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function idbGet(store, key) {
  const db = await openCheckinDb();
  if (!db) return null;
  try {
    return (await settle(db.transaction(store, "readonly").objectStore(store).get(key))) ?? null;
  } catch (e) {
    console.error("[checkin.idb] get", store, e);
    return null;
  }
}

export async function idbPut(store, value) {
  const db = await openCheckinDb();
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    return await done(tx);
  } catch (e) {
    console.error("[checkin.idb] put", store, e);
    return false;
  }
}

export async function idbPutMany(store, values) {
  const db = await openCheckinDb();
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const v of values) os.put(v);
    return await done(tx);
  } catch (e) {
    console.error("[checkin.idb] putMany", store, e);
    return false;
  }
}

export async function idbDelete(store, key) {
  const db = await openCheckinDb();
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    return await done(tx);
  } catch (e) {
    console.error("[checkin.idb] delete", store, e);
    return false;
  }
}

export async function idbAllByEvent(store, eventId) {
  const db = await openCheckinDb();
  if (!db) return [];
  try {
    return (await settle(db.transaction(store, "readonly").objectStore(store).index("eventId").getAll(eventId))) || [];
  } catch (e) {
    console.error("[checkin.idb] getAll", store, e);
    return [];
  }
}

// Replace every row an event has in a store with `rows`, atomically.
export async function idbReplaceEvent(store, eventId, rows) {
  const db = await openCheckinDb();
  if (!db) return false;
  try {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    const keys = await settle(os.index("eventId").getAllKeys(eventId));
    for (const key of keys || []) os.delete(key);
    for (const row of rows || []) os.put(row);
    return await done(tx);
  } catch (e) {
    console.error("[checkin.idb] replace", store, e);
    return false;
  }
}
