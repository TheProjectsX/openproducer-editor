export type NormalizedCell = { x: number; y: number; w: number; h: number };

export type CollagePresetCategory =
  | "featured"
  | "grid"
  | "big-photo-wrap"
  | "wide"
  | "tall"
  | "square"
  | "shapes"
  | "instagram"
  | "facebook-cover"
  | "pinterest";

export type CollagePreset = {
  id: string;
  category: CollagePresetCategory;
  name: string;
  aspectRatio: number; // width / height for thumbnail & optional canvas sizing
  cells: NormalizedCell[];
};

function grid(cols: number, rows: number): NormalizedCell[] {
  const w = 1 / cols;
  const h = 1 / rows;
  const result: NormalizedCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result.push({ x: c * w, y: r * h, w, h });
    }
  }
  return result;
}

function gridMask(pattern: string[]): NormalizedCell[] {
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 1;
  const w = 1 / cols;
  const h = 1 / rows;
  const result: NormalizedCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern[r][c] === "1") result.push({ x: c * w, y: r * h, w, h });
    }
  }
  return result;
}

function enlargedCenterGrid3x3(): NormalizedCell[] {
  const third = 1 / 3;
  return [
    { x: 0, y: 0, w: third, h: third },
    { x: third, y: 0, w: third, h: third },
    { x: 2 * third, y: 0, w: third, h: third },
    { x: 0, y: third, w: third, h: third },
    { x: 2 * third, y: third, w: third, h: third },
    { x: 0, y: 2 * third, w: third, h: third },
    { x: third, y: 2 * third, w: third, h: third },
    { x: 2 * third, y: 2 * third, w: third, h: third },
    // 9th box: enlarged center drawn on top
    { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
  ];
}

export const COLLAGE_PRESETS: CollagePreset[] = [
  // Featured (19 presets)
  {
    id: "featured-01",
    category: "featured",
    name: "Featured 3×4 Grid",
    aspectRatio: 0.85,
    cells: grid(3, 4),
  },
  {
    id: "featured-02",
    category: "featured",
    name: "Featured Mosaic Right",
    aspectRatio: 1.35,
    cells: [
      { x: 0, y: 0, w: 0.66, h: 0.38 },
      { x: 0.66, y: 0, w: 0.34, h: 0.62 },
      { x: 0, y: 0.38, w: 0.2, h: 0.42 },
      { x: 0, y: 0.8, w: 0.2, h: 0.2 },
      { x: 0.2, y: 0.38, w: 0.22, h: 0.3 },
      { x: 0.2, y: 0.68, w: 0.22, h: 0.32 },
      { x: 0.42, y: 0.38, w: 0.24, h: 0.2 },
      { x: 0.42, y: 0.58, w: 0.24, h: 0.42 },
      { x: 0.66, y: 0.62, w: 0.34, h: 0.38 },
    ],
  },
  {
    id: "featured-03",
    category: "featured",
    name: "Featured Split Duo",
    aspectRatio: 1.65,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.55 },
      { x: 0.5, y: 0, w: 0.25, h: 0.45 },
      { x: 0.75, y: 0, w: 0.25, h: 0.45 },
      { x: 0, y: 0.55, w: 0.25, h: 0.45 },
      { x: 0.25, y: 0.55, w: 0.25, h: 0.45 },
      { x: 0.5, y: 0.45, w: 0.5, h: 0.55 },
    ],
  },
  {
    id: "featured-04",
    category: "featured",
    name: "Featured Frame Cutout",
    aspectRatio: 1.35,
    cells: [
      { x: 0, y: 0, w: 0.42, h: 0.35 },
      { x: 0.42, y: 0, w: 0.33, h: 0.35 },
      { x: 0.75, y: 0, w: 0.25, h: 0.28 },
      { x: 0.75, y: 0.28, w: 0.25, h: 0.27 },
      { x: 0, y: 0.35, w: 0.24, h: 0.27 },
      { x: 0, y: 0.62, w: 0.31, h: 0.38 },
      { x: 0.31, y: 0.62, w: 0.44, h: 0.38 },
      { x: 0.75, y: 0.55, w: 0.25, h: 0.45 },
    ],
  },
  {
    id: "featured-05",
    category: "featured",
    name: "Featured Top Banner",
    aspectRatio: 1.35,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.46 },
      { x: 0, y: 0.46, w: 0.5, h: 0.54 },
      { x: 0.5, y: 0.46, w: 0.5, h: 0.54 },
    ],
  },
  {
    id: "featured-06",
    category: "featured",
    name: "Featured Offset Quad",
    aspectRatio: 1.35,
    cells: [
      { x: 0, y: 0, w: 0.38, h: 0.52 },
      { x: 0.38, y: 0, w: 0.62, h: 0.52 },
      { x: 0, y: 0.52, w: 0.62, h: 0.48 },
      { x: 0.62, y: 0.52, w: 0.38, h: 0.48 },
    ],
  },
  {
    id: "featured-07",
    category: "featured",
    name: "Featured Staggered Strips",
    aspectRatio: 1.35,
    cells: [
      { x: 0, y: 0, w: 0.2, h: 0.5 },
      { x: 0, y: 0.5, w: 0.2, h: 0.5 },
      { x: 0.2, y: 0, w: 0.2, h: 0.65 },
      { x: 0.2, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.4, y: 0, w: 0.2, h: 0.38 },
      { x: 0.4, y: 0.38, w: 0.2, h: 0.62 },
      { x: 0.6, y: 0, w: 0.2, h: 0.65 },
      { x: 0.6, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.8, y: 0, w: 0.2, h: 0.5 },
      { x: 0.8, y: 0.5, w: 0.2, h: 0.5 },
    ],
  },
  {
    id: "featured-08",
    category: "featured",
    name: "Featured Left Hero",
    aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.64, h: 1 },
      { x: 0.64, y: 0, w: 0.36, h: 1 / 3 },
      { x: 0.64, y: 1 / 3, w: 0.36, h: 1 / 3 },
      { x: 0.64, y: 2 / 3, w: 0.36, h: 1 / 3 },
    ],
  },
  {
    id: "featured-09",
    category: "featured",
    name: "Featured L-Wrap",
    aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.76, h: 0.75 },
      { x: 0, y: 0, w: 0.24, h: 0.25 },
      { x: 0, y: 0.25, w: 0.24, h: 0.25 },
      { x: 0, y: 0.5, w: 0.24, h: 0.25 },
      { x: 0, y: 0.75, w: 0.25, h: 0.25 },
      { x: 0.25, y: 0.75, w: 0.25, h: 0.25 },
      { x: 0.5, y: 0.75, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.75, w: 0.25, h: 0.25 },
    ],
  },
  {
    id: "featured-10",
    category: "featured",
    name: "Featured Border Frame",
    aspectRatio: 1.35,
    cells: [
      { x: 1 / 6, y: 0.25, w: 4 / 6, h: 0.5 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0, w: 1 / 6, h: 0.25 })),
      { x: 0, y: 0.25, w: 1 / 6, h: 0.25 },
      { x: 0, y: 0.5, w: 1 / 6, h: 0.25 },
      { x: 5 / 6, y: 0.25, w: 1 / 6, h: 0.25 },
      { x: 5 / 6, y: 0.5, w: 1 / 6, h: 0.25 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0.75, w: 1 / 6, h: 0.25 })),
    ],
  },
  {
    id: "featured-11",
    category: "featured",
    name: "Featured 9-Box Enlarged Center",
    aspectRatio: 1,
    cells: enlargedCenterGrid3x3(),
  },
  {
    id: "featured-12",
    category: "featured",
    name: "Featured Center Spotlight",
    aspectRatio: 1.35,
    cells: [
      { x: 0.24, y: 0.26, w: 0.52, h: 0.48 },
      { x: 0, y: 0, w: 0.5, h: 0.26 },
      { x: 0.5, y: 0, w: 0.5, h: 0.26 },
      { x: 0, y: 0.26, w: 0.24, h: 0.16 },
      { x: 0, y: 0.42, w: 0.24, h: 0.16 },
      { x: 0, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0.76, y: 0.26, w: 0.24, h: 0.16 },
      { x: 0.76, y: 0.42, w: 0.24, h: 0.16 },
      { x: 0.76, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0, y: 0.74, w: 0.5, h: 0.26 },
      { x: 0.5, y: 0.74, w: 0.5, h: 0.26 },
    ],
  },
  {
    id: "featured-13",
    category: "featured",
    name: "Featured Side Filmstrip",
    aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0, y: i * 0.2, w: 0.24, h: 0.2 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0.76, y: i * 0.2, w: 0.24, h: 0.2 })),
    ],
  },
  {
    id: "featured-14",
    category: "featured",
    name: "Featured Wide Wing Grid",
    aspectRatio: 1.9,
    cells: [
      { x: 0.28, y: 0, w: 0.44, h: 1 },
      ...Array.from({ length: 4 }, (_, r) => [
        { x: 0, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.14, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.72, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.86, y: r * 0.25, w: 0.14, h: 0.25 },
      ]).flat(),
    ],
  },
  {
    id: "featured-15",
    category: "featured",
    name: "Featured Portrait Story",
    aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.44, h: 0.17 },
      { x: 0, y: 0.17, w: 0.44, h: 0.17 },
      { x: 0.44, y: 0, w: 0.28, h: 0.34 },
      { x: 0.72, y: 0, w: 0.28, h: 0.34 },
      { x: 0, y: 0.34, w: 0.64, h: 0.38 },
      { x: 0.64, y: 0.34, w: 0.36, h: 0.38 },
      { x: 0, y: 0.72, w: 0.36, h: 0.28 },
      { x: 0.36, y: 0.72, w: 0.32, h: 0.28 },
      { x: 0.68, y: 0.72, w: 0.32, h: 0.28 },
    ],
  },
  {
    id: "featured-16",
    category: "featured",
    name: "Featured Tall 6-Strip",
    aspectRatio: 0.35,
    cells: grid(1, 6),
  },
  {
    id: "featured-17",
    category: "featured",
    name: "Featured Portrait Editorial",
    aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.26, h: 0.22 },
      { x: 0.26, y: 0, w: 0.32, h: 0.22 },
      { x: 0.58, y: 0, w: 0.42, h: 0.22 },
      { x: 0, y: 0.22, w: 0.38, h: 0.38 },
      { x: 0.38, y: 0.22, w: 0.31, h: 0.19 },
      { x: 0.69, y: 0.22, w: 0.31, h: 0.19 },
      { x: 0.38, y: 0.41, w: 0.62, h: 0.19 },
      { x: 0, y: 0.6, w: 0.25, h: 0.2 },
      { x: 0, y: 0.8, w: 0.25, h: 0.2 },
      { x: 0.25, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.75, y: 0.6, w: 0.25, h: 0.2 },
      { x: 0.75, y: 0.8, w: 0.25, h: 0.2 },
    ],
  },
  {
    id: "featured-18",
    category: "featured",
    name: "Featured Wide Hero Right",
    aspectRatio: 2.3,
    cells: [
      { x: 0, y: 0, w: 0.32, h: 0.58 },
      { x: 0.32, y: 0, w: 0.18, h: 0.58 },
      { x: 0, y: 0.58, w: 0.22, h: 0.42 },
      { x: 0.22, y: 0.58, w: 0.28, h: 0.42 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "featured-19",
    category: "featured",
    name: "Featured Wide Pillars",
    aspectRatio: 2.6,
    cells: [
      { x: 0, y: 0, w: 0.22, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.22, y: i * 0.25, w: 0.12, h: 0.25 })),
      { x: 0.34, y: 0, w: 0.32, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.66, y: i * 0.25, w: 0.12, h: 0.25 })),
      { x: 0.78, y: 0, w: 0.22, h: 1 },
    ],
  },

  // Grid (30 presets)
  { id: "grid-01", category: "grid", name: "Grid 3×4", aspectRatio: 0.88, cells: grid(3, 4) },
  { id: "grid-02", category: "grid", name: "Grid 3×2 Square", aspectRatio: 1, cells: grid(3, 2) },
  { id: "grid-03", category: "grid", name: "Grid 2×3 Square", aspectRatio: 1, cells: grid(2, 3) },
  {
    id: "grid-04",
    category: "grid",
    name: "Grid 6×6 Frame",
    aspectRatio: 1,
    cells: [
      { x: 1 / 6, y: 1 / 6, w: 4 / 6, h: 4 / 6 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0, w: 1 / 6, h: 1 / 6 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0, y: (i + 1) / 6, w: 1 / 6, h: 1 / 6 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 5 / 6, y: (i + 1) / 6, w: 1 / 6, h: 1 / 6 })),
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 5 / 6, w: 1 / 6, h: 1 / 6 })),
    ],
  },
  {
    id: "grid-05",
    category: "grid",
    name: "Grid 4×4 Frame",
    aspectRatio: 1,
    cells: [
      { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.25 })),
      { x: 0, y: 0.25, w: 0.25, h: 0.25 },
      { x: 0, y: 0.5, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.25, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.5, w: 0.25, h: 0.25 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "grid-06",
    category: "grid",
    name: "Grid Nested Quadrants",
    aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.25, h: 0.25 }, { x: 0.25, y: 0, w: 0.25, h: 0.25 },
      { x: 0, y: 0.25, w: 0.25, h: 0.25 }, { x: 0.25, y: 0.25, w: 0.25, h: 0.25 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, { x: 0.75, y: 0.5, w: 0.25, h: 0.25 },
      { x: 0.5, y: 0.75, w: 0.25, h: 0.25 }, { x: 0.75, y: 0.75, w: 0.25, h: 0.25 },
    ],
  },
  {
    id: "grid-07",
    category: "grid",
    name: "Grid Pinwheel",
    aspectRatio: 1,
    cells: [
      { x: 0.25, y: 0.25, w: 0.45, h: 0.45 },
      { x: 0.25, y: 0, w: 0.75, h: 0.25 },
      { x: 0.7, y: 0.25, w: 0.3, h: 0.75 },
      { x: 0, y: 0.7, w: 0.7, h: 0.3 },
      { x: 0, y: 0, w: 0.25, h: 0.7 },
    ],
  },
  {
    id: "grid-08",
    category: "grid",
    name: "Grid 3-Col Staggered",
    aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.38 }, { x: 0, y: 0.38, w: 1 / 3, h: 0.62 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.72 }, { x: 1 / 3, y: 0.72, w: 1 / 3, h: 0.28 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.46 }, { x: 2 / 3, y: 0.46, w: 1 / 3, h: 0.54 },
    ],
  },
  {
    id: "grid-09",
    category: "grid",
    name: "Grid Left Stack + Hero",
    aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.34, h: 0.36 },
      { x: 0, y: 0.36, w: 0.34, h: 0.64 },
      { x: 0.34, y: 0, w: 0.66, h: 1 },
    ],
  },
  {
    id: "grid-10",
    category: "grid",
    name: "Grid Hero Left + Trio",
    aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.65 },
      { x: 0.6, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.8, y: 0.65, w: 0.2, h: 0.35 },
    ],
  },
  { id: "grid-11", category: "grid", name: "Grid 3×2 Wide", aspectRatio: 1.5, cells: grid(3, 2) },
  {
    id: "grid-12",
    category: "grid",
    name: "Grid Center Pillar",
    aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.32, h: 0.5 }, { x: 0, y: 0.5, w: 0.32, h: 0.5 },
      { x: 0.32, y: 0, w: 0.36, h: 1 },
      { x: 0.68, y: 0, w: 0.32, h: 0.5 }, { x: 0.68, y: 0.5, w: 0.32, h: 0.5 },
    ],
  },
  {
    id: "grid-13",
    category: "grid",
    name: "Grid Editorial 7",
    aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.36, h: 0.25 }, { x: 0, y: 0.25, w: 0.36, h: 0.25 },
      { x: 0.36, y: 0, w: 0.36, h: 0.5 }, { x: 0.72, y: 0, w: 0.28, h: 0.5 },
      { x: 0, y: 0.5, w: 0.68, h: 0.5 },
      { x: 0.68, y: 0.5, w: 0.32, h: 0.25 }, { x: 0.68, y: 0.75, w: 0.32, h: 0.25 },
    ],
  },
  {
    id: "grid-14",
    category: "grid",
    name: "Grid 5-Col Staggered",
    aspectRatio: 1.65,
    cells: [
      { x: 0, y: 0, w: 0.2, h: 0.5 }, { x: 0, y: 0.5, w: 0.2, h: 0.5 },
      { x: 0.2, y: 0, w: 0.2, h: 0.65 }, { x: 0.2, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.4, y: 0, w: 0.2, h: 0.38 }, { x: 0.4, y: 0.38, w: 0.2, h: 0.62 },
      { x: 0.6, y: 0, w: 0.2, h: 0.65 }, { x: 0.6, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.8, y: 0, w: 0.2, h: 0.5 }, { x: 0.8, y: 0.5, w: 0.2, h: 0.5 },
    ],
  },
  {
    id: "grid-15",
    category: "grid",
    name: "Grid 5-Col Header",
    aspectRatio: 1.65,
    cells: [
      ...Array.from({ length: 5 }, (_, i) => ({ x: i * 0.2, y: 0, w: 0.2, h: 0.36 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: i * 0.2, y: 0.36, w: 0.2, h: 0.64 })),
    ],
  },
  {
    id: "grid-16",
    category: "grid",
    name: "Grid Hero + 8 Sidebar",
    aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.64, h: 1 },
      ...Array.from({ length: 4 }, (_, r) => [
        { x: 0.64, y: r * 0.25, w: 0.18, h: 0.25 },
        { x: 0.82, y: r * 0.25, w: 0.18, h: 0.25 },
      ]).flat(),
    ],
  },
  { id: "grid-17", category: "grid", name: "Grid 5×3", aspectRatio: 1.7, cells: grid(5, 3) },
  { id: "grid-18", category: "grid", name: "Grid 4×2", aspectRatio: 1.9, cells: grid(4, 2) },
  { id: "grid-19", category: "grid", name: "Grid 2-Col Narrow Left", aspectRatio: 1.6, cells: [{ x: 0, y: 0, w: 0.38, h: 1 }, { x: 0.38, y: 0, w: 0.62, h: 1 }] },
  { id: "grid-20", category: "grid", name: "Grid 2-Col Wide Left", aspectRatio: 1.6, cells: [{ x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.62, y: 0, w: 0.38, h: 1 }] },
  { id: "grid-21", category: "grid", name: "Grid 2-Col Square", aspectRatio: 0.95, cells: grid(2, 1) },
  { id: "grid-22", category: "grid", name: "Grid 2-Col Wide", aspectRatio: 1.9, cells: grid(2, 1) },
  { id: "grid-23", category: "grid", name: "Grid 2-Row Tall", aspectRatio: 0.55, cells: grid(1, 2) },
  { id: "grid-24", category: "grid", name: "Grid 2×2 Square", aspectRatio: 1, cells: grid(2, 2) },
  { id: "grid-25", category: "grid", name: "Grid 3-Col", aspectRatio: 1.5, cells: grid(3, 1) },
  { id: "grid-26", category: "grid", name: "Grid 3-Col Panoramic", aspectRatio: 2.8, cells: grid(3, 1) },
  { id: "grid-27", category: "grid", name: "Grid 3-Row Tall", aspectRatio: 0.35, cells: grid(1, 3) },
  { id: "grid-28", category: "grid", name: "Grid 4-Col", aspectRatio: 1.6, cells: grid(4, 1) },
  { id: "grid-29", category: "grid", name: "Grid 4-Col Panoramic", aspectRatio: 3.2, cells: grid(4, 1) },
  { id: "grid-30", category: "grid", name: "Grid 4-Row Tall", aspectRatio: 0.26, cells: grid(1, 4) },

  // Big Photo Wrap (24 presets)
  {
    id: "big-photo-wrap-01", category: "big-photo-wrap", name: "Big Photo Bottom + 3 Top", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 0, y: 0.34, w: 1, h: 0.66 }],
  },
  {
    id: "big-photo-wrap-02", category: "big-photo-wrap", name: "Big Photo Top + 3 Bottom", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 1, h: 0.66 }, { x: 0, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0.66, w: 1 / 3, h: 0.34 }],
  },
  {
    id: "big-photo-wrap-03", category: "big-photo-wrap", name: "Big Photo Right + 3 Left", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 0.34, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 0.34, h: 1 / 3 }, { x: 0.34, y: 0, w: 0.66, h: 1 }],
  },
  {
    id: "big-photo-wrap-04", category: "big-photo-wrap", name: "Big Photo Left + 3 Right", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 0.66, h: 1 }, { x: 0.66, y: 0, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 2 / 3, w: 0.34, h: 1 / 3 }],
  },
  {
    id: "big-photo-wrap-05", category: "big-photo-wrap", name: "Big Photo Top-Right L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.76, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-06", category: "big-photo-wrap", name: "Big Photo Bottom-Right L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0.24, w: 0.76, h: 0.76 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 })),
    ],
  },
  {
    id: "big-photo-wrap-07", category: "big-photo-wrap", name: "Big Photo Top-Left L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.76, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-08", category: "big-photo-wrap", name: "Big Photo Bottom-Left L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0, y: 0.24, w: 0.76, h: 0.76 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 })),
    ],
  },
  {
    id: "big-photo-wrap-09", category: "big-photo-wrap", name: "Big Photo Wide Frame", aspectRatio: 1.45,
    cells: [
      { x: 1 / 6, y: 0.25, w: 4 / 6, h: 0.5 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0, w: 1 / 6, h: 0.25 })),
      { x: 0, y: 0.25, w: 1 / 6, h: 0.25 }, { x: 0, y: 0.5, w: 1 / 6, h: 0.25 },
      { x: 5 / 6, y: 0.25, w: 1 / 6, h: 0.25 }, { x: 5 / 6, y: 0.5, w: 1 / 6, h: 0.25 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0.75, w: 1 / 6, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-10", category: "big-photo-wrap", name: "Big Photo 9-Box Enlarged Center", aspectRatio: 1,
    cells: enlargedCenterGrid3x3(),
  },
  {
    id: "big-photo-wrap-11", category: "big-photo-wrap", name: "Big Photo Left + 4 Right", aspectRatio: 0.95,
    cells: [{ x: 0, y: 0, w: 0.58, h: 1 }, ...Array.from({ length: 4 }, (_, i) => ({ x: 0.58, y: i * 0.25, w: 0.42, h: 0.25 }))],
  },
  {
    id: "big-photo-wrap-12", category: "big-photo-wrap", name: "Big Photo Wide Left + 4 Right", aspectRatio: 1.25,
    cells: [{ x: 0, y: 0, w: 0.68, h: 1 }, ...Array.from({ length: 4 }, (_, i) => ({ x: 0.68, y: i * 0.25, w: 0.32, h: 0.25 }))],
  },
  {
    id: "big-photo-wrap-13", category: "big-photo-wrap", name: "Big Photo Top + 4 Bottom", aspectRatio: 1.25,
    cells: [{ x: 0, y: 0, w: 1, h: 0.72 }, ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.72, w: 0.25, h: 0.28 }))],
  },
  {
    id: "big-photo-wrap-14", category: "big-photo-wrap", name: "Big Photo Bottom + 4 Top", aspectRatio: 1.25,
    cells: [...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.28 })), { x: 0, y: 0.28, w: 1, h: 0.72 }],
  },
  {
    id: "big-photo-wrap-15", category: "big-photo-wrap", name: "Big Photo Center Spotlight", aspectRatio: 1.25,
    cells: [
      { x: 0.24, y: 0.26, w: 0.52, h: 0.48 },
      { x: 0, y: 0, w: 0.5, h: 0.26 }, { x: 0.5, y: 0, w: 0.5, h: 0.26 },
      { x: 0, y: 0.26, w: 0.24, h: 0.16 }, { x: 0, y: 0.42, w: 0.24, h: 0.16 }, { x: 0, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0.76, y: 0.26, w: 0.24, h: 0.16 }, { x: 0.76, y: 0.42, w: 0.24, h: 0.16 }, { x: 0.76, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0, y: 0.74, w: 0.5, h: 0.26 }, { x: 0.5, y: 0.74, w: 0.5, h: 0.26 },
    ],
  },
  {
    id: "big-photo-wrap-16", category: "big-photo-wrap", name: "Big Photo 4×4 Surround", aspectRatio: 1.25,
    cells: [
      { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.25 })),
      { x: 0, y: 0.25, w: 0.25, h: 0.25 }, { x: 0, y: 0.5, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.25, w: 0.25, h: 0.25 }, { x: 0.75, y: 0.5, w: 0.25, h: 0.25 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-17", category: "big-photo-wrap", name: "Big Photo Filmstrip", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0, y: i * 0.2, w: 0.24, h: 0.2 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0.76, y: i * 0.2, w: 0.24, h: 0.2 })),
    ],
  },
  {
    id: "big-photo-wrap-18", category: "big-photo-wrap", name: "Big Photo Dual Center", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 0.5 }, { x: 0.24, y: 0.5, w: 0.52, h: 0.5 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-19", category: "big-photo-wrap", name: "Big Photo U-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0.75, w: 1 / 3, h: 0.25 })),
    ],
  },
  {
    id: "big-photo-wrap-20", category: "big-photo-wrap", name: "Big Photo Editorial Right", aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.5 + i * (0.5 / 3), y: 0, w: 0.5 / 3, h: 0.14 })),
      { x: 0.5, y: 0.14, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.38, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.62, w: 0.5, h: 0.24 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.5 + i * (0.5 / 3), y: 0.86, w: 0.5 / 3, h: 0.14 })),
    ],
  },
  {
    id: "big-photo-wrap-21", category: "big-photo-wrap", name: "Big Photo + 3×3 Grid", aspectRatio: 1.9,
    cells: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({ x: 0.55 + c * 0.15, y: r / 3, w: 0.15, h: 1 / 3 }))).flat(),
    ],
  },
  {
    id: "big-photo-wrap-22", category: "big-photo-wrap", name: "Big Photo + 2×3 Grid", aspectRatio: 1.4,
    cells: [
      { x: 0, y: 0, w: 0.55, h: 1 },
      ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 2 }, (_, c) => ({ x: 0.55 + c * 0.225, y: r / 3, w: 0.225, h: 1 / 3 }))).flat(),
    ],
  },
  {
    id: "big-photo-wrap-23", category: "big-photo-wrap", name: "Big Photo Asymmetric Wings", aspectRatio: 1.85,
    cells: [
      { x: 0.25, y: 0, w: 0.43, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.25, h: 0.25 })),
      ...Array.from({ length: 5 }, (_, r) => [
        { x: 0.68, y: r * 0.2, w: 0.16, h: 0.2 },
        { x: 0.84, y: r * 0.2, w: 0.16, h: 0.2 },
      ]).flat(),
    ],
  },
  {
    id: "big-photo-wrap-24", category: "big-photo-wrap", name: "Big Photo Center + 16", aspectRatio: 1.9,
    cells: [
      { x: 0.28, y: 0, w: 0.44, h: 1 },
      ...Array.from({ length: 4 }, (_, r) => [
        { x: 0, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.14, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.72, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.86, y: r * 0.25, w: 0.14, h: 0.25 },
      ]).flat(),
    ],
  },


  // Wide (29 presets)
  { id: "wide-01", category: "wide", name: "Wide Narrow + Wide", aspectRatio: 1.6, cells: [{ x: 0, y: 0, w: 0.38, h: 1 }, { x: 0.38, y: 0, w: 0.62, h: 1 }] },
  { id: "wide-02", category: "wide", name: "Wide + Narrow", aspectRatio: 1.6, cells: [{ x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.62, y: 0, w: 0.38, h: 1 }] },
  { id: "wide-03", category: "wide", name: "Wide 3 Columns", aspectRatio: 1.55, cells: grid(3, 1) },
  { id: "wide-04", category: "wide", name: "Wide 4 Columns", aspectRatio: 1.85, cells: grid(4, 1) },
  {
    id: "wide-05", category: "wide", name: "Wide Split Duo", aspectRatio: 1.65,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.55 }, { x: 0.5, y: 0, w: 0.25, h: 0.45 }, { x: 0.75, y: 0, w: 0.25, h: 0.45 },
      { x: 0, y: 0.55, w: 0.25, h: 0.45 }, { x: 0.25, y: 0.55, w: 0.25, h: 0.45 }, { x: 0.5, y: 0.45, w: 0.5, h: 0.55 },
    ],
  },
  { id: "wide-06", category: "wide", name: "Wide 3-Col Asymmetric", aspectRatio: 1.35, cells: [{ x: 0, y: 0, w: 0.46, h: 1 }, { x: 0.46, y: 0, w: 0.27, h: 1 }, { x: 0.73, y: 0, w: 0.27, h: 1 }] },
  { id: "wide-07", category: "wide", name: "Wide 3 Rows", aspectRatio: 1.45, cells: grid(1, 3) },
  { id: "wide-08", category: "wide", name: "Wide Top + 2 Bottom", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 1, h: 0.48 }, { x: 0, y: 0.48, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.48, w: 0.5, h: 0.52 }] },
  {
    id: "wide-09", category: "wide", name: "Wide 2 Cols + Split Right", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.62 }, { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 }],
  },
  {
    id: "wide-10", category: "wide", name: "Wide Split Middle", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.55 }, { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }],
  },
  {
    id: "wide-11", category: "wide", name: "Wide Left Pillar + 3", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.35, h: 1 }, { x: 0.35, y: 0, w: 0.325, h: 0.46 }, { x: 0.675, y: 0, w: 0.325, h: 0.46 }, { x: 0.35, y: 0.46, w: 0.65, h: 0.54 }],
  },
  {
    id: "wide-12", category: "wide", name: "Wide Bottom Banner", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.5, h: 0.55 }, { x: 0.5, y: 0, w: 0.5, h: 0.275 }, { x: 0.5, y: 0.275, w: 0.5, h: 0.275 }, { x: 0, y: 0.55, w: 1, h: 0.45 }],
  },
  {
    id: "wide-13", category: "wide", name: "Wide Staggered Quad", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.55, h: 0.55 }, { x: 0, y: 0.55, w: 0.55, h: 0.45 }, { x: 0.55, y: 0, w: 0.45, h: 0.36 }, { x: 0.55, y: 0.36, w: 0.45, h: 0.64 }],
  },
  {
    id: "wide-14", category: "wide", name: "Wide Offset Quad", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.38, h: 0.52 }, { x: 0.38, y: 0, w: 0.62, h: 0.52 }, { x: 0, y: 0.52, w: 0.62, h: 0.48 }, { x: 0.62, y: 0.52, w: 0.38, h: 0.48 }],
  },
  {
    id: "wide-15", category: "wide", name: "Wide 2 Pillars + 3 Stack", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.44, h: 1 }, { x: 0.44, y: 0, w: 0.3, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.74, y: i / 3, w: 0.26, h: 1 / 3 }))],
  },
  {
    id: "wide-16", category: "wide", name: "Wide Center 3 Stack", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.34, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.34, y: i / 3, w: 0.33, h: 1 / 3 })), { x: 0.67, y: 0, w: 0.33, h: 1 }],
  },
  {
    id: "wide-17", category: "wide", name: "Wide 3 Top + 2 Bottom", aspectRatio: 1.45,
    cells: [...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 0.48 })), { x: 0, y: 0.48, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.48, w: 0.5, h: 0.52 }],
  },
  {
    id: "wide-18", category: "wide", name: "Wide 2 Left + 3 Right", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.48, h: 0.5 }, { x: 0, y: 0.5, w: 0.48, h: 0.5 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.48, y: i / 3, w: 0.52, h: 1 / 3 }))],
  },
  {
    id: "wide-19", category: "wide", name: "Wide Asymmetric 5", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.58, h: 0.54 }, { x: 0, y: 0.54, w: 0.29, h: 0.46 }, { x: 0.29, y: 0.54, w: 0.29, h: 0.46 }, { x: 0.58, y: 0, w: 0.42, h: 0.38 }, { x: 0.58, y: 0.38, w: 0.42, h: 0.62 }],
  },
  {
    id: "wide-20", category: "wide", name: "Wide 2×3 Grid + Hero", aspectRatio: 1.45,
    cells: [...Array.from({ length: 3 }, (_, r) => [{ x: 0, y: r / 3, w: 0.32, h: 1 / 3 }, { x: 0.32, y: r / 3, w: 0.32, h: 1 / 3 }]).flat(), { x: 0.64, y: 0, w: 0.36, h: 1 }],
  },
  {
    id: "wide-21", category: "wide", name: "Wide Offset 6", aspectRatio: 1.45,
    cells: [
      { x: 0, y: 0, w: 0.28, h: 0.44 }, { x: 0.28, y: 0, w: 0.44, h: 0.44 }, { x: 0.72, y: 0, w: 0.28, h: 0.44 },
      { x: 0, y: 0.44, w: 0.5, h: 0.56 }, { x: 0.5, y: 0.44, w: 0.28, h: 0.56 }, { x: 0.78, y: 0.44, w: 0.22, h: 0.56 },
    ],
  },
  {
    id: "wide-22", category: "wide", name: "Wide 5-Col Staggered", aspectRatio: 1.5,
    cells: [
      { x: 0, y: 0, w: 0.2, h: 0.5 }, { x: 0, y: 0.5, w: 0.2, h: 0.5 },
      { x: 0.2, y: 0, w: 0.2, h: 0.65 }, { x: 0.2, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.4, y: 0, w: 0.2, h: 0.38 }, { x: 0.4, y: 0.38, w: 0.2, h: 0.62 },
      { x: 0.6, y: 0, w: 0.2, h: 0.65 }, { x: 0.6, y: 0.65, w: 0.2, h: 0.35 },
      { x: 0.8, y: 0, w: 0.2, h: 0.5 }, { x: 0.8, y: 0.5, w: 0.2, h: 0.5 },
    ],
  },
  {
    id: "wide-23", category: "wide", name: "Wide Panorama + 3 Right", aspectRatio: 2.1,
    cells: [{ x: 0, y: 0, w: 0.24, h: 1 }, { x: 0.24, y: 0, w: 0.52, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i / 3, w: 0.24, h: 1 / 3 }))],
  },
  {
    id: "wide-24", category: "wide", name: "Wide Border Frame", aspectRatio: 1.45,
    cells: [
      { x: 1 / 6, y: 0.25, w: 4 / 6, h: 0.5 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0, w: 1 / 6, h: 0.25 })),
      { x: 0, y: 0.25, w: 1 / 6, h: 0.25 }, { x: 0, y: 0.5, w: 1 / 6, h: 0.25 },
      { x: 5 / 6, y: 0.25, w: 1 / 6, h: 0.25 }, { x: 5 / 6, y: 0.5, w: 1 / 6, h: 0.25 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0.75, w: 1 / 6, h: 0.25 })),
    ],
  },
  { id: "wide-25", category: "wide", name: "Wide Hero + 4 Right", aspectRatio: 1.4, cells: [{ x: 0, y: 0, w: 0.68, h: 1 }, ...Array.from({ length: 4 }, (_, i) => ({ x: 0.68, y: i * 0.25, w: 0.32, h: 0.25 }))] },
  {
    id: "wide-26", category: "wide", name: "Wide Hero + 3×3 Grid", aspectRatio: 2.0,
    cells: [{ x: 0, y: 0, w: 0.52, h: 1 }, ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({ x: 0.52 + c * 0.16, y: r / 3, w: 0.16, h: 1 / 3 }))).flat()],
  },
  {
    id: "wide-27", category: "wide", name: "Wide Hero + 2×3 Grid", aspectRatio: 1.45,
    cells: [{ x: 0, y: 0, w: 0.55, h: 1 }, ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 2 }, (_, c) => ({ x: 0.55 + c * 0.225, y: r / 3, w: 0.225, h: 1 / 3 }))).flat()],
  },
  {
    id: "wide-28", category: "wide", name: "Wide Asymmetric Wings", aspectRatio: 1.85,
    cells: [
      { x: 0.25, y: 0, w: 0.43, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.25, h: 0.25 })),
      ...Array.from({ length: 5 }, (_, r) => [{ x: 0.68, y: r * 0.2, w: 0.16, h: 0.2 }, { x: 0.84, y: r * 0.2, w: 0.16, h: 0.2 }]).flat(),
    ],
  },
  {
    id: "wide-29", category: "wide", name: "Wide Center + 16", aspectRatio: 1.95,
    cells: [
      { x: 0.28, y: 0, w: 0.44, h: 1 },
      ...Array.from({ length: 4 }, (_, r) => [
        { x: 0, y: r * 0.25, w: 0.14, h: 0.25 }, { x: 0.14, y: r * 0.25, w: 0.14, h: 0.25 },
        { x: 0.72, y: r * 0.25, w: 0.14, h: 0.25 }, { x: 0.86, y: r * 0.25, w: 0.14, h: 0.25 },
      ]).flat(),
    ],
  },

  // Tall (17 presets)
  { id: "tall-01", category: "tall", name: "Tall 2 Rows", aspectRatio: 0.55, cells: grid(1, 2) },
  {
    id: "tall-02", category: "tall", name: "Tall Narrow Mosaic", aspectRatio: 0.32,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.14 }, { x: 0.5, y: 0, w: 0.5, h: 0.14 },
      { x: 0, y: 0.14, w: 1, h: 0.14 },
      { x: 0, y: 0.28, w: 0.5, h: 0.18 }, { x: 0.5, y: 0.28, w: 0.5, h: 0.12 }, { x: 0.5, y: 0.4, w: 0.5, h: 0.16 },
      { x: 0, y: 0.46, w: 0.5, h: 0.1 },
      { x: 0, y: 0.56, w: 1, h: 0.14 },
      { x: 0, y: 0.7, w: 1, h: 0.14 },
      { x: 0, y: 0.84, w: 0.5, h: 0.16 }, { x: 0.5, y: 0.84, w: 0.5, h: 0.16 },
    ],
  },
  {
    id: "tall-03", category: "tall", name: "Tall Story 9", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.4, h: 0.36 }, { x: 0.4, y: 0, w: 0.6, h: 0.18 }, { x: 0.4, y: 0.18, w: 0.6, h: 0.18 },
      { x: 0, y: 0.36, w: 0.64, h: 0.36 }, { x: 0.64, y: 0.36, w: 0.36, h: 0.36 },
      { x: 0, y: 0.72, w: 0.36, h: 0.28 }, { x: 0.36, y: 0.72, w: 0.32, h: 0.28 }, { x: 0.68, y: 0.72, w: 0.32, h: 0.28 },
    ],
  },
  {
    id: "tall-04", category: "tall", name: "Tall Editorial 6", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.24 },
      { x: 0, y: 0.24, w: 0.35, h: 0.24 }, { x: 0, y: 0.48, w: 0.35, h: 0.24 },
      { x: 0.35, y: 0.24, w: 0.65, h: 0.48 },
      { x: 0, y: 0.72, w: 0.58, h: 0.28 }, { x: 0.58, y: 0.72, w: 0.42, h: 0.28 },
    ],
  },
  {
    id: "tall-05", category: "tall", name: "Tall Asymmetric 5", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.68, h: 0.28 }, { x: 0.68, y: 0, w: 0.32, h: 0.28 },
      { x: 0, y: 0.28, w: 0.34, h: 0.38 }, { x: 0.34, y: 0.28, w: 0.66, h: 0.38 },
      { x: 0, y: 0.66, w: 1, h: 0.34 },
    ],
  },
  {
    id: "tall-06", category: "tall", name: "Tall Strip + 2×2 Top", aspectRatio: 0.26,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.14 }, { x: 0.5, y: 0, w: 0.5, h: 0.14 },
      { x: 0, y: 0.14, w: 0.5, h: 0.14 }, { x: 0.5, y: 0.14, w: 0.5, h: 0.14 },
      { x: 0, y: 0.28, w: 1, h: 0.24 }, { x: 0, y: 0.52, w: 1, h: 0.24 }, { x: 0, y: 0.76, w: 1, h: 0.24 },
    ],
  },
  { id: "tall-07", category: "tall", name: "Tall 6 Strip", aspectRatio: 0.28, cells: grid(1, 6) },
  {
    id: "tall-08", category: "tall", name: "Tall Hero Top + 8", aspectRatio: 0.82,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.46 },
      { x: 0, y: 0.46, w: 0.46, h: 0.27 }, { x: 0, y: 0.73, w: 0.46, h: 0.27 },
      ...Array.from({ length: 3 }, (_, r) => [
        { x: 0.46, y: 0.46 + r * 0.18, w: 0.27, h: 0.18 },
        { x: 0.73, y: 0.46 + r * 0.18, w: 0.27, h: 0.18 },
      ]).flat(),
    ],
  },
  {
    id: "tall-09", category: "tall", name: "Tall Center + Wings", aspectRatio: 0.82,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.28 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.28 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.28 },
      { x: 0, y: 0.28, w: 1 / 3, h: 0.22 }, { x: 0, y: 0.5, w: 1 / 3, h: 0.22 },
      { x: 1 / 3, y: 0.28, w: 1 / 3, h: 0.44 },
      { x: 2 / 3, y: 0.28, w: 1 / 3, h: 0.22 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.22 },
      { x: 0, y: 0.72, w: 0.5, h: 0.28 }, { x: 0.5, y: 0.72, w: 0.5, h: 0.28 },
    ],
  },
  {
    id: "tall-10", category: "tall", name: "Tall Hero Left + Stack", aspectRatio: 0.82,
    cells: [
      { x: 0, y: 0, w: 0.46, h: 0.7 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.46, y: i * (0.7 / 3), w: 0.54, h: 0.7 / 3 })),
      { x: 0, y: 0.7, w: 0.46, h: 0.3 }, { x: 0.46, y: 0.7, w: 0.54, h: 0.3 },
    ],
  },
  {
    id: "tall-11", category: "tall", name: "Tall Stacked 5", aspectRatio: 0.72,
    cells: [
      { x: 0, y: 0, w: 0.44, h: 0.46 },
      { x: 0.44, y: 0, w: 0.56, h: 0.23 }, { x: 0.44, y: 0.23, w: 0.56, h: 0.23 },
      { x: 0, y: 0.46, w: 1, h: 0.27 }, { x: 0, y: 0.73, w: 1, h: 0.27 },
    ],
  },
  {
    id: "tall-12", category: "tall", name: "Tall Top Banner + 6", aspectRatio: 0.72,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.28 },
      ...Array.from({ length: 3 }, (_, r) => [
        { x: 0, y: 0.28 + r * 0.24, w: 0.5, h: 0.24 },
        { x: 0.5, y: 0.28 + r * 0.24, w: 0.5, h: 0.24 },
      ]).flat(),
    ],
  },
  {
    id: "tall-13", category: "tall", name: "Tall Editorial 7", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.25 }, { x: 0.5, y: 0, w: 0.5, h: 0.25 },
      { x: 0, y: 0.25, w: 1, h: 0.27 },
      { x: 0, y: 0.52, w: 0.62, h: 0.24 }, { x: 0.62, y: 0.52, w: 0.38, h: 0.24 },
      { x: 0, y: 0.76, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.76, w: 0.5, h: 0.24 },
    ],
  },
  {
    id: "tall-14", category: "tall", name: "Tall Pillar + 5", aspectRatio: 0.85,
    cells: [
      { x: 0, y: 0, w: 0.44, h: 1 },
      { x: 0.44, y: 0, w: 0.56, h: 0.36 },
      { x: 0.44, y: 0.36, w: 0.28, h: 0.36 }, { x: 0.72, y: 0.36, w: 0.28, h: 0.36 },
      { x: 0.44, y: 0.72, w: 0.28, h: 0.28 }, { x: 0.72, y: 0.72, w: 0.28, h: 0.28 },
    ],
  },
  {
    id: "tall-15", category: "tall", name: "Tall Hero Top + 6", aspectRatio: 0.88,
    cells: [
      { x: 0, y: 0, w: 1, h: 0.45 },
      { x: 0, y: 0.45, w: 0.46, h: 0.55 },
      { x: 0.46, y: 0.45, w: 0.27, h: 0.183 }, { x: 0.46, y: 0.633, w: 0.27, h: 0.183 }, { x: 0.46, y: 0.816, w: 0.27, h: 0.184 },
      { x: 0.73, y: 0.45, w: 0.27, h: 0.275 }, { x: 0.73, y: 0.725, w: 0.27, h: 0.275 },
    ],
  },
  {
    id: "tall-16", category: "tall", name: "Tall Mosaic 9", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.55, h: 0.32 }, { x: 0.55, y: 0, w: 0.45, h: 0.32 },
      { x: 0, y: 0.32, w: 0.28, h: 0.34 }, { x: 0.28, y: 0.32, w: 0.36, h: 0.34 }, { x: 0.64, y: 0.32, w: 0.36, h: 0.34 },
      { x: 0, y: 0.66, w: 0.52, h: 0.34 },
      { x: 0.52, y: 0.66, w: 0.48, h: 0.17 },
      { x: 0.52, y: 0.83, w: 0.24, h: 0.17 }, { x: 0.76, y: 0.83, w: 0.24, h: 0.17 },
    ],
  },
  {
    id: "tall-17", category: "tall", name: "Tall 3-Col Asymmetric", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.44, h: 0.48 }, { x: 0, y: 0.48, w: 0.44, h: 0.52 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.44, y: i / 3, w: 0.28, h: 1 / 3 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.72, y: i / 3, w: 0.28, h: 1 / 3 })),
    ],
  },

  // Square (19 presets)
  { id: "square-01", category: "square", name: "Square 2 Columns", aspectRatio: 1, cells: grid(2, 1) },
  { id: "square-02", category: "square", name: "Square 2×2", aspectRatio: 1, cells: grid(2, 2) },
  { id: "square-03", category: "square", name: "Square 3×4", aspectRatio: 1, cells: grid(3, 4) },
  { id: "square-04", category: "square", name: "Square 4×4", aspectRatio: 1, cells: grid(4, 4) },
  { id: "square-05", category: "square", name: "Square 6×6", aspectRatio: 1, cells: grid(6, 6) },
  {
    id: "square-06", category: "square", name: "Square 3 Top + Hero", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 0, y: 0.34, w: 1, h: 0.66 }],
  },
  {
    id: "square-07", category: "square", name: "Square Hero + 3 Bottom", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 1, h: 0.66 }, { x: 0, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0.66, w: 1 / 3, h: 0.34 }],
  },
  {
    id: "square-08", category: "square", name: "Square 3 Left + Hero", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 0.34, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 0.34, h: 1 / 3 }, { x: 0.34, y: 0, w: 0.66, h: 1 }],
  },
  {
    id: "square-09", category: "square", name: "Square Hero + 3 Right", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 0.66, h: 1 }, { x: 0.66, y: 0, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 2 / 3, w: 0.34, h: 1 / 3 }],
  },
  {
    id: "square-10", category: "square", name: "Square Top-Right L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.76, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "square-11", category: "square", name: "Square Bottom-Right L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0.24, w: 0.76, h: 0.76 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 })),
    ],
  },
  {
    id: "square-12", category: "square", name: "Square Top-Left L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.76, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },
  {
    id: "square-13", category: "square", name: "Square Bottom-Left L-Wrap", aspectRatio: 1,
    cells: [
      { x: 0, y: 0.24, w: 0.76, h: 0.76 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 })),
    ],
  },
  {
    id: "square-14", category: "square", name: "Square 9-Box Enlarged Center", aspectRatio: 1,
    cells: enlargedCenterGrid3x3(),
  },
  {
    id: "square-15", category: "square", name: "Square Filmstrip", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0, y: i * 0.2, w: 0.24, h: 0.2 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: 0.76, y: i * 0.2, w: 0.24, h: 0.2 })),
    ],
  },
  {
    id: "square-16", category: "square", name: "Square Dual Center", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 0.5 }, { x: 0.24, y: 0.5, w: 0.52, h: 0.5 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
    ],
  },
  {
    id: "square-17", category: "square", name: "Square U-Wrap", aspectRatio: 1,
    cells: [
      { x: 0.24, y: 0, w: 0.52, h: 0.75 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0.75, w: 1 / 3, h: 0.25 })),
    ],
  },
  {
    id: "square-18", category: "square", name: "Square Editorial Right", aspectRatio: 1,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.5 + i * (0.5 / 3), y: 0, w: 0.5 / 3, h: 0.14 })),
      { x: 0.5, y: 0.14, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.38, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.62, w: 0.5, h: 0.24 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.5 + i * (0.5 / 3), y: 0.86, w: 0.5 / 3, h: 0.14 })),
    ],
  },
  {
    id: "square-19", category: "square", name: "Square 5 Top + 2 + 6", aspectRatio: 1,
    cells: [
      ...Array.from({ length: 5 }, (_, i) => ({ x: i * 0.2, y: 0, w: 0.2, h: 0.24 })),
      { x: 0, y: 0.24, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.24, w: 0.5, h: 0.52 },
      ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0.76, w: 1 / 6, h: 0.24 })),
    ],
  },

  // Shapes (13 presets)
  { id: "shapes-01", category: "shapes", name: "Shape Heart", aspectRatio: 7 / 6, cells: gridMask([".11.11.", "1111111", "1111111", ".11111.", "..111..", "...1..."]) },
  { id: "shapes-02", category: "shapes", name: "Shape X-Cross", aspectRatio: 1, cells: gridMask(["1.1", ".1.", "1.1"]) },
  { id: "shapes-03", category: "shapes", name: "Shape Plus", aspectRatio: 1, cells: gridMask([".1.", "111", ".1."]) },
  { id: "shapes-04", category: "shapes", name: "Shape Checkerboard", aspectRatio: 1, cells: gridMask(["1.1.1", ".1.1.", "1.1.1", ".1.1.", "1.1.1"]) },
  { id: "shapes-05", category: "shapes", name: "Shape Diamond", aspectRatio: 1, cells: gridMask(["..1..", ".111.", "11111", ".111.", "..1.."]) },
  { id: "shapes-06", category: "shapes", name: "Shape Pyramid Up", aspectRatio: 5 / 3, cells: gridMask(["..1..", ".111.", "11111"]) },
  { id: "shapes-07", category: "shapes", name: "Shape Pyramid Down", aspectRatio: 5 / 3, cells: gridMask(["11111", ".111.", "..1.."]) },
  { id: "shapes-08", category: "shapes", name: "Shape Arrow Right", aspectRatio: 3 / 5, cells: gridMask(["1..", "11.", "111", "11.", "1.."]) },
  { id: "shapes-09", category: "shapes", name: "Shape Arrow Left", aspectRatio: 3 / 5, cells: gridMask(["..1", ".11", "111", ".11", "..1"]) },
  { id: "shapes-10", category: "shapes", name: "Shape Hollow Diamond", aspectRatio: 1, cells: gridMask(["..1..", ".1.1.", "1.1.1", ".1.1.", "..1.."]) },
  { id: "shapes-11", category: "shapes", name: "Shape Thick Plus", aspectRatio: 1, cells: gridMask(["..11..", "..11..", "111111", "111111", "..11..", "..11.."]) },
  { id: "shapes-12", category: "shapes", name: "Shape Hourglass", aspectRatio: 1, cells: gridMask(["111111", ".1111.", "..11..", ".1111.", "111111"]) },
  { id: "shapes-13", category: "shapes", name: "Shape H-Frame", aspectRatio: 1, cells: gridMask(["1....1", "11..11", "111111", "111111", "11..11", "1....1"]) },

  // Instagram (30 presets)
  { id: "instagram-01", category: "instagram", name: "Instagram 2 Columns", aspectRatio: 1, cells: grid(2, 1) },
  { id: "instagram-02", category: "instagram", name: "Instagram 2×2", aspectRatio: 1, cells: grid(2, 2) },
  { id: "instagram-03", category: "instagram", name: "Instagram 3×4", aspectRatio: 1, cells: grid(3, 4) },
  { id: "instagram-04", category: "instagram", name: "Instagram 4×4", aspectRatio: 1, cells: grid(4, 4) },
  { id: "instagram-05", category: "instagram", name: "Instagram 6×6", aspectRatio: 1, cells: grid(6, 6) },
  { id: "instagram-06", category: "instagram", name: "Instagram 3 Rows", aspectRatio: 1.45, cells: grid(1, 3) },
  { id: "instagram-07", category: "instagram", name: "Instagram Top + 2 Bottom", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 1, h: 0.48 }, { x: 0, y: 0.48, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.48, w: 0.5, h: 0.52 }] },
  { id: "instagram-08", category: "instagram", name: "Instagram 2 Cols + Split Right", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.62 }, { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38 }] },
  { id: "instagram-09", category: "instagram", name: "Instagram Split Middle", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.55 }, { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 }] },
  { id: "instagram-10", category: "instagram", name: "Instagram Left Pillar + 3", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.35, h: 1 }, { x: 0.35, y: 0, w: 0.325, h: 0.46 }, { x: 0.675, y: 0, w: 0.325, h: 0.46 }, { x: 0.35, y: 0.46, w: 0.65, h: 0.54 }] },
  { id: "instagram-11", category: "instagram", name: "Instagram Bottom Banner", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.5, h: 0.55 }, { x: 0.5, y: 0, w: 0.5, h: 0.275 }, { x: 0.5, y: 0.275, w: 0.5, h: 0.275 }, { x: 0, y: 0.55, w: 1, h: 0.45 }] },
  { id: "instagram-12", category: "instagram", name: "Instagram Staggered Quad", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.55, h: 0.55 }, { x: 0, y: 0.55, w: 0.55, h: 0.45 }, { x: 0.55, y: 0, w: 0.45, h: 0.36 }, { x: 0.55, y: 0.36, w: 0.45, h: 0.64 }] },
  { id: "instagram-13", category: "instagram", name: "Instagram Offset Quad", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.38, h: 0.52 }, { x: 0.38, y: 0, w: 0.62, h: 0.52 }, { x: 0, y: 0.52, w: 0.62, h: 0.48 }, { x: 0.62, y: 0.52, w: 0.38, h: 0.48 }] },
  { id: "instagram-14", category: "instagram", name: "Instagram 2 Pillars + 3 Stack", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.44, h: 1 }, { x: 0.44, y: 0, w: 0.3, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.74, y: i / 3, w: 0.26, h: 1 / 3 }))] },
  { id: "instagram-15", category: "instagram", name: "Instagram Center 3 Stack", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.34, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.34, y: i / 3, w: 0.33, h: 1 / 3 })), { x: 0.67, y: 0, w: 0.33, h: 1 }] },
  { id: "instagram-16", category: "instagram", name: "Instagram 3 Top + 2 Bottom", aspectRatio: 1.45, cells: [...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 0.48 })), { x: 0, y: 0.48, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.48, w: 0.5, h: 0.52 }] },
  { id: "instagram-17", category: "instagram", name: "Instagram 2 Left + 3 Right", aspectRatio: 1.45, cells: [{ x: 0, y: 0, w: 0.48, h: 0.5 }, { x: 0, y: 0.5, w: 0.48, h: 0.5 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.48, y: i / 3, w: 0.52, h: 1 / 3 }))] },
  {
    id: "instagram-18", category: "instagram", name: "Instagram Split Duo", aspectRatio: 1.45,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.55 }, { x: 0.5, y: 0, w: 0.25, h: 0.45 }, { x: 0.75, y: 0, w: 0.25, h: 0.45 },
      { x: 0, y: 0.55, w: 0.25, h: 0.45 }, { x: 0.25, y: 0.55, w: 0.25, h: 0.45 }, { x: 0.5, y: 0.45, w: 0.5, h: 0.55 },
    ],
  },
  { id: "instagram-19", category: "instagram", name: "Instagram 2×3 Grid + Hero", aspectRatio: 1.45, cells: [...Array.from({ length: 3 }, (_, r) => [{ x: 0, y: r / 3, w: 0.32, h: 1 / 3 }, { x: 0.32, y: r / 3, w: 0.32, h: 1 / 3 }]).flat(), { x: 0.64, y: 0, w: 0.36, h: 1 }] },
  {
    id: "instagram-20", category: "instagram", name: "Instagram Offset 6", aspectRatio: 1.45,
    cells: [
      { x: 0, y: 0, w: 0.28, h: 0.44 }, { x: 0.28, y: 0, w: 0.44, h: 0.44 }, { x: 0.72, y: 0, w: 0.28, h: 0.44 },
      { x: 0, y: 0.44, w: 0.5, h: 0.56 }, { x: 0.5, y: 0.44, w: 0.28, h: 0.56 }, { x: 0.78, y: 0.44, w: 0.22, h: 0.56 },
    ],
  },
  { id: "instagram-21", category: "instagram", name: "Instagram 3 Top + Hero", aspectRatio: 1, cells: [{ x: 0, y: 0, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.34 }, { x: 0, y: 0.34, w: 1, h: 0.66 }] },
  { id: "instagram-22", category: "instagram", name: "Instagram Hero + 3 Bottom", aspectRatio: 1, cells: [{ x: 0, y: 0, w: 1, h: 0.66 }, { x: 0, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 1 / 3, y: 0.66, w: 1 / 3, h: 0.34 }, { x: 2 / 3, y: 0.66, w: 1 / 3, h: 0.34 }] },
  { id: "instagram-23", category: "instagram", name: "Instagram 3 Left + Hero", aspectRatio: 1, cells: [{ x: 0, y: 0, w: 0.34, h: 1 / 3 }, { x: 0, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0, y: 2 / 3, w: 0.34, h: 1 / 3 }, { x: 0.34, y: 0, w: 0.66, h: 1 }] },
  { id: "instagram-24", category: "instagram", name: "Instagram Hero + 3 Right", aspectRatio: 1, cells: [{ x: 0, y: 0, w: 0.66, h: 1 }, { x: 0.66, y: 0, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 1 / 3, w: 0.34, h: 1 / 3 }, { x: 0.66, y: 2 / 3, w: 0.34, h: 1 / 3 }] },
  {
    id: "instagram-25", category: "instagram", name: "Instagram Top-Right L-Wrap", aspectRatio: 1,
    cells: [{ x: 0.24, y: 0, w: 0.76, h: 0.75 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: i * 0.25, w: 0.24, h: 0.25 })), ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 }))],
  },
  {
    id: "instagram-26", category: "instagram", name: "Instagram Bottom-Right L-Wrap", aspectRatio: 1,
    cells: [{ x: 0.24, y: 0.24, w: 0.76, h: 0.76 }, ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })), ...Array.from({ length: 3 }, (_, i) => ({ x: 0, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 }))],
  },
  {
    id: "instagram-27", category: "instagram", name: "Instagram Top-Left L-Wrap", aspectRatio: 1,
    cells: [{ x: 0, y: 0, w: 0.76, h: 0.75 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i * 0.25, w: 0.24, h: 0.25 })), ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 }))],
  },
  {
    id: "instagram-28", category: "instagram", name: "Instagram Bottom-Left L-Wrap", aspectRatio: 1,
    cells: [{ x: 0, y: 0.24, w: 0.76, h: 0.76 }, ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.24 })), ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: 0.24 + i * (0.76 / 3), w: 0.24, h: 0.76 / 3 }))],
  },
  {
    id: "instagram-29", category: "instagram", name: "Instagram 9-Box Enlarged Center", aspectRatio: 1,
    cells: enlargedCenterGrid3x3(),
  },
  { id: "instagram-30", category: "instagram", name: "Instagram Hero + 4 Bottom", aspectRatio: 1.35, cells: [{ x: 0, y: 0, w: 1, h: 0.72 }, ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.72, w: 0.25, h: 0.28 }))] },
  { id: "instagram-31", category: "instagram", name: "Instagram 4 Top + Hero", aspectRatio: 1.35, cells: [...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.28 })), { x: 0, y: 0.28, w: 1, h: 0.72 }] },
  {
    id: "instagram-32", category: "instagram", name: "Instagram Center Spotlight", aspectRatio: 1.35,
    cells: [
      { x: 0.24, y: 0.26, w: 0.52, h: 0.48 },
      { x: 0, y: 0, w: 0.5, h: 0.26 }, { x: 0.5, y: 0, w: 0.5, h: 0.26 },
      { x: 0, y: 0.26, w: 0.24, h: 0.16 }, { x: 0, y: 0.42, w: 0.24, h: 0.16 }, { x: 0, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0.76, y: 0.26, w: 0.24, h: 0.16 }, { x: 0.76, y: 0.42, w: 0.24, h: 0.16 }, { x: 0.76, y: 0.58, w: 0.24, h: 0.16 },
      { x: 0, y: 0.74, w: 0.5, h: 0.26 }, { x: 0.5, y: 0.74, w: 0.5, h: 0.26 },
    ],
  },
  {
    id: "instagram-33", category: "instagram", name: "Instagram 4×4 Surround", aspectRatio: 1.35,
    cells: [
      { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.25 })),
      { x: 0, y: 0.25, w: 0.25, h: 0.25 }, { x: 0, y: 0.5, w: 0.25, h: 0.25 },
      { x: 0.75, y: 0.25, w: 0.25, h: 0.25 }, { x: 0.75, y: 0.5, w: 0.25, h: 0.25 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.75, w: 0.25, h: 0.25 })),
    ],
  },

  // Facebook Cover (27 presets)
  { id: "facebook-cover-01", category: "facebook-cover", name: "Facebook Cover 2 Cols", aspectRatio: 2.65, cells: [{ x: 0, y: 0, w: 0.28, h: 1 }, { x: 0.28, y: 0, w: 0.72, h: 1 }] },
  {
    id: "facebook-cover-02", category: "facebook-cover", name: "Facebook Cover Cascade", aspectRatio: 2.65,
    cells: [
      ...Array.from({ length: 6 }, (_, i) => ({ x: i * 0.08, y: 0, w: 0.08, h: 0.55 + i * 0.07 })),
      { x: 0.48, y: 0, w: 0.52, h: 1 },
    ],
  },
  {
    id: "facebook-cover-03", category: "facebook-cover", name: "Facebook Cover Left Trio + Hero", aspectRatio: 2.65,
    cells: [{ x: 0, y: 0, w: 0.42, h: 0.56 }, { x: 0, y: 0.56, w: 0.21, h: 0.44 }, { x: 0.21, y: 0.56, w: 0.21, h: 0.44 }, { x: 0.42, y: 0, w: 0.58, h: 1 }],
  },
  {
    id: "facebook-cover-04", category: "facebook-cover", name: "Facebook Cover Panorama + 3 Right", aspectRatio: 2.65,
    cells: [{ x: 0, y: 0, w: 0.24, h: 1 }, { x: 0.24, y: 0, w: 0.52, h: 1 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i / 3, w: 0.24, h: 1 / 3 }))],
  },
  {
    id: "facebook-cover-05", category: "facebook-cover", name: "Facebook Cover Split Center", aspectRatio: 2.65,
    cells: [{ x: 0, y: 0, w: 0.36, h: 1 }, { x: 0.36, y: 0, w: 0.28, h: 0.5 }, { x: 0.36, y: 0.5, w: 0.28, h: 0.5 }, { x: 0.64, y: 0, w: 0.36, h: 1 }],
  },
  { id: "facebook-cover-06", category: "facebook-cover", name: "Facebook Cover 5 Columns", aspectRatio: 2.65, cells: grid(5, 1) },
  {
    id: "facebook-cover-07", category: "facebook-cover", name: "Facebook Cover Hero Right + 4", aspectRatio: 2.65,
    cells: [{ x: 0, y: 0, w: 0.32, h: 0.58 }, { x: 0.32, y: 0, w: 0.18, h: 0.58 }, { x: 0, y: 0.58, w: 0.22, h: 0.42 }, { x: 0.22, y: 0.58, w: 0.28, h: 0.42 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  },
  {
    id: "facebook-cover-08", category: "facebook-cover", name: "Facebook Cover Wing Spotlight", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.12, h: 0.5 }, { x: 0.12, y: 0, w: 0.12, h: 0.5 }, { x: 0, y: 0.5, w: 0.12, h: 0.5 }, { x: 0.12, y: 0.5, w: 0.12, h: 0.5 },
      { x: 0.24, y: 0, w: 0.52, h: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.76, y: i / 3, w: 0.24, h: 1 / 3 })),
    ],
  },
  {
    id: "facebook-cover-09", category: "facebook-cover", name: "Facebook Cover Asymmetric 6", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.25, h: 1 }, { x: 0.25, y: 0, w: 0.25, h: 1 },
      { x: 0.5, y: 0, w: 0.28, h: 0.55 }, { x: 0.78, y: 0, w: 0.22, h: 0.55 },
      { x: 0.5, y: 0.55, w: 0.22, h: 0.45 }, { x: 0.72, y: 0.55, w: 0.28, h: 0.45 },
    ],
  },
  {
    id: "facebook-cover-10", category: "facebook-cover", name: "Facebook Cover Hero + 4 Right", aspectRatio: 2.65,
    cells: [{ x: 0, y: 0, w: 0.24, h: 1 }, { x: 0.24, y: 0, w: 0.58, h: 1 }, ...Array.from({ length: 4 }, (_, i) => ({ x: 0.82, y: i * 0.25, w: 0.18, h: 0.25 }))],
  },
  {
    id: "facebook-cover-11", category: "facebook-cover", name: "Facebook Cover Editorial 7", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.2, h: 1 }, { x: 0.2, y: 0, w: 0.44, h: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({ x: 0.64, y: i / 3, w: 0.18, h: 1 / 3 })),
      { x: 0.82, y: 0, w: 0.18, h: 0.5 }, { x: 0.82, y: 0.5, w: 0.18, h: 0.5 },
    ],
  },
  {
    id: "facebook-cover-12", category: "facebook-cover", name: "Facebook Cover Top Trio + Hero", aspectRatio: 2.65,
    cells: [
      ...Array.from({ length: 3 }, (_, i) => ({ x: i * 0.12, y: 0, w: 0.12, h: 0.36 })),
      { x: 0, y: 0.36, w: 0.36, h: 0.64 }, { x: 0.36, y: 0, w: 0.46, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.82, y: i * 0.25, w: 0.18, h: 0.25 })),
    ],
  },
  {
    id: "facebook-cover-13", category: "facebook-cover", name: "Facebook Cover 7 Alternating", aspectRatio: 2.65,
    cells: Array.from({ length: 7 }, (_, c) => c % 2 === 0
      ? [{ x: c / 7, y: 0, w: 1 / 7, h: 0.5 }, { x: c / 7, y: 0.5, w: 1 / 7, h: 0.5 }]
      : [{ x: c / 7, y: 0, w: 1 / 7, h: 1 }]).flat(),
  },
  {
    id: "facebook-cover-14", category: "facebook-cover", name: "Facebook Cover Mosaic 11", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.2, h: 0.58 }, { x: 0.2, y: 0, w: 0.3, h: 0.58 }, { x: 0.5, y: 0, w: 0.22, h: 0.58 }, { x: 0.72, y: 0, w: 0.28, h: 0.36 },
      { x: 0, y: 0.58, w: 0.18, h: 0.42 }, { x: 0.18, y: 0.58, w: 0.18, h: 0.42 }, { x: 0.36, y: 0.58, w: 0.18, h: 0.42 }, { x: 0.54, y: 0.58, w: 0.18, h: 0.42 },
      { x: 0.72, y: 0.36, w: 0.14, h: 0.64 }, { x: 0.86, y: 0.36, w: 0.14, h: 0.32 }, { x: 0.86, y: 0.68, w: 0.14, h: 0.32 },
    ],
  },
  {
    id: "facebook-cover-15", category: "facebook-cover", name: "Facebook Cover 3 Top + 7 Bottom", aspectRatio: 2.65,
    cells: [...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 0.58 })), ...Array.from({ length: 7 }, (_, i) => ({ x: i / 7, y: 0.58, w: 1 / 7, h: 0.42 }))],
  },
  {
    id: "facebook-cover-16", category: "facebook-cover", name: "Facebook Cover Pillars", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.22, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.22, y: i * 0.25, w: 0.12, h: 0.25 })),
      { x: 0.34, y: 0, w: 0.32, h: 1 },
      ...Array.from({ length: 4 }, (_, i) => ({ x: 0.66, y: i * 0.25, w: 0.12, h: 0.25 })),
      { x: 0.78, y: 0, w: 0.22, h: 1 },
    ],
  },
  {
    id: "facebook-cover-17", category: "facebook-cover", name: "Facebook Cover Asymmetric 7", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.32, h: 0.55 }, { x: 0, y: 0.55, w: 0.48, h: 0.45 },
      { x: 0.32, y: 0, w: 0.36, h: 0.55 }, { x: 0.48, y: 0.55, w: 0.26, h: 0.45 },
      { x: 0.68, y: 0, w: 0.16, h: 0.55 }, { x: 0.84, y: 0, w: 0.16, h: 0.55 },
      { x: 0.74, y: 0.55, w: 0.26, h: 0.45 },
    ],
  },
  { id: "facebook-cover-18", category: "facebook-cover", name: "Facebook Cover 9×3", aspectRatio: 2.65, cells: grid(9, 3) },
  { id: "facebook-cover-19", category: "facebook-cover", name: "Facebook Cover 10×4", aspectRatio: 2.65, cells: grid(10, 4) },
  {
    id: "facebook-cover-20", category: "facebook-cover", name: "Facebook Cover 4-Col Nested", aspectRatio: 2.65,
    cells: Array.from({ length: 4 }, (_, c) => {
      const x = c * 0.25;
      const topSmall = c % 2 === 0;
      const smallY = topSmall ? 0 : 0.5;
      const bigY = topSmall ? 0.5 : 0;
      return [
        { x, y: smallY, w: 0.125, h: 0.25 }, { x: x + 0.125, y: smallY, w: 0.125, h: 0.25 },
        { x, y: smallY + 0.25, w: 0.125, h: 0.25 }, { x: x + 0.125, y: smallY + 0.25, w: 0.125, h: 0.25 },
        { x, y: bigY, w: 0.25, h: 0.5 },
      ];
    }).flat(),
  },
  { id: "facebook-cover-21", category: "facebook-cover", name: "Facebook Cover 6×2", aspectRatio: 2.65, cells: grid(6, 2) },
  {
    id: "facebook-cover-22", category: "facebook-cover", name: "Facebook Cover 6 Staggered", aspectRatio: 2.65,
    cells: Array.from({ length: 6 }, (_, c) => {
      const split = c % 2 === 0 ? 0.62 : 0.38;
      return [{ x: c / 6, y: 0, w: 1 / 6, h: split }, { x: c / 6, y: split, w: 1 / 6, h: 1 - split }];
    }).flat(),
  },
  {
    id: "facebook-cover-23", category: "facebook-cover", name: "Facebook Cover Brick 11", aspectRatio: 2.65,
    cells: [...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0, w: 1 / 6, h: 0.5 })), ...Array.from({ length: 5 }, (_, i) => ({ x: i / 5, y: 0.5, w: 1 / 5, h: 0.5 }))],
  },
  {
    id: "facebook-cover-24", category: "facebook-cover", name: "Facebook Cover 4 Top + 4 Tall", aspectRatio: 2.65,
    cells: [...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 0.34 })), ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0.34, w: 0.25, h: 0.66 }))],
  },
  {
    id: "facebook-cover-25", category: "facebook-cover", name: "Facebook Cover Trio Showcase", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 1 / 9, h: 0.35 }, { x: 1 / 9, y: 0, w: 1 / 9, h: 0.35 }, { x: 2 / 9, y: 0, w: 1 / 9, h: 0.35 },
      { x: 0, y: 0.35, w: 1 / 3, h: 0.65 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.65 },
      { x: 1 / 3, y: 0.65, w: 1 / 9, h: 0.35 }, { x: 4 / 9, y: 0.65, w: 1 / 9, h: 0.35 }, { x: 5 / 9, y: 0.65, w: 1 / 9, h: 0.35 },
      { x: 2 / 3, y: 0, w: 1 / 9, h: 0.35 }, { x: 7 / 9, y: 0, w: 1 / 9, h: 0.35 }, { x: 8 / 9, y: 0, w: 1 / 9, h: 0.35 },
      { x: 2 / 3, y: 0.35, w: 1 / 3, h: 0.65 },
    ],
  },
  {
    id: "facebook-cover-26", category: "facebook-cover", name: "Facebook Cover Center 3×3", aspectRatio: 2.65,
    cells: [
      { x: 0, y: 0, w: 0.24, h: 1 },
      ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({ x: 0.24 + c * (0.52 / 3), y: r / 3, w: 0.52 / 3, h: 1 / 3 }))).flat(),
      { x: 0.76, y: 0, w: 0.24, h: 1 },
    ],
  },
  {
    id: "facebook-cover-27", category: "facebook-cover", name: "Facebook Cover Brick Wall", aspectRatio: 2.65,
    cells: [
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 0, w: 0.25, h: 1 / 3 })),
      ...Array.from({ length: 5 }, (_, i) => ({ x: i * 0.2, y: 1 / 3, w: 0.2, h: 1 / 3 })),
      ...Array.from({ length: 4 }, (_, i) => ({ x: i * 0.25, y: 2 / 3, w: 0.25, h: 1 / 3 })),
    ],
  },

  // Pinterest (28 presets)
  {
    id: "pinterest-01", category: "pinterest", name: "Pinterest 2 Top + Hero", aspectRatio: 0.67,
    cells: [{ x: 0, y: 0, w: 0.68, h: 0.34 }, { x: 0.68, y: 0, w: 0.32, h: 0.34 }, { x: 0, y: 0.34, w: 1, h: 0.66 }],
  },
  {
    id: "pinterest-02", category: "pinterest", name: "Pinterest Hero + 3 Bottom", aspectRatio: 0.67,
    cells: [{ x: 0, y: 0, w: 1, h: 0.58 }, { x: 0, y: 0.58, w: 0.44, h: 0.21 }, { x: 0, y: 0.79, w: 0.44, h: 0.21 }, { x: 0.44, y: 0.58, w: 0.56, h: 0.42 }],
  },
  { id: "pinterest-03", category: "pinterest", name: "Pinterest 2×3", aspectRatio: 0.72, cells: grid(2, 3) },
  {
    id: "pinterest-04", category: "pinterest", name: "Pinterest Stacked 5", aspectRatio: 0.67,
    cells: [{ x: 0, y: 0, w: 0.55, h: 0.32 }, { x: 0.55, y: 0, w: 0.45, h: 0.32 }, { x: 0, y: 0.32, w: 1, h: 0.34 }, { x: 0, y: 0.66, w: 0.65, h: 0.34 }, { x: 0.65, y: 0.66, w: 0.35, h: 0.34 }],
  },
  {
    id: "pinterest-05", category: "pinterest", name: "Pinterest Split 7", aspectRatio: 0.67,
    cells: [
      { x: 0, y: 0, w: 0.25, h: 0.24 }, { x: 0.25, y: 0, w: 0.25, h: 0.24 }, { x: 0, y: 0.24, w: 0.5, h: 0.26 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.26 }, { x: 0.5, y: 0.76, w: 0.25, h: 0.24 }, { x: 0.75, y: 0.76, w: 0.25, h: 0.24 },
    ],
  },
  {
    id: "pinterest-06", category: "pinterest", name: "Pinterest Brick 5-Row", aspectRatio: 0.67,
    cells: [
      ...Array.from({ length: 2 }, (_, i) => ({ x: i * 0.5, y: 0, w: 0.5, h: 0.2 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0.2, w: 1 / 3, h: 0.2 })),
      ...Array.from({ length: 2 }, (_, i) => ({ x: i * 0.5, y: 0.4, w: 0.5, h: 0.2 })),
      ...Array.from({ length: 3 }, (_, i) => ({ x: i / 3, y: 0.6, w: 1 / 3, h: 0.2 })),
      ...Array.from({ length: 2 }, (_, i) => ({ x: i * 0.5, y: 0.8, w: 0.5, h: 0.2 })),
    ],
  },
  { id: "pinterest-07", category: "pinterest", name: "Pinterest 2×5", aspectRatio: 0.67, cells: grid(2, 5) },
  {
    id: "pinterest-08", category: "pinterest", name: "Pinterest 4×2 Top + Hero", aspectRatio: 0.67,
    cells: [...Array.from({ length: 2 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({ x: c * 0.25, y: r * 0.18, w: 0.25, h: 0.18 }))).flat(), { x: 0, y: 0.36, w: 1, h: 0.64 }],
  },
  { id: "pinterest-09", category: "pinterest", name: "Pinterest 3×5", aspectRatio: 0.67, cells: grid(3, 5) },
  { id: "pinterest-10", category: "pinterest", name: "Pinterest 2×4", aspectRatio: 0.55, cells: grid(2, 4) },
  {
    id: "pinterest-11", category: "pinterest", name: "Pinterest Narrow Mosaic", aspectRatio: 0.32,
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.14 }, { x: 0.5, y: 0, w: 0.5, h: 0.14 }, { x: 0, y: 0.14, w: 1, h: 0.14 },
      { x: 0, y: 0.28, w: 0.5, h: 0.18 }, { x: 0.5, y: 0.28, w: 0.5, h: 0.12 }, { x: 0.5, y: 0.4, w: 0.5, h: 0.16 },
      { x: 0, y: 0.46, w: 0.5, h: 0.1 }, { x: 0, y: 0.56, w: 1, h: 0.14 }, { x: 0, y: 0.7, w: 1, h: 0.14 },
      { x: 0, y: 0.84, w: 0.5, h: 0.16 }, { x: 0.5, y: 0.84, w: 0.5, h: 0.16 },
    ],
  },
  {
    id: "pinterest-12", category: "pinterest", name: "Pinterest Story 8", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.4, h: 0.36 }, { x: 0.4, y: 0, w: 0.6, h: 0.18 }, { x: 0.4, y: 0.18, w: 0.6, h: 0.18 },
      { x: 0, y: 0.36, w: 0.64, h: 0.36 }, { x: 0.64, y: 0.36, w: 0.36, h: 0.36 },
      { x: 0, y: 0.72, w: 0.36, h: 0.28 }, { x: 0.36, y: 0.72, w: 0.32, h: 0.28 }, { x: 0.68, y: 0.72, w: 0.32, h: 0.28 },
    ],
  },
  {
    id: "pinterest-13", category: "pinterest", name: "Pinterest Editorial 6", aspectRatio: 0.75,
    cells: [{ x: 0, y: 0, w: 1, h: 0.24 }, { x: 0, y: 0.24, w: 0.35, h: 0.24 }, { x: 0, y: 0.48, w: 0.35, h: 0.24 }, { x: 0.35, y: 0.24, w: 0.65, h: 0.48 }, { x: 0, y: 0.72, w: 0.58, h: 0.28 }, { x: 0.58, y: 0.72, w: 0.42, h: 0.28 }],
  },
  {
    id: "pinterest-14", category: "pinterest", name: "Pinterest Portrait Editorial", aspectRatio: 0.75,
    cells: [
      { x: 0, y: 0, w: 0.26, h: 0.22 }, { x: 0.26, y: 0, w: 0.32, h: 0.22 }, { x: 0.58, y: 0, w: 0.42, h: 0.22 },
      { x: 0, y: 0.22, w: 0.38, h: 0.38 }, { x: 0.38, y: 0.22, w: 0.31, h: 0.19 }, { x: 0.69, y: 0.22, w: 0.31, h: 0.19 }, { x: 0.38, y: 0.41, w: 0.62, h: 0.19 },
      { x: 0, y: 0.6, w: 0.25, h: 0.2 }, { x: 0, y: 0.8, w: 0.25, h: 0.2 }, { x: 0.25, y: 0.6, w: 0.5, h: 0.4 }, { x: 0.75, y: 0.6, w: 0.25, h: 0.2 }, { x: 0.75, y: 0.8, w: 0.25, h: 0.2 },
    ],
  },
  {
    id: "pinterest-15", category: "pinterest", name: "Pinterest 5 Top + 2 + 6", aspectRatio: 0.85,
    cells: [...Array.from({ length: 5 }, (_, i) => ({ x: i * 0.2, y: 0, w: 0.2, h: 0.24 })), { x: 0, y: 0.24, w: 0.5, h: 0.52 }, { x: 0.5, y: 0.24, w: 0.5, h: 0.52 }, ...Array.from({ length: 6 }, (_, i) => ({ x: i / 6, y: 0.76, w: 1 / 6, h: 0.24 }))],
  },
  {
    id: "pinterest-16", category: "pinterest", name: "Pinterest Asymmetric 5", aspectRatio: 0.75,
    cells: [{ x: 0, y: 0, w: 0.68, h: 0.28 }, { x: 0.68, y: 0, w: 0.32, h: 0.28 }, { x: 0, y: 0.28, w: 0.34, h: 0.38 }, { x: 0.34, y: 0.28, w: 0.66, h: 0.38 }, { x: 0, y: 0.66, w: 1, h: 0.34 }],
  },
  {
    id: "pinterest-17", category: "pinterest", name: "Pinterest Strip + 2×2 Top", aspectRatio: 0.28,
    cells: [{ x: 0, y: 0, w: 0.5, h: 0.14 }, { x: 0.5, y: 0, w: 0.5, h: 0.14 }, { x: 0, y: 0.14, w: 0.5, h: 0.14 }, { x: 0.5, y: 0.14, w: 0.5, h: 0.14 }, { x: 0, y: 0.28, w: 1, h: 0.24 }, { x: 0, y: 0.52, w: 1, h: 0.24 }, { x: 0, y: 0.76, w: 1, h: 0.24 }],
  },
  { id: "pinterest-18", category: "pinterest", name: "Pinterest 6 Strip", aspectRatio: 0.28, cells: grid(1, 6) },
  {
    id: "pinterest-19", category: "pinterest", name: "Pinterest Hero Top + 8", aspectRatio: 0.82,
    cells: [{ x: 0, y: 0, w: 1, h: 0.46 }, { x: 0, y: 0.46, w: 0.46, h: 0.27 }, { x: 0, y: 0.73, w: 0.46, h: 0.27 }, ...Array.from({ length: 3 }, (_, r) => [{ x: 0.46, y: 0.46 + r * 0.18, w: 0.27, h: 0.18 }, { x: 0.73, y: 0.46 + r * 0.18, w: 0.27, h: 0.18 }]).flat()],
  },
  {
    id: "pinterest-20", category: "pinterest", name: "Pinterest Center + Wings", aspectRatio: 0.82,
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.28 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.28 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.28 },
      { x: 0, y: 0.28, w: 1 / 3, h: 0.22 }, { x: 0, y: 0.5, w: 1 / 3, h: 0.22 }, { x: 1 / 3, y: 0.28, w: 1 / 3, h: 0.44 },
      { x: 2 / 3, y: 0.28, w: 1 / 3, h: 0.22 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.22 }, { x: 0, y: 0.72, w: 0.5, h: 0.28 }, { x: 0.5, y: 0.72, w: 0.5, h: 0.28 },
    ],
  },
  {
    id: "pinterest-21", category: "pinterest", name: "Pinterest Hero Left + Stack", aspectRatio: 0.82,
    cells: [{ x: 0, y: 0, w: 0.46, h: 0.7 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.46, y: i * (0.7 / 3), w: 0.54, h: 0.7 / 3 })), { x: 0, y: 0.7, w: 0.46, h: 0.3 }, { x: 0.46, y: 0.7, w: 0.54, h: 0.3 }],
  },
  {
    id: "pinterest-22", category: "pinterest", name: "Pinterest Split + 2 Banners", aspectRatio: 0.72,
    cells: [{ x: 0, y: 0, w: 0.44, h: 0.46 }, { x: 0.44, y: 0, w: 0.56, h: 0.23 }, { x: 0.44, y: 0.23, w: 0.56, h: 0.23 }, { x: 0, y: 0.46, w: 1, h: 0.27 }, { x: 0, y: 0.73, w: 1, h: 0.27 }],
  },
  {
    id: "pinterest-23", category: "pinterest", name: "Pinterest Top Banner + 6", aspectRatio: 0.72,
    cells: [{ x: 0, y: 0, w: 1, h: 0.28 }, ...Array.from({ length: 3 }, (_, r) => [{ x: 0, y: 0.28 + r * 0.24, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.28 + r * 0.24, w: 0.5, h: 0.24 }]).flat()],
  },
  {
    id: "pinterest-24", category: "pinterest", name: "Pinterest Editorial 7", aspectRatio: 0.75,
    cells: [{ x: 0, y: 0, w: 0.5, h: 0.25 }, { x: 0.5, y: 0, w: 0.5, h: 0.25 }, { x: 0, y: 0.25, w: 1, h: 0.27 }, { x: 0, y: 0.52, w: 0.62, h: 0.24 }, { x: 0.62, y: 0.52, w: 0.38, h: 0.24 }, { x: 0, y: 0.76, w: 0.5, h: 0.24 }, { x: 0.5, y: 0.76, w: 0.5, h: 0.24 }],
  },
  {
    id: "pinterest-25", category: "pinterest", name: "Pinterest Pillar + 5", aspectRatio: 0.85,
    cells: [{ x: 0, y: 0, w: 0.44, h: 1 }, { x: 0.44, y: 0, w: 0.56, h: 0.36 }, { x: 0.44, y: 0.36, w: 0.28, h: 0.36 }, { x: 0.72, y: 0.36, w: 0.28, h: 0.36 }, { x: 0.44, y: 0.72, w: 0.28, h: 0.28 }, { x: 0.72, y: 0.72, w: 0.28, h: 0.28 }],
  },
  {
    id: "pinterest-26", category: "pinterest", name: "Pinterest Hero Top + 6", aspectRatio: 0.88,
    cells: [{ x: 0, y: 0, w: 1, h: 0.45 }, { x: 0, y: 0.45, w: 0.46, h: 0.55 }, { x: 0.46, y: 0.45, w: 0.27, h: 0.183 }, { x: 0.46, y: 0.633, w: 0.27, h: 0.183 }, { x: 0.46, y: 0.816, w: 0.27, h: 0.184 }, { x: 0.73, y: 0.45, w: 0.27, h: 0.275 }, { x: 0.73, y: 0.725, w: 0.27, h: 0.275 }],
  },
  {
    id: "pinterest-27", category: "pinterest", name: "Pinterest Mosaic 9", aspectRatio: 0.75,
    cells: [{ x: 0, y: 0, w: 0.55, h: 0.32 }, { x: 0.55, y: 0, w: 0.45, h: 0.32 }, { x: 0, y: 0.32, w: 0.28, h: 0.34 }, { x: 0.28, y: 0.32, w: 0.36, h: 0.34 }, { x: 0.64, y: 0.32, w: 0.36, h: 0.34 }, { x: 0, y: 0.66, w: 0.52, h: 0.34 }, { x: 0.52, y: 0.66, w: 0.48, h: 0.17 }, { x: 0.52, y: 0.83, w: 0.24, h: 0.17 }, { x: 0.76, y: 0.83, w: 0.24, h: 0.17 }],
  },
  {
    id: "pinterest-28", category: "pinterest", name: "Pinterest 3-Col Asymmetric", aspectRatio: 0.75,
    cells: [{ x: 0, y: 0, w: 0.44, h: 0.48 }, { x: 0, y: 0.48, w: 0.44, h: 0.52 }, ...Array.from({ length: 3 }, (_, i) => ({ x: 0.44, y: i / 3, w: 0.28, h: 1 / 3 })), ...Array.from({ length: 3 }, (_, i) => ({ x: 0.72, y: i / 3, w: 0.28, h: 1 / 3 }))],
  },

];

