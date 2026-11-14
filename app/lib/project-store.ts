export type ProjectKind = "audio" | "video" | "image";

export type LocalProject = {
  id: string;
  title: string;
  kind: ProjectKind;
  createdAt: number;
  updatedAt: number;
};

const DATABASE_NAME = "local-studio-projects";
const DATABASE_VERSION = 1;
const PROJECTS_STORE = "projects";
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          const store = database.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open local project storage."));
      request.onblocked = () => reject(new Error("Project storage is blocked by another open Local Studio tab."));
    }).catch((error: unknown) => { databasePromise = null; throw error; });
  }
  return databasePromise!;
}

export async function listProjects(): Promise<LocalProject[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readonly");
    const request = transaction.objectStore(PROJECTS_STORE).getAll() as IDBRequest<LocalProject[]>;
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
    request.onerror = () => reject(request.error ?? new Error("Could not read local projects."));
  });
}

export async function createProject(title: string, kind: ProjectKind): Promise<LocalProject> {
  const now = Date.now();
  const project: LocalProject = { id: crypto.randomUUID(), title: title.trim(), kind, createdAt: now, updatedAt: now };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    transaction.objectStore(PROJECTS_STORE).add(project);
    transaction.oncomplete = () => resolve(project);
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the local project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the local project was cancelled."));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    transaction.objectStore(PROJECTS_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the local project."));
  });
}
