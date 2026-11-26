import type { ImageEditorDocument } from "./image-editor/types";

export type ProjectKind = "audio" | "video" | "image";

export type LocalProject = {
  schemaVersion?: number;
  id: string;
  title: string;
  kind: ProjectKind;
  createdAt: number;
  updatedAt: number;
  imageSettings?: ImageProjectSettings;
  sourceAssetId?: string;
  assetName?: string;
  assetType?: string;
  videoTimeline?: VideoTimelineProject;
  audioDocument?: AudioProjectDocument;
  collageDocument?: CollageProjectDocument;
  imageEditorDocument?: ImageEditorDocument;
};

export type CollageProjectDocument = {
  version: 1;
  template?: string;
  width: string;
  height: string;
  columns: string;
  rows?: string;
  gap: string;
  cornerRadius?: string;
  deletedCells?: number;
  customCells?: { x: number; y: number; w: number; h: number }[];
  background: string;
  fit: string;
  caption: string;
  captionSize: string;
  captionColor: string;
  assets: { id: string; name: string; type: string; size: number; slot?: number; cellFit?: "global" | "contain" | "cover"; cellScale?: string; cellOffsetX?: string; cellOffsetY?: string; rotation?: string; flipHorizontal?: boolean; brightness?: string; contrast?: string; saturation?: string }[];
  layers?: { id: string; name: string; type: string; size: number; x: number; y: number; width: number; height: number; rotation?: string; opacity?: string; flipHorizontal?: boolean }[];
};

export type AudioProjectDocument = {
  version: 1;
  sourceAssetId: string | null;
  sourceName: string;
  sourceType: string;
  sourceDuration: number;
  sourceStart: number;
  sourceEnd: number;
  speed: number;
  pitchMode: "preserve" | "natural";
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
};

export type VideoTextSettings = {
  text: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  showBackground: boolean;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize";
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  maxWidth?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  backgroundRadius?: number;
  backgroundOpacity?: number;
  backgroundPadding?: number;
};
export type VideoTimelineAsset = { id: string; name: string; type: string; size: number; duration: number; kind: "video" | "audio" | "image" | "text"; importedAt?: number; fileModifiedAt?: number; width?: number; height?: number; hasAudio?: boolean; derivedFromAssetId?: string; textSettings?: VideoTextSettings; captionCues?: { start: number; end: number; text: string }[]; captionSourceName?: string };
export type VideoClipTransform = { x: number; y: number; scale: number; rotation: number; opacity: number; mirrorX?: boolean; mirrorY?: boolean };
export type VideoImageCrop = { left: number; top: number; right: number; bottom: number };
export type VideoImageSize = { width: number; height: number };
export type VideoTransitionType = "fade" | "wipe-left" | "wipe-right" | "wipe-up" | "wipe-down" | "slide-left" | "slide-right" | "zoom-in";
export type VideoClipTransitions = { fadeIn: number; fadeOut: number; inType?: VideoTransitionType; outType?: VideoTransitionType };
export type KeyframeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type VideoClipKeyframe = { time: number; transform: VideoClipTransform; volume: number; easing?: KeyframeEasing };
export type VideoClipEffects = { brightness: number; contrast: number; saturation: number; grayscale: number; hue?: number; sepia?: number; blur?: number };
export type VideoBlendMode = "source-over" | "screen" | "multiply" | "overlay" | "lighten" | "darken";
export type VideoAnimatedEffectKind = "none" | "float" | "pulse" | "shake" | "blur-in" | "flash" | "color-cycle" | "vignette" | "film-grain";
export type VideoAnimatedEffect = { kind: VideoAnimatedEffectKind; intensity?: number };
export type VideoTimelineClip = { id: string; assetId: string; track: number; start: number; sourceStart: number; sourceEnd: number; speed: number; volume: number; muted: boolean; pitchMode?: "preserve" | "natural"; blendMode?: VideoBlendMode; transform?: VideoClipTransform; effects?: VideoClipEffects; animatedEffect?: VideoAnimatedEffect; transitions?: VideoClipTransitions; keyframes?: VideoClipKeyframe[]; imageCrop?: VideoImageCrop; imageSize?: VideoImageSize; imageMatchAspect?: boolean };
export type VideoTrackState = { hidden?: boolean; muted?: boolean; locked?: boolean };
export type VideoAspectRatioMode = "original" | "custom" | "16:9" | "4:3" | "2.35:1" | "2:1" | "1.85:1" | "9:16" | "3:4" | "1:1";
export type VideoTimelineProject = { version: 1; width: number; height: number; aspectRatioMode?: VideoAspectRatioMode; backgroundColor?: string; fps: number; duration: number; playhead: number; assets: VideoTimelineAsset[]; clips: VideoTimelineClip[]; trackStates?: Record<number, VideoTrackState> };

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
  layers?: ImageLayer[];
  exportFormat?: "png" | "jpeg";
  jpegQuality?: string;
};