export function findCollagePreset(id: string | undefined): CollagePreset | undefined {
  if (!id) return undefined;
  return COLLAGE_PRESETS.find((preset) => preset.id === id);
}

export function presetsForCategory(category: CollagePresetCategory): CollagePreset[] {
  return COLLAGE_PRESETS.filter((preset) => preset.category === category);
}

export function normalizedCellsToRects(cells: NormalizedCell[], width: number, height: number, gap: number) {
  const safeGap = Math.max(0, gap);
  const halfGap = safeGap / 2;
  const innerW = Math.max(1, width - safeGap);
  const innerH = Math.max(1, height - safeGap);
  return cells.map((cell) => {
    const x = halfGap + cell.x * innerW + halfGap;
    const y = halfGap + cell.y * innerH + halfGap;
    const w = Math.max(1, cell.w * innerW - safeGap);
    const h = Math.max(1, cell.h * innerH - safeGap);
    return { x, y, width: w, height: h };
  });
}

export function presetCellsToRects(preset: CollagePreset, width: number, height: number, gap: number) {
  return normalizedCellsToRects(preset.cells, width, height, gap);
}

export function cellsToNormalized(
  rects: { x: number; y: number; width: number; height: number }[],
  width: number,
  height: number,
  gap: number,
): NormalizedCell[] {
  const safeGap = Math.max(0, gap);
  const innerW = Math.max(1, width - safeGap);
  const innerH = Math.max(1, height - safeGap);
  return rects.map((rect) => {
    const x = Math.max(0, Math.min(1, (rect.x - safeGap) / innerW));
    const y = Math.max(0, Math.min(1, (rect.y - safeGap) / innerH));
    const w = Math.max(0.01, Math.min(1 - x, (rect.width + safeGap) / innerW));
    const h = Math.max(0.01, Math.min(1 - y, (rect.height + safeGap) / innerH));
    return { x, y, w, h };
  });
}

