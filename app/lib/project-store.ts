export type ProjectKind = "audio" | "video" | "image";

export type LocalProject = {
  id: string;
  title: string;
  kind: ProjectKind;
  createdAt: number;
  updatedAt: number;
  imageSettings?: ImageProjectSettings;
  assetName?: string;
  assetType?: string;
  videoTimeline?: VideoTimelineProject;
};

export type VideoTextSettings = { text: string; fontSize: number; color: string; backgroundColor: string; showBackground: boolean };
export type VideoTimelineAsset = { id: string; name: string; type: string; size: number; duration: number; kind: "video" | "audio" | "image" | "text"; textSettings?: VideoTextSettings };
export type VideoClipTransform = { x: number; y: number; scale: number; rotation: number; opacity: number };
export type VideoClipTransitions = { fadeIn: number; fadeOut: number };
export type VideoClipKeyframe = { time: number; transform: VideoClipTransform; volume: number };
export type VideoTimelineClip = { id: string; assetId: string; track: number; start: number; sourceStart: number; sourceEnd: number; speed: number; volume: number; muted: boolean; transform?: VideoClipTransform; transitions?: VideoClipTransitions; keyframes?: VideoClipKeyframe[] };
export type VideoTimelineProject = { version: 1; width: number; height: number; fps: number; duration: number; playhead: number; assets: VideoTimelineAsset[]; clips: VideoTimelineClip[] };

export type ImageProjectSettings = {
  width: number;
  height: number;
  ratioMode: string;
  customRatioWidth: string;
  customRatioHeight: string;
  brightness: string;
  contrast: string;
  saturation: string;
  rotation?: string;
  flipHorizontal?: boolean;
};

const DATABASE_NAME = "local-studio-projects";
const DATABASE_VERSION = 2;
const PROJECTS_STORE = "projects";
const ASSETS_STORE = "asset-fallback";
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
        if (!database.objectStoreNames.contains(ASSETS_STORE)) database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open local project storage."));
      request.onblocked = () => reject(new Error("Project storage is blocked by another open Local Studio tab."));
    }).catch((error: unknown) => { databasePromise = null; throw error; });
  }
  return databasePromise!;
}

export async function getProject(id: string): Promise<LocalProject | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(PROJECTS_STORE, "readonly").objectStore(PROJECTS_STORE).get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not load the local project."));
  });
}

async function updateProject(id: string, update: (project: LocalProject) => LocalProject) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result) { transaction.abort(); return; }
      store.put(update(request.result));
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not update the local project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The local project no longer exists."));
  });
}

async function getOpfsAssetDirectory(projectId: string, create: boolean) {
  const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
  if (!storage.getDirectory) return null;
  const root = await storage.getDirectory();
  const appDirectory = await root.getDirectoryHandle("local-studio", { create });
  const projectDirectory = await appDirectory.getDirectoryHandle(projectId, { create });
  return projectDirectory;
}

export async function saveProjectSource(id: string, file: File): Promise<void> {
  let storedInOpfs = false;
  try {
    const directory = await getOpfsAssetDirectory(id, true);
    if (directory) {
      const handle = await directory.getFileHandle("source-media", { create: true });
      const writable = await handle.createWritable();
      await writable.write(file); await writable.close(); storedInOpfs = true;
    }
  } catch { /* Fall back to IndexedDB when OPFS is unavailable or rejects the write. */ }
  if (!storedInOpfs) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ASSETS_STORE, "readwrite");
      transaction.objectStore(ASSETS_STORE).put({ id, file });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the source media locally."));
    });
  }
  await updateProject(id, (project) => ({ ...project, assetName: file.name, assetType: file.type, updatedAt: Date.now() }));
}

export async function readProjectSource(id: string): Promise<File | null> {
  try {
    const directory = await getOpfsAssetDirectory(id, false);
    if (directory) {
      const handle = await directory.getFileHandle("source-media");
      const file = await handle.getFile();
      const project = await getProject(id);
      return new File([file], project?.assetName ?? "source-image", { type: project?.assetType ?? file.type });
    }
  } catch { /* The asset may be in the IndexedDB fallback. */ }
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE).get(id) as IDBRequest<{ id: string; file: File } | undefined>;
    request.onsuccess = () => resolve(request.result?.file ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the source media."));
  });
}

export function saveImageSettings(id: string, imageSettings: ImageProjectSettings): Promise<void> {
  return updateProject(id, (project) => ({ ...project, imageSettings, updatedAt: Date.now() }));
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
  try {
    const directory = await getOpfsAssetDirectory(id, false);
    if (directory) await directory.removeEntry("source-media").catch(() => undefined);
  } catch { /* No OPFS source to remove. */ }
  const database = await openDatabase();
  const project = await getProject(id);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    transaction.objectStore(PROJECTS_STORE).delete(id);
    transaction.objectStore(ASSETS_STORE).delete(id);
    for (const asset of project?.videoTimeline?.assets ?? []) transaction.objectStore(ASSETS_STORE).delete(asset.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the local project."));
  });
}

export async function saveVideoTimeline(id: string, timeline: VideoTimelineProject, files?: { id: string; file: File }[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const request = projects.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result || request.result.kind !== "video") { transaction.abort(); return; }
      const nextAssetIds = new Set(timeline.assets.map((asset) => asset.id));
      for (const asset of request.result.videoTimeline?.assets ?? []) if (!nextAssetIds.has(asset.id)) transaction.objectStore(ASSETS_STORE).delete(asset.id);
      for (const asset of files ?? []) transaction.objectStore(ASSETS_STORE).put(asset);
      projects.put({ ...request.result, videoTimeline: timeline, updatedAt: Date.now() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the video timeline."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The video project is missing or no longer available."));
  });
}

export async function readVideoAsset(id: string): Promise<File | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE).get(id) as IDBRequest<{ id: string; file: File } | undefined>;
    request.onsuccess = () => resolve(request.result?.file ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the saved video asset."));
  });
}
