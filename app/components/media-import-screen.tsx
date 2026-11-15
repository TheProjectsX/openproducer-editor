import { useRef, useState } from "react";

export function MediaImportScreen({
  kind,
  accept,
  onFile,
  onFiles,
  multiple = false,
  error = "",
}: {
  kind: "audio" | "video" | "image";
  accept: string;
  onFile?: (file?: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const noun = kind === "image" ? "image" : kind;
  function receive(files: FileList | null) {
    if (multiple && onFiles) onFiles(Array.from(files ?? []));
    else onFile?.(files?.[0]);
  }
  return <section className={`media-import-screen import-${kind}`} aria-label={`Select ${noun} to edit`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); receive(event.dataTransfer.files); }}>
    <div className={`media-import-card${dragging ? " is-dragging" : ""}`}>
      <span className="import-symbol" aria-hidden="true">{kind === "audio" ? "〰" : kind === "video" ? "▷" : "▧"}</span>
      <p className="eyebrow">LOCAL STUDIO · {kind.toUpperCase()}</p>
      <h2>Start with your {noun}.</h2>
      <p>Choose a file from this device to open the editor. Your media stays in this browser.</p>
      <button type="button" className="import-primary" onClick={() => inputRef.current?.click()}>{multiple ? `Choose ${noun} files` : `Choose ${noun} file`}</button>
      <input ref={inputRef} className="visually-hidden" type="file" accept={accept} multiple={multiple} onChange={(event) => { receive(event.currentTarget.files); event.currentTarget.value = ""; }} />
      <span className="import-or">OR DROP A FILE HERE</span>
      <a className="import-library-link" href="/projects">Open a saved local project <span aria-hidden="true">↗</span></a>
      {error && <p className="resize-error" role="alert">{error}</p>}
      <span className="import-privacy"><span className="status-dot" /> PRIVATE · NO UPLOADS</span>
    </div>
  </section>;
}
