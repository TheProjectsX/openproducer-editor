import { useEffect, useState } from "react";
import type { Route } from "./+types/projects";
import { useNavigate } from "react-router";
import { createProject, deleteProject, listProjects, type LocalProject, type ProjectKind } from "../lib/project-store";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Local projects | Local Studio" },
    { name: "description", content: "Manage locally saved Local Studio project workspaces." },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ProjectKind>("video");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try { setProjects(await listProjects()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Local project storage is unavailable."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const project = await createProject(title, kind);
      setTitle(""); setError("");
      if (kind === "image") { navigate(`/studio/image?project=${encodeURIComponent(project.id)}`); return; }
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create a local project."); }
  }

  async function remove(project: LocalProject) {
    if (!window.confirm(`Delete the local project “${project.title}”?`)) return;
    try { await deleteProject(project.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the project."); }
  }

  return <main className="resize-page">
    <header className="resize-header"><a href="/" className="brand">Local Studio</a><nav aria-label="Main navigation"><a href="/">All tools</a></nav></header>
    <section className="resize-intro"><p className="eyebrow">PRIVATE LOCAL WORKSPACES</p><h1>Your projects</h1><p>Project records are stored in this browser on this device. Clearing browser data can remove them.</p></section>
    <section className="project-layout">
      <form className="resize-controls" onSubmit={(event) => void submit(event)}>
        <h2>Create a workspace</h2>
        <label className="ratio-field">Project name<input required maxLength={80} value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Untitled project" /></label>
        <label className="ratio-field">Workspace type<select value={kind} onChange={(event) => setKind(event.currentTarget.value as ProjectKind)}><option value="video">Video</option><option value="audio">Audio</option><option value="image">Image</option></select></label>
        <p className="resize-note">Image workspaces open a local image editor and save the source image and resize adjustments. Audio and video workspaces currently store metadata only.</p>
        <button className="export-button" disabled={!title.trim() || loading}>Create local workspace</button>
      </form>
      <section className="resize-preview" aria-label="Saved project workspaces"><div className="preview-heading"><strong>Saved workspaces</strong><span>{projects.length} project(s)</span></div>
        {loading ? <div className="empty-preview">Loading local project records…</div> : projects.length ? <ul className="project-list">{projects.map((project) => <li key={project.id}><div><span className="eyebrow">{project.kind.toUpperCase()} WORKSPACE</span><strong>{project.title}</strong><small>Updated {new Date(project.updatedAt).toLocaleString()}</small></div><div className="project-actions">{project.kind === "image" && <button type="button" className="project-open" onClick={() => navigate(`/studio/image?project=${encodeURIComponent(project.id)}`)}>Open</button>}<button type="button" className="project-delete" onClick={() => void remove(project)}>Delete</button></div></li>)}</ul> : <div className="empty-preview">No local workspaces yet. Create one to start.</div>}
        {error && <p className="resize-error" role="alert">{error}</p>}
      </section>
    </section>
  </main>;
}