export type ImageLayer = { id: string; kind: "rectangle" | "ellipse" | "text"; x: number; y: number; width: number; height: number; fontSize: number; fill: string; text: string; visible: boolean };

const DATABASE_NAME = "local-studio-projects";
const DATABASE_VERSION = 5;
const PROJECTS_STORE = "projects";
const ASSETS_STORE = "asset-fallback";
const CURRENT_PROJECT_SCHEMA = 5;
const EMPTY_AUDIO_DOCUMENT: AudioProjectDocument = { version: 1, sourceAssetId: null, sourceName: "", sourceType: "", sourceDuration: 0, sourceStart: 0, sourceEnd: 0, speed: 1, pitchMode: "preserve", gainDb: 0, fadeIn: 0, fadeOut: 0 };
let databasePromise: Promise<IDBDatabase> | null = null;

export function migrateProjectRecord(input: LocalProject): LocalProject {
  let project = { ...input };
  let version = project.schemaVersion ?? 1;
  if (!Number.isInteger(version) || version < 1 || version > CURRENT_PROJECT_SCHEMA) throw new Error(`Project schema ${version} cannot be opened by this version of OpenProducer Editor.`);
  if (version < 2) {
    project = { ...project, schemaVersion: 2 };
    version = 2;
  }
  if (version < 3) {
    project = { ...project, audioDocument: project.kind === "audio" ? project.audioDocument ?? { ...EMPTY_AUDIO_DOCUMENT } : project.audioDocument, schemaVersion: 3 };
    version = 3;
  }
  if (version < 4) {
    project = { ...project, schemaVersion: 4 };
    version = 4;
  }
  if (version < 5) {
    project = { ...project, schemaVersion: 5 };
  }
  return project;
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          const store = database.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!database.objectStoreNames.contains(ASSETS_STORE)) database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
        const projects = request.transaction?.objectStore(PROJECTS_STORE);
        if (projects && (event as IDBVersionChangeEvent).oldVersion > 0) {
          const cursorRequest = projects.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            try { cursor.update(migrateProjectRecord(cursor.value as LocalProject)); cursor.continue(); }
            catch { request.transaction?.abort(); }
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open local project storage."));
      request.onblocked = () => reject(new Error("Project storage is blocked by another open OpenProducer Editor tab."));
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

async function saveSourceAsset(assetId: string, file: File): Promise<void> {
  let storedInOpfs = false;
  try {
    const directory = await getOpfsAssetDirectory(assetId, true);
    if (directory) {
      const handle = await directory.getFileHandle("source-media", { create: true });
      const writable = await handle.createWritable();
      await writable.write(file); await writable.close(); storedInOpfs = true;
    }
  } catch {
    await removeOpfsAsset(assetId);
  }
  if (!storedInOpfs) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ASSETS_STORE, "readwrite");
      transaction.objectStore(ASSETS_STORE).put({ id: assetId, file });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the source media locally."));
    });
  }
}

async function removeOpfsAsset(assetId: string): Promise<void> {
  try {
    const storage = navigator.storage as StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> };
    if (!storage.getDirectory) return;
    const root = await storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("local-studio", { create: false });
    await appDirectory.removeEntry(assetId, { recursive: true }).catch(() => undefined);
  } catch { /* The asset may not exist in OPFS. */ }
}

async function readSourceAsset(assetId: string, name = "source-media", type = "application/octet-stream"): Promise<File | null> {
  try {
    const directory = await getOpfsAssetDirectory(assetId, false);
    if (directory) {
      const handle = await directory.getFileHandle("source-media");
      const file = await handle.getFile();
      return new File([file], name, { type: type === "application/octet-stream" ? file.type : type });
    }
  } catch { /* The asset may be in the IndexedDB fallback. */ }
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE).get(assetId) as IDBRequest<{ id: string; file: File } | undefined>;
    request.onsuccess = () => resolve(request.result?.file ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read the source media."));
  });
}

