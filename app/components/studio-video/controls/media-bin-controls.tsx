import type { MouseEvent } from "react";
import type { MediaFilter, MediaSort, SortDirection } from "../../../lib/video-media-bin";

export function MediaBinControls({
  filter,
  onFilter,
  sort,
  onSort,
  direction,
  onDirection,
}: {
  filter: MediaFilter;
  onFilter: (value: MediaFilter) => void;
  sort: MediaSort;
  onSort: (value: MediaSort) => void;
  direction: SortDirection;
  onDirection: (value: SortDirection) => void;
}) {
  const closeMenu = (event: MouseEvent<HTMLButtonElement>) =>
    event.currentTarget.closest("details")?.removeAttribute("open");

  const sortOptions: { value: MediaSort; label: string }[] = [
    { value: "imported", label: "Time imported" },
    { value: "fileDate", label: "File date" },
    { value: "name", label: "Name" },
    { value: "type", label: "Type" },
    { value: "duration", label: "Duration" },
  ];

  const filterOptions: { value: MediaFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "video", label: "Video" },
    { value: "audio", label: "Audio" },
    { value: "image", label: "Image" },
  ];

  const textOrder = sort === "name" || sort === "type";
  const durationOrder = sort === "duration";

  return (
    <div className="studio-media-menu-buttons">
      <details className="studio-media-menu">
        <summary aria-label="Sort media" title="Sort media">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 4h9M3 8h7M3 12h5M15 4v12m-3-3 3 3 3-3" />
          </svg>
          <span className="studio-menu-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="studio-media-menu-panel" role="group" aria-label="Sort media by">
          {sortOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-label={`Sort by ${option.label}`}
              aria-pressed={sort === option.value}
              onClick={(event) => {
                onSort(option.value);
                closeMenu(event);
              }}
            >
              <span className="studio-menu-check">{sort === option.value ? "✓" : ""}</span>
              {option.label}
            </button>
          ))}
          <div className="studio-menu-divider" />
          {(["desc", "asc"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-label={
                textOrder
                  ? value === "asc"
                    ? "A to Z"
                    : "Z to A"
                  : durationOrder
                    ? value === "asc"
                      ? "Shortest first"
                      : "Longest first"
                    : value === "asc"
                      ? "Oldest first"
                      : "Newest first"
              }
              aria-pressed={direction === value}
              onClick={(event) => {
                onDirection(value);
                closeMenu(event);
              }}
            >
              <span className="studio-menu-check">{direction === value ? "✓" : ""}</span>
              {textOrder
                ? value === "asc"
                  ? "A to Z"
                  : "Z to A"
                : durationOrder
                  ? value === "asc"
                    ? "Shortest first"
                    : "Longest first"
                  : value === "asc"
                    ? "Oldest first"
                    : "Newest first"}
            </button>
          ))}
        </div>
      </details>
      <details className="studio-media-menu">
        <summary aria-label="Filter media" title="Filter media" className={filter !== "all" ? "active" : ""}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2.5 4h15l-6 6.5V16l-3-1.5v-4L2.5 4Z" />
          </svg>
          <span className="studio-menu-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="studio-media-menu-panel studio-filter-menu-panel" role="group" aria-label="Filter media by type">
          {filterOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-label={`Show ${option.label.toLowerCase()} media`}
              aria-pressed={filter === option.value}
              onClick={(event) => {
                onFilter(option.value);
                closeMenu(event);
              }}
            >
              <span className="studio-menu-check">{filter === option.value ? "✓" : ""}</span>
              {option.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
