import { useRef, useState } from "react";
import { useLocation } from "react-router";
import { ALL_TOOLS, ToolIcon } from "./tool-directory";

const ACCEPT_SUMMARY: Record<"audio" | "video" | "image", string> = {
  audio: "WAV, MP3, M4A, OGG, FLAC",
  video: "MP4, WebM, MOV, MKV",
  image: "PNG, JPEG, WebP, GIF",
};

export function MediaImportScreen({
  kind,
  accept,
  onFile,
  onFiles,
  multiple = false,
  error = "",
  secondaryAction,
}: {
  kind: "audio" | "video" | "image";
  accept: string;
  onFile?: (file?: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  error?: string;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const { pathname } = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const noun = kind === "image" ? "image" : kind;
  const toolMeta = ALL_TOOLS.find((item) => item.href === pathname);

  function receive(files: FileList | null) {
    if (multiple && onFiles) onFiles(Array.from(files ?? []));
    else onFile?.(files?.[0]);
  }

  return (
    <section
      className={`media-import-screen import-${kind}`}
      aria-label={`Select ${noun} to edit`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        receive(event.dataTransfer.files);
      }}
    >
      <div className={`media-import-card${dragging ? " is-dragging" : ""}`}>
        <div className="import-card-head">
          <span className="import-card-code">
            {toolMeta ? `${toolMeta.code} · ${kind.toUpperCase()}` : `OPENPRODUCER EDITOR · ${kind.toUpperCase()}`}
          </span>
          <span className="import-privacy">
            <span className="status-dot" aria-hidden="true" /> 0 UPLOADS
          </span>
        </div>

        <div className="import-dropzone">
          <span className="import-symbol" aria-hidden="true">
            {toolMeta ? (
              <ToolIcon code={toolMeta.code} />
            ) : kind === "audio" ? (
              "〰"
            ) : kind === "video" ? (
              "▷"
            ) : (
              "▧"
            )}
          </span>
          <h2>Select a local {noun} file</h2>
          <p>Drop {multiple ? "files" : "a file"} into this frame or browse from your device.</p>

          <div className="import-actions">
            <button type="button" className="import-primary" onClick={() => inputRef.current?.click()}>
              {multiple ? `Choose ${noun} files` : `Choose ${noun} file`}
            </button>
            {secondaryAction && (
              <button type="button" className="import-secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(event) => {
              receive(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>

        {toolMeta && (
          <dl className="import-spec-list">
            <div>
              <dt>Capabilities</dt>
              <dd>{toolMeta.spec}</dd>
            </div>
            <div>
              <dt>Accepted input</dt>
              <dd>{ACCEPT_SUMMARY[kind]}</dd>
            </div>
          </dl>
        )}

        {error && (
          <p className="resize-error" role="alert">
            {error}
          </p>
        )}

        <div className="import-card-foot">
          <span>Runs on-device in your browser</span>
          <a className="import-library-link" href="/projects">
            Open saved project ↗
          </a>
        </div>
      </div>
    </section>
  );
}