async function removeSourceAsset(assetId: string): Promise<void> {
  await removeOpfsAsset(assetId);
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSETS_STORE, "readwrite");
    transaction.objectStore(ASSETS_STORE).delete(assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the old local source asset."));
  });
}

export async function saveProjectSource(id: string, file: File, retainPrevious = false): Promise<string> {
  const current = await getProject(id);
  if (!current) throw new Error("The project no longer exists, so its source was not replaced.");
  const assetId = crypto.randomUUID();
  try {
    await saveSourceAsset(assetId, file);
    await updateProject(id, (project) => ({ ...project, sourceAssetId: assetId, assetName: file.name, assetType: file.type, updatedAt: Date.now() }));
  } catch (cause) {
    await removeSourceAsset(assetId).catch(() => undefined);
    throw cause;
  }
  const oldAssetId = current.sourceAssetId ?? id;
  if (!retainPrevious && oldAssetId !== assetId) await removeSourceAsset(oldAssetId).catch(() => undefined);
  return assetId;
}

export async function readProjectSource(id: string): Promise<File | null> {
  const project = await getProject(id);
  if (!project) return null;
  return readSourceAsset(project.sourceAssetId ?? id, project.assetName ?? "source-image", project.assetType ?? "application/octet-stream");
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
  const project: LocalProject = { id: crypto.randomUUID(), schemaVersion: CURRENT_PROJECT_SCHEMA, title: title.trim(), kind, createdAt: now, updatedAt: now };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    transaction.objectStore(PROJECTS_STORE).add(project);
    transaction.oncomplete = () => resolve(project);
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the local project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the local project was cancelled."));
  });
}

export async function duplicateProject(id: string): Promise<LocalProject> {
  const original = await getProject(id);
  if (!original) throw new Error("The project to duplicate could not be found.");
  const copy = await createProject(`${original.title} copy`, original.kind);
  try {
    if (original.kind === "image") {
      const source = await readProjectSource(id);
      if (source) await saveProjectSource(copy.id, source);
      if (original.imageSettings) await saveImageSettings(copy.id, structuredClone(original.imageSettings));
      if (original.collageDocument) {
        const copiedAssets = await Promise.all(original.collageDocument.assets.map(async (asset) => {
          const file = await readVideoAsset(asset.id);
          if (!file) throw new Error(`The collage source “${asset.name}” is missing. The project was not duplicated.`);
          return { asset: { ...asset, id: crypto.randomUUID() }, file };
        }));
        await saveCollageProject(copy.id, { ...structuredClone(original.collageDocument), assets: copiedAssets.map(({ asset }) => asset) }, copiedAssets.map(({ asset, file }) => ({ id: asset.id, file })));
      }
      if (original.imageEditorDocument) {
        const doc = structuredClone(original.imageEditorDocument);
        const copiedFiles: { id: string; file: File }[] = [];
        if (doc.baseImage) {
          const file = await readVideoAsset(doc.baseImage.id);
          if (!file) throw new Error(`The base image “${doc.baseImage.name}” is missing. The project was not duplicated.`);
          const nextId = crypto.randomUUID();
          doc.baseImage = { ...doc.baseImage, id: nextId };
          copiedFiles.push({ id: nextId, file });
        }
        doc.layers = await Promise.all(doc.layers.map(async (layer) => {
          if (layer.kind !== "image") return layer;
          const file = await readVideoAsset(layer.id);
          if (!file) throw new Error(`The image layer “${layer.assetName}” is missing. The project was not duplicated.`);
          const nextId = crypto.randomUUID();
          copiedFiles.push({ id: nextId, file });
          let nextMaskId = layer.eraserMaskId;
          if (layer.eraserMaskId) {
            const maskFile = await readVideoAsset(layer.eraserMaskId);
            if (maskFile) {
              nextMaskId = crypto.randomUUID();
              copiedFiles.push({ id: nextMaskId, file: maskFile });
            }
          }
          return { ...layer, id: nextId, eraserMaskId: nextMaskId };
        }));
        if (doc.customFonts?.length) {
          doc.customFonts = await Promise.all(doc.customFonts.map(async (font) => {
            const fontFile = await readVideoAsset(font.id);
            if (!fontFile) return font;
            const nextId = crypto.randomUUID();
            copiedFiles.push({ id: nextId, file: fontFile });
            return { ...font, id: nextId };
          }));
        }
        await saveImageEditorProject(copy.id, doc, copiedFiles);
      }
    } else if (original.kind === "audio" && original.audioDocument) {
      const source = original.audioDocument.sourceAssetId ? await readAudioAsset(original.audioDocument.sourceAssetId) : null;
      const document = { ...original.audioDocument, sourceAssetId: source ? `${copy.id}:audio-source` : null };
      await saveAudioProject(copy.id, document, source ?? undefined);
    } else if (original.kind === "video" && original.videoTimeline) {
      const idMap = new Map(original.videoTimeline.assets.map((asset) => [asset.id, crypto.randomUUID()]));
      const assets = original.videoTimeline.assets.map((asset) => ({ ...asset, id: idMap.get(asset.id)!, derivedFromAssetId: asset.derivedFromAssetId ? idMap.get(asset.derivedFromAssetId) : undefined }));
      const files = await Promise.all(original.videoTimeline.assets.filter((asset) => asset.kind !== "text" || asset.size > 0).map(async (asset) => {
        const file = await readVideoAsset(asset.id);
        if (!file) throw new Error(`The source “${asset.name}” is missing. The project was not duplicated.`);
        return { id: idMap.get(asset.id)!, file };
      }));
      const videoTimeline = { ...structuredClone(original.videoTimeline), assets, clips: original.videoTimeline.clips.map((clip) => ({ ...clip, id: crypto.randomUUID(), assetId: idMap.get(clip.assetId)! })) };
      await saveVideoTimeline(copy.id, videoTimeline, files);
    }
    return (await getProject(copy.id))!;
  } catch (cause) {
    await deleteProject(copy.id).catch(() => undefined);
    throw cause;
  }
}

