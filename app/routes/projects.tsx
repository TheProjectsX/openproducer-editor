import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/projects";
import { useNavigate, Link } from "react-router";
import { NavBackButton } from "../components/nav-back-button";
import { BrandMark } from "../components/brand-mark";
import { createProject, deleteProject, duplicateProject, listProjects, type LocalProject, type ProjectKind } from "../lib/project-store";

type FilterKind = "all" | "video" | "audio" | "image" | "collage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local projects | OpenProducer Editor" },
    { name: "description", content: "Manage locally saved OpenProducer Editor project workspaces." },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

function projectBadge(project: LocalProject) {
  if (project.collageDocument) return { label: "IMAGE COLLAGE", tone: "collage" };
  if (project.imageEditorDocument) return { label: "IMAGE EDITOR", tone: "image" };
  if (project.kind === "video") return { label: "VIDEO STUDIO", tone: "video" };
  if (project.kind === "audio") return { label: "AUDIO STUDIO", tone: "audio" };
  return { label: "IMAGE WORKSPACE", tone: "image" };
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ProjectKind>("video");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storage, setStorage] = useState({ usage: 0, quota: 0, persistent: false, canPersist: false });

  async function refresh() {
    try {
      setProjects(await listProjects());
      setError("");
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const persistent = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persistent, canPersist: Boolean(navigator.storage.persist) });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Local project storage is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const project = await createProject(title, kind);
      setTitle("");
      setError("");
      if (kind === "image" || kind === "audio") {
        navigate(`/studio/${kind}?project=${encodeURIComponent(project.id)}`);
        return;
      }
      if (kind === "video") {
        navigate(`/studio/video?project=${encodeURIComponent(project.id)}`);
        return;
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a local project.");
    }
  }

  async function remove(project: LocalProject) {
    if (!window.confirm(`Delete the local project “${project.title}”?`)) return;
    try {
      await deleteProject(project.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the project.");
    }
  }

  async function duplicate(project: LocalProject) {
    try {
      await duplicateProject(project.id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate the local project.");
    }
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;
    try {
      const persistent = await navigator.storage.persist();
      setStorage((current) => ({ ...current, persistent }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request persistent storage.");
    }
  }

  const formatBytes = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

  const counts = useMemo(() => ({
    all: projects.length,
    video: projects.filter((p) => p.kind === "video").length,
    audio: projects.filter((p) => p.kind === "audio").length,
    image: projects.filter((p) => p.kind === "image" && !p.collageDocument).length,
    collage: projects.filter((p) => Boolean(p.collageDocument)).length,
  }), [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === "video" && p.kind !== "video") return false;
      if (filter === "audio" && p.kind !== "audio") return false;
      if (filter === "image" && (p.kind !== "image" || Boolean(p.collageDocument))) return false;
      if (filter === "collage" && !p.collageDocument) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, filter, query]);

  const usagePct = storage.quota > 0 ? Math.min(100, Math.max(2, (storage.usage / storage.quota) * 100)) : 0;

  return (
    <main className="projects-page">
      <header className="site-header">
        <div className="brand-with-back"><NavBackButton fallback="/" /><Link to="/" className="brand"><BrandMark />OpenProducer Editor</Link></div>
        <nav className="site-nav" aria-label="Main navigation">
          <Link to="/tools">Explore tools</Link>
          <Link to="/tools/image/editor">Image editor</Link>
          <Link to="/settings/storage">Storage settings</Link>
        </nav>
      </header>

      <section className="projects-hero">
        <div className="projects-hero-copy">
          <p className="hero-kicker"><span className="status-dot" /> PRIVATE LOCAL WORKSPACES</p>
          <h1>Your projects</h1>
          <p>Every project, timeline, and media source stays inside this browser on your device.</p>
        </div>
        <div className="projects-storage-card">
          <div className="projects-storage-head">
            <strong>Device storage</strong>
            <span className={`projects-persist-pill${storage.persistent ? " is-persistent" : ""}`}>
              {storage.persistent ? "Persistent" : "Standard"}
            </span>
          </div>
          <div className="projects-storage-bar" aria-hidden="true">
            <span style={{ width: `${usagePct}%` }} />
          </div>
          <div className="projects-storage-meta">
            <span>{formatBytes(storage.usage)} used{storage.quota ? ` of ${formatBytes(storage.quota)}` : ""}</span>
            {!storage.persistent && storage.canPersist && (
              <button type="button" className="projects-persist-btn" onClick={() => void requestPersistentStorage()}>
                Keep persistent
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="projects-shell">
        <form className="projects-create-card" onSubmit={(event) => void submit(event)}>
          <div className="projects-card-head">
            <h2>New workspace</h2>
            <span>Saved locally</span>
          </div>
          <label className="ratio-field">
            Project name
            <input
              required
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Untitled project"
            />
          </label>
          <div className="projects-kind-field">
            <span>Workspace type</span>
            <div className="projects-kind-grid" role="radiogroup" aria-label="Workspace type">
              {([
                ["video", "Video", "Multitrack timeline"],
                ["audio", "Audio", "Waveform & mix"],
                ["image", "Image", "Layers & filters"],
              ] as const).map(([id, label, desc]) => (
                <button
                  type="button"
                  key={id}
                  role="radio"
                  aria-checked={kind === id}
                  className={`projects-kind-btn${kind === id ? " is-active" : ""}`}
                  onClick={() => setKind(id)}
                >
                  <strong>{label}</strong>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </div>
          <button className="export-button" disabled={!title.trim() || loading}>
            Create {kind} workspace
          </button>
        </form>

        <section className="projects-list-panel" aria-label="Saved project workspaces">
          <div className="projects-toolbar">
            <div className="projects-filter-tabs" role="tablist" aria-label="Filter projects by type">
              {([
                ["all", "All"],
                ["video", "Video"],
                ["audio", "Audio"],
                ["image", "Image"],
                ["collage", "Collage"],
              ] as const).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  className={`projects-filter-tab${filter === id ? " is-active" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label} <span>{counts[id]}</span>
                </button>
              ))}
            </div>
            <input
              type="search"
              className="projects-search"
              placeholder="Search projects…"
              aria-label="Search saved projects"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>

          {error && <p className="resize-error" role="alert">{error}</p>}

          {loading ? (
            <div className="projects-empty">Loading local project records…</div>
          ) : filtered.length ? (
            <ul className="projects-grid">
              {filtered.map((project) => {
                const badge = projectBadge(project);
                const targetUrl = project.collageDocument
                  ? `/tools/image/collage?project=${encodeURIComponent(project.id)}`
                  : project.imageEditorDocument
                    ? `/tools/image/editor?project=${encodeURIComponent(project.id)}`
                    : `/studio/${project.kind}?project=${encodeURIComponent(project.id)}`;
                return (
                  <li className="project-card" key={project.id}>
                    <div className="project-card-top">
                      <span className={`project-badge tone-${badge.tone}`}>{badge.label}</span>
                      <span className="project-date">{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <strong className="project-card-title">{project.title}</strong>
                    <small className="project-card-sub">Updated {new Date(project.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                    <div className="project-card-actions">
                      <button type="button" className="project-btn-open" onClick={() => navigate(targetUrl)}>Open workspace</button>
                      <button type="button" className="project-btn-secondary" onClick={() => void duplicate(project)} title="Duplicate project">Duplicate</button>
                      <button type="button" className="project-btn-delete" onClick={() => void remove(project)} title="Delete project">Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="projects-empty">
              {projects.length ? "No projects match that filter." : "No local workspaces yet. Create one on the left to begin."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
