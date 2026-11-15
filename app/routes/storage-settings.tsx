import { useEffect, useState } from "react";
import type { Route } from "./+types/storage-settings";
import { deleteProject, listProjects, type LocalProject } from "../lib/project-store";

type StorageSummary = { usage: number | null; quota: number | null; persistent: boolean | null; canPersist: boolean };
const EMPTY_STORAGE: StorageSummary = { usage: null, quota: null, persistent: null, canPersist: false };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Storage settings | Local Studio" },
    { name: "description", content: "Review local browser storage and manage saved Local Studio projects." },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function StorageSettings() {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [storage, setStorage] = useState(EMPTY_STORAGE);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function refresh() {
    try {
      setProjects(await listProjects());
      const manager = navigator.storage;
      if (!manager?.estimate) { setStorage(EMPTY_STORAGE); return; }
      const [estimate, persistent] = await Promise.all([
        manager.estimate(),
        manager.persisted ? manager.persisted().catch(() => false) : Promise.resolve(false),
      ]);
      setStorage({ usage: estimate.usage ?? null, quota: estimate.quota ?? null, persistent, canPersist: Boolean(manager.persist) });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read local storage status."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist || requesting) return;
    setRequesting(true); setStatus(""); setError("");
    try {
      const persistent = await navigator.storage.persist();
      setStorage((current) => ({ ...current, persistent }));
      setStatus(persistent ? "Persistent storage was granted by this browser." : "The browser did not grant persistent storage. Projects remain on this device but may be evicted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not request persistent storage."); }
    finally { setRequesting(false); }
  }

  async function remove(project: LocalProject) {
    if (!window.confirm(`Delete “${project.title}” and its saved local media from this browser?`)) return;
    try { await deleteProject(project.id); setStatus(`Deleted “${project.title}” from this device.`); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the saved project."); }
  }

  const formatBytes = (bytes: number | null) => bytes === null ? "Not reported by this browser" : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  const persistenceLabel = storage.persistent === null ? "Not reported" : storage.persistent ? "Persistent storage granted" : "Storage may be cleared by the browser";

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/projects">Projects</a><a href="/tools">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">ON-DEVICE STORAGE</p><h1>Storage settings</h1><p>Projects and source media are stored in this browser on this device. Local Studio does not upload them.</p></section>
    <section className="project-layout">
      <section className="resize-controls" aria-labelledby="storage-status-heading">
        <h2 id="storage-status-heading">Browser storage</h2>
        <p className="resize-note">{formatBytes(storage.usage)} used{storage.quota !== null ? ` of ${formatBytes(storage.quota)}` : ""}</p>
        <p className="resize-note">{persistenceLabel}</p>
        {!storage.persistent && storage.canPersist && <button type="button" className="secondary-button" disabled={requesting} onClick={() => void requestPersistentStorage()}>{requesting ? "Requesting…" : "Request persistent storage"}</button>}
        {storage.persistent === false && !storage.canPersist && <p className="resize-note">This browser does not offer a persistent-storage request.</p>}
        <p className="resize-note">Persistent storage reduces automatic eviction but is not a backup. Clearing this site’s browser data removes saved projects and source files. Download exports you need to keep.</p>
        {status && <p role="status" className="source-info">{status}</p>}
        {error && <p role="alert" className="resize-error">{error}</p>}
      </section>
      <section className="resize-preview" aria-labelledby="storage-projects-heading">
        <div className="preview-heading"><strong id="storage-projects-heading">Saved projects</strong><span>{projects.length}</span></div>
        {loading ? <div className="empty-preview">Reading local project records…</div> : projects.length ? <ul className="project-list">{projects.map((project) => <li key={project.id}><span><strong>{project.title}</strong><small>{project.kind.toUpperCase()} · Updated {new Date(project.updatedAt).toLocaleString()}</small></span><button type="button" className="project-delete" onClick={() => void remove(project)}>Delete</button></li>)}</ul> : <div className="empty-preview">No saved projects are stored in this browser.</div>}
      </section>
    </section>
  </main>;
}