export async function renameProject(id: string, title: string): Promise<void> {
  const nextTitle = title.trim();
  if (!nextTitle) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const request = projects.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result) { transaction.abort(); return; }
      projects.put({ ...request.result, title: nextTitle, updatedAt: Date.now() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not rename the local project."));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  const sourceId = project?.sourceAssetId ?? id;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    transaction.objectStore(PROJECTS_STORE).delete(id);
    transaction.objectStore(ASSETS_STORE).delete(id);
    transaction.objectStore(ASSETS_STORE).delete(sourceId);
    for (const asset of project?.videoTimeline?.assets ?? []) transaction.objectStore(ASSETS_STORE).delete(asset.id);
    if (project?.audioDocument?.sourceAssetId) transaction.objectStore(ASSETS_STORE).delete(project.audioDocument.sourceAssetId);
    if (project?.audioDocument?.sourceAssetId?.endsWith(":audio-source")) transaction.objectStore(ASSETS_STORE).delete(project.audioDocument.sourceAssetId);
    for (const asset of project?.collageDocument?.assets ?? []) transaction.objectStore(ASSETS_STORE).delete(asset.id);
    if (project?.imageEditorDocument?.baseImage) transaction.objectStore(ASSETS_STORE).delete(project.imageEditorDocument.baseImage.id);
    for (const font of project?.imageEditorDocument?.customFonts ?? []) transaction.objectStore(ASSETS_STORE).delete(font.id);
    for (const layer of project?.imageEditorDocument?.layers ?? []) {
      if (layer.kind === "image") {
        transaction.objectStore(ASSETS_STORE).delete(layer.id);
        if (layer.eraserMaskId) transaction.objectStore(ASSETS_STORE).delete(layer.eraserMaskId);
      }
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not delete the local project."));
  });
  const opfsIds = new Set([id, sourceId, project?.audioDocument?.sourceAssetId].filter((assetId): assetId is string => Boolean(assetId)));
  await Promise.all([...opfsIds].map((assetId) => removeOpfsAsset(assetId)));
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

export async function saveAudioProject(id: string, document: AudioProjectDocument, source?: File): Promise<void> {
  const previousProject = await getProject(id);
  if (!previousProject || previousProject.kind !== "audio") throw new Error("The audio project is missing or no longer available.");
  let sourceAssetId = document.sourceAssetId;
  let newlySavedAssetId: string | null = null;
  if (source) {
    newlySavedAssetId = await saveProjectSource(id, source, true);
    sourceAssetId = newlySavedAssetId;
  }
  else if (sourceAssetId === id || sourceAssetId?.endsWith(":audio-source")) {
    const project = await getProject(id);
    sourceAssetId = project?.sourceAssetId ?? sourceAssetId;
  }
  const savedDocument = { ...document, sourceAssetId: sourceAssetId || null };
  const database = await openDatabase();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const request = projects.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result || request.result.kind !== "audio") { transaction.abort(); return; }
      projects.put({ ...request.result, audioDocument: savedDocument, updatedAt: Date.now() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the audio project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The audio project is missing or no longer available."));
  }); } catch (cause) {
    if (newlySavedAssetId) {
      await updateProject(id, (project) => project.sourceAssetId === newlySavedAssetId ? { ...project, sourceAssetId: previousProject.sourceAssetId } : project).catch(() => undefined);
      await removeSourceAsset(newlySavedAssetId).catch(() => undefined);
    }
    throw cause;
  }
  if (newlySavedAssetId) {
    const previousIds = new Set([previousProject.sourceAssetId ?? id, previousProject.audioDocument?.sourceAssetId].filter((assetId): assetId is string => Boolean(assetId)));
    for (const previousId of previousIds) if (previousId !== newlySavedAssetId) await removeSourceAsset(previousId).catch(() => undefined);
  }
}