export interface GapDivider {
  id: string;
  orientation: "vertical" | "horizontal";
  pos: number;
  spanStart: number;
  spanEnd: number;
  minPos: number;
  maxPos: number;
  beforeIndices: number[];
  afterIndices: number[];
}

export function detectGapDividers(cells: NormalizedCell[]): GapDivider[] {
  const EPS = 0.004;
  const MIN_CELL = 0.08;
  const dividers: GapDivider[] = [];

  const uniquePositions = (values: number[]) => {
    const sorted = [...values].filter((v) => v > 0.01 && v < 0.99).sort((a, b) => a - b);
    const result: number[] = [];
    for (const value of sorted) {
      if (!result.length || Math.abs(result[result.length - 1] - value) > EPS) result.push(value);
    }
    return result;
  };

  for (const pos of uniquePositions(cells.flatMap((cell) => [cell.x, cell.x + cell.w]))) {
    const beforeIndices: number[] = [];
    const afterIndices: number[] = [];
    cells.forEach((cell, index) => {
      if (Math.abs(cell.x + cell.w - pos) <= EPS) beforeIndices.push(index);
      if (Math.abs(cell.x - pos) <= EPS) afterIndices.push(index);
    });
    if (!beforeIndices.length || !afterIndices.length) continue;
    const spanStart = Math.max(
      Math.min(...beforeIndices.map((i) => cells[i].y)),
      Math.min(...afterIndices.map((i) => cells[i].y)),
    );
    const spanEnd = Math.min(
      Math.max(...beforeIndices.map((i) => cells[i].y + cells[i].h)),
      Math.max(...afterIndices.map((i) => cells[i].y + cells[i].h)),
    );
    if (spanEnd - spanStart <= 0.02) continue;
    const minPos = Math.max(...beforeIndices.map((i) => cells[i].x));
    const maxPos = Math.min(...afterIndices.map((i) => cells[i].x + cells[i].w));
    if (maxPos - minPos < MIN_CELL * 2) continue;
    dividers.push({
      id: `v-${Math.round(pos * 1000)}`,
      orientation: "vertical",
      pos,
      spanStart,
      spanEnd,
      minPos,
      maxPos,
      beforeIndices,
      afterIndices,
    });
  }

  for (const pos of uniquePositions(cells.flatMap((cell) => [cell.y, cell.y + cell.h]))) {
    const beforeIndices: number[] = [];
    const afterIndices: number[] = [];
    cells.forEach((cell, index) => {
      if (Math.abs(cell.y + cell.h - pos) <= EPS) beforeIndices.push(index);
      if (Math.abs(cell.y - pos) <= EPS) afterIndices.push(index);
    });
    if (!beforeIndices.length || !afterIndices.length) continue;
    const spanStart = Math.max(
      Math.min(...beforeIndices.map((i) => cells[i].x)),
      Math.min(...afterIndices.map((i) => cells[i].x)),
    );
    const spanEnd = Math.min(
      Math.max(...beforeIndices.map((i) => cells[i].x + cells[i].w)),
      Math.max(...afterIndices.map((i) => cells[i].x + cells[i].w)),
    );
    if (spanEnd - spanStart <= 0.02) continue;
    const minPos = Math.max(...beforeIndices.map((i) => cells[i].y));
    const maxPos = Math.min(...afterIndices.map((i) => cells[i].y + cells[i].h));
    if (maxPos - minPos < MIN_CELL * 2) continue;
    dividers.push({
      id: `h-${Math.round(pos * 1000)}`,
      orientation: "horizontal",
      pos,
      spanStart,
      spanEnd,
      minPos,
      maxPos,
      beforeIndices,
      afterIndices,
    });
  }

  return dividers;
}

