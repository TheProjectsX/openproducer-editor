import type { VideoTimelineAsset } from "./project-store";

export type MediaFilter = "all" | "image" | "video" | "audio";
export type MediaSort = "imported" | "fileDate" | "name" | "type" | "duration";
export type SortDirection = "asc" | "desc";

export function updateMediaSelection(visibleIds: readonly string[], selectedIds: readonly string[], anchorId: string | null, clickedId: string, shift: boolean, toggle: boolean) {
  if (!visibleIds.includes(clickedId)) return [...selectedIds];
  if (shift && anchorId && visibleIds.includes(anchorId)) {
    const start = visibleIds.indexOf(anchorId);
    const end = visibleIds.indexOf(clickedId);
    return visibleIds.slice(Math.min(start, end), Math.max(start, end) + 1);
  }
  if (toggle) return selectedIds.includes(clickedId) ? selectedIds.filter((id) => id !== clickedId) : [...selectedIds, clickedId];
  return [clickedId];
}

export function sortMediaAssets(assets: readonly VideoTimelineAsset[], filter: MediaFilter, sort: MediaSort, direction: SortDirection) {
  const sign = direction === "asc" ? 1 : -1;
  return assets.map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => filter === "all" || asset.kind === filter)
    .sort((left, right) => {
      const a = left.asset;
      const b = right.asset;
      if (sort === "name" || sort === "type") {
        const comparison = (sort === "name" ? a.name : a.kind).localeCompare(sort === "name" ? b.name : b.kind, undefined, { numeric: true, sensitivity: "base" });
        return comparison * sign || left.index - right.index;
      }
      const value = (asset: VideoTimelineAsset, index: number) => {
        if (sort === "imported") return asset.importedAt ?? index;
        if (sort === "fileDate") return asset.fileModifiedAt;
        return asset.kind === "image" || asset.kind === "text" ? undefined : asset.duration;
      };
      const first = value(a, left.index);
      const second = value(b, right.index);
      if (first === undefined || second === undefined) return first === undefined && second === undefined ? left.index - right.index : first === undefined ? 1 : -1;
      return (first - second) * sign || left.index - right.index;
    })
    .map(({ asset }) => asset);
}