export async function readAudioAsset(id: string): Promise<File | null> {
  const direct = await readSourceAsset(id, "audio-source");
  if (direct) return direct;
  const projectId = id.endsWith(":audio-source") ? id.slice(0, -":audio-source".length) : id;
  return readProjectSource(projectId);
}

export async function saveCollageProject(id: string, document: CollageProjectDocument, files: { id: string; file: File }[], title?: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const request = projects.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result || request.result.kind !== "image") { transaction.abort(); return; }
      const nextIds = new Set([...document.assets.map((asset) => asset.id), ...(document.layers ?? []).map((layer) => layer.id)]);
      for (const asset of [...(request.result.collageDocument?.assets ?? []), ...(request.result.collageDocument?.layers ?? [])]) if (!nextIds.has(asset.id)) transaction.objectStore(ASSETS_STORE).delete(asset.id);
      for (const asset of files) transaction.objectStore(ASSETS_STORE).put(asset);
      projects.put({ ...request.result, title: title?.trim() || request.result.title, collageDocument: document, updatedAt: Date.now() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the collage project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The image project is missing or no longer available."));
  });
}

/** Save an image editor document and its referenced asset files to local project storage. */
export async function saveImageEditorProject(
  id: string,
  document: ImageEditorDocument,
  files: { id: string; file: File }[],
  title?: string,
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, ASSETS_STORE], "readwrite");
    const projects = transaction.objectStore(PROJECTS_STORE);
    const request = projects.get(id) as IDBRequest<LocalProject | undefined>;
    request.onsuccess = () => {
      if (!request.result || request.result.kind !== "image") { transaction.abort(); return; }
      const nextIds = new Set<string>([
        ...(document.baseImage ? [document.baseImage.id] : []),
        ...(document.customFonts ?? []).map((f) => f.id),
        ...document.layers.flatMap((l) => (l.kind === "image" ? [l.id, ...(l.eraserMaskId ? [l.eraserMaskId] : [])] : [])),
      ]);
      const prevDoc = request.result.imageEditorDocument;
      if (prevDoc?.baseImage && !nextIds.has(prevDoc.baseImage.id)) {
        transaction.objectStore(ASSETS_STORE).delete(prevDoc.baseImage.id);
      }
      for (const font of prevDoc?.customFonts ?? []) {
        if (!nextIds.has(font.id)) transaction.objectStore(ASSETS_STORE).delete(font.id);
      }
      for (const layer of prevDoc?.layers ?? []) {
        if (layer.kind === "image") {
          if (!nextIds.has(layer.id)) transaction.objectStore(ASSETS_STORE).delete(layer.id);
          if (layer.eraserMaskId && !nextIds.has(layer.eraserMaskId)) transaction.objectStore(ASSETS_STORE).delete(layer.eraserMaskId);
        }
      }
      for (const asset of files) transaction.objectStore(ASSETS_STORE).put(asset);
      projects.put({
        ...request.result,
        title: title?.trim() || request.result.title,
        imageEditorDocument: document,
        updatedAt: Date.now(),
      });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the image editor project."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The image project is missing or no longer available."));
  });
}