export function applyGapDividerDrag(cells: NormalizedCell[], divider: GapDivider, nextPos: number): NormalizedCell[] {
  const MIN_CELL = 0.08;
  const clamped = Math.max(divider.minPos + MIN_CELL, Math.min(divider.maxPos - MIN_CELL, nextPos));
  const beforeSet = new Set(divider.beforeIndices);
  const afterSet = new Set(divider.afterIndices);
  return cells.map((cell, index) => {
    if (divider.orientation === "vertical") {
      if (beforeSet.has(index)) return { ...cell, w: clamped - cell.x };
      if (afterSet.has(index)) return { ...cell, x: clamped, w: cell.x + cell.w - clamped };
      return cell;
    }
    if (beforeSet.has(index)) return { ...cell, h: clamped - cell.y };
    if (afterSet.has(index)) return { ...cell, y: clamped, h: cell.y + cell.h - clamped };
    return cell;
  });
}

export interface OverlappingEdgeHandle {
  id: string;
  cellIndex: number;
  edge: "left" | "right" | "top" | "bottom";
  orientation: "vertical" | "horizontal";
  pos: number;
  spanStart: number;
  spanEnd: number;
  minPos: number;
  maxPos: number;
}

export function detectOverlappingCellEdges(cells: NormalizedCell[]): OverlappingEdgeHandle[] {
  const EPS = 0.004;
  const MIN_CELL = 0.08;
  const handles: OverlappingEdgeHandle[] = [];
  cells.forEach((cell, cellIndex) => {
    const overlapsEarlier = cells.slice(0, cellIndex).some(
      (other) =>
        other.x < cell.x + cell.w - EPS &&
        other.x + other.w > cell.x + EPS &&
        other.y < cell.y + cell.h - EPS &&
        other.y + other.h > cell.y + EPS,
    );
    if (!overlapsEarlier) return;
    if (cell.x > 0.01) {
      handles.push({
        id: `ov-${cellIndex}-left`,
        cellIndex,
        edge: "left",
        orientation: "vertical",
        pos: cell.x,
        spanStart: cell.y,
        spanEnd: cell.y + cell.h,
        minPos: 0,
        maxPos: cell.x + cell.w - MIN_CELL,
      });
    }
    if (cell.x + cell.w < 0.99) {
      handles.push({
        id: `ov-${cellIndex}-right`,
        cellIndex,
        edge: "right",
        orientation: "vertical",
        pos: cell.x + cell.w,
        spanStart: cell.y,
        spanEnd: cell.y + cell.h,
        minPos: cell.x + MIN_CELL,
        maxPos: 1,
      });
    }
    if (cell.y > 0.01) {
      handles.push({
        id: `ov-${cellIndex}-top`,
        cellIndex,
        edge: "top",
        orientation: "horizontal",
        pos: cell.y,
        spanStart: cell.x,
        spanEnd: cell.x + cell.w,
        minPos: 0,
        maxPos: cell.y + cell.h - MIN_CELL,
      });
    }
    if (cell.y + cell.h < 0.99) {
      handles.push({
        id: `ov-${cellIndex}-bottom`,
        cellIndex,
        edge: "bottom",
        orientation: "horizontal",
        pos: cell.y + cell.h,
        spanStart: cell.x,
        spanEnd: cell.x + cell.w,
        minPos: cell.y + MIN_CELL,
        maxPos: 1,
      });
    }
  });
  return handles;
}

export function applyOverlappingEdgeDrag(
  cells: NormalizedCell[],
  handle: OverlappingEdgeHandle,
  nextPos: number,
): NormalizedCell[] {
  const clamped = Math.max(handle.minPos, Math.min(handle.maxPos, nextPos));
  return cells.map((cell, index) => {
    if (index !== handle.cellIndex) return cell;
    if (handle.edge === "left") return { ...cell, x: clamped, w: cell.x + cell.w - clamped };
    if (handle.edge === "right") return { ...cell, w: clamped - cell.x };
    if (handle.edge === "top") return { ...cell, y: clamped, h: cell.y + cell.h - clamped };
    return { ...cell, h: clamped - cell.y };
  });
}

export function deleteCellWithAutoResize(
  cells: NormalizedCell[],
  deleteIndex: number,
  autoResize = true,
): NormalizedCell[] {
  if (cells.length <= 1 || deleteIndex < 0 || deleteIndex >= cells.length) return cells;
  const target = cells[deleteIndex];
  const remaining = cells.filter((_, index) => index !== deleteIndex);
  if (!autoResize) return remaining;

  const EPS = 0.008;
  const approx = (a: number, b: number) => Math.abs(a - b) <= EPS;
  const sumWidth = (list: NormalizedCell[]) => list.reduce((sum, c) => sum + c.w, 0);
  const sumHeight = (list: NormalizedCell[]) => list.reduce((sum, c) => sum + c.h, 0);

  const above = remaining.filter(
    (c) => approx(c.y + c.h, target.y) && c.x >= target.x - EPS && c.x + c.w <= target.x + target.w + EPS,
  );
  const below = remaining.filter(
    (c) => approx(c.y, target.y + target.h) && c.x >= target.x - EPS && c.x + c.w <= target.x + target.w + EPS,
  );
  const left = remaining.filter(
    (c) => approx(c.x + c.w, target.x) && c.y >= target.y - EPS && c.y + c.h <= target.y + target.h + EPS,
  );
  const right = remaining.filter(
    (c) => approx(c.x, target.x + target.w) && c.y >= target.y - EPS && c.y + c.h <= target.y + target.h + EPS,
  );

  const aboveOk = above.length > 0 && approx(sumWidth(above), target.w);
  const belowOk = below.length > 0 && approx(sumWidth(below), target.w);
  const leftOk = left.length > 0 && approx(sumHeight(left), target.h);
  const rightOk = right.length > 0 && approx(sumHeight(right), target.h);

  const canVertical = aboveOk || belowOk;
  const canHorizontal = leftOk || rightOk;
  if (!canVertical && !canHorizontal) return remaining;

  const useVertical =
    canVertical &&
    (!canHorizontal ||
      (aboveOk && belowOk && !(leftOk && rightOk)) ||
      (aboveOk && belowOk === (leftOk && rightOk) && target.h >= target.w));

  const updates = new Map<NormalizedCell, NormalizedCell>();
  if (useVertical) {
    if (aboveOk && belowOk) {
      const half = target.h / 2;
      above.forEach((c) => updates.set(c, { ...c, h: c.h + half }));
      below.forEach((c) => updates.set(c, { ...c, y: c.y - half, h: c.h + half }));
    } else if (aboveOk) {
      above.forEach((c) => updates.set(c, { ...c, h: c.h + target.h }));
    } else {
      below.forEach((c) => updates.set(c, { ...c, y: c.y - target.h, h: c.h + target.h }));
    }
  } else {
    if (leftOk && rightOk) {
      const half = target.w / 2;
      left.forEach((c) => updates.set(c, { ...c, w: c.w + half }));
      right.forEach((c) => updates.set(c, { ...c, x: c.x - half, w: c.w + half }));
    } else if (leftOk) {
      left.forEach((c) => updates.set(c, { ...c, w: c.w + target.w }));
    } else {
      right.forEach((c) => updates.set(c, { ...c, x: c.x - target.w, w: c.w + target.w }));
    }
  }

  return remaining.map((c) => updates.get(c) ?? c);
}
