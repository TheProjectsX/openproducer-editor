export const MAX_CANVAS_PIXELS = 100_000_000;
export const MAX_CANVAS_DIMENSION = 32_768;

export const BACKGROUND_SWATCHES = [
    { name: "Transparent", color: "transparent" },
    { name: "White", color: "#ffffff" },
    { name: "Black", color: "#000000" },
    { name: "Slate", color: "#111827" },
    { name: "Soft gray", color: "#e5e7eb" },
    { name: "Sky", color: "#dbeafe" },
    { name: "Cream", color: "#fef3c7" },
    { name: "Blush", color: "#fce7f3" },
] as const;

export const CANVAS_PRESETS = [
    { label: "1200 × 900", w: "1200", h: "900" },
    { label: "1080 × 1080", w: "1080", h: "1080" },
    { label: "1920 × 1080", w: "1920", h: "1080" },
    { label: "1080 × 1920", w: "1080", h: "1920" },
    { label: "1280 × 720 (YT)", w: "1280", h: "720" },
    { label: "2560 × 1440 (Banner)", w: "2560", h: "1440" },
] as const;

export const FONT_FAMILIES = [
    { label: "System Sans", value: "system-ui, sans-serif" },
    { label: "Inter", value: '"Inter", system-ui, sans-serif' },
    { label: "Ubuntu", value: '"Ubuntu", system-ui, sans-serif' },
    { label: "Georgia Serif", value: 'Georgia, "Times New Roman", serif' },
    { label: "Times Serif", value: '"Times New Roman", serif' },
    { label: "Trebuchet", value: '"Trebuchet MS", sans-serif' },
    { label: "Courier Mono", value: '"Courier New", monospace' },
    { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
] as const;

export const STICKER_PRESETS = [
    "⭐",
    "🔥",
    "✨",
    "❤️",
    "👍",
    "🎉",
    "🚀",
    "💡",
    "🎯",
    "🏆",
    "📌",
    "💬",
    "⚡",
    "🎵",
    "📸",
    "🎬",
] as const;

export type FillStyle =
    | { kind: "solid"; color: string }
    | { kind: "linear"; from: string; to: string; angle: number }
    | { kind: "radial"; inner: string; outer: string };

export type ShadowEffect = {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
};

export type EmbossEffect = {
    enabled: boolean;
    angle: number;
    intensity: number;
};

export type ReflectionEffect = {
    enabled: boolean;
    offset: number;
    opacity: number;
};

export type CornerOffsets = {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    br: { x: number; y: number };
    bl: { x: number; y: number };
};

export type BaseImage = {
    id: string;
    file: File;
    width: number;
    height: number;
};

export type CustomFontEntry = {
    id: string;
    family: string;
    fileName: string;
    file: File;
};

export type ImageLayer = {
    id: string;
    kind: "image";
    name: string;
    file: File;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    flipHorizontal: boolean;
    brightness: string;
    contrast: string;
    saturation: string;
    visible: boolean;
    locked?: boolean;
    crop?: { left: number; top: number; right: number; bottom: number };
    clipShape?: "none" | "circle" | "rounded-rect";
    clipRadius?: number;
    colorize?: { enabled: boolean; color: string; strength: number };
    strokeColor?: string;
    strokeWidth?: number;
    shadow?: ShadowEffect;
    reflection?: ReflectionEffect;
    emboss?: EmbossEffect;
    eraseColor?: {
        enabled: boolean;
        targetColor: string;
        tolerance: number;
        feather: number;
    };
    eraserMaskId?: string;
    eraserMaskFile?: File;
    perspective?: CornerOffsets;
};

export type TextCase = "none" | "uppercase" | "lowercase" | "capitalize";
export type TextAlign = "left" | "center" | "right";

export type TextLayer = {
    id: string;
    kind: "text";
    name: string;
    text: string;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    fill: string;
    fillStyle?: FillStyle;
    align?: TextAlign;
    letterSpacing?: number;
    lineHeight?: number;
    textCase?: TextCase;
    strokeColor?: string;
    strokeWidth?: number;
    shadow?: ShadowEffect;
    innerShadow?: ShadowEffect;
    background?: {
        enabled: boolean;
        color: string;
        padding: number;
        radius: number;
        opacity: number;
    };
    curveRadius?: number;
    reflection?: ReflectionEffect;
    emboss?: EmbossEffect;
    text3d?: {
        enabled: boolean;
        depth: number;
        angle: number;
        darken: number;
    };
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    visible: boolean;
    locked?: boolean;
};

export type ShapeKind =
    | "rectangle"
    | "ellipse"
    | "rounded-rect"
    | "polygon"
    | "star"
    | "arrow"
    | "speech-bubble";

export type ShapeLayer = {
    id: string;
    kind: ShapeKind;
    name: string;
    fill: string;
    fillStyle?: FillStyle;
    strokeColor: string;
    strokeWidth: number;
    cornerRadius?: number;
    sides?: number;
    innerRadiusRatio?: number;
    shadow?: ShadowEffect;
    emboss?: EmbossEffect;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    visible: boolean;
    locked?: boolean;
};

export type StickerLayer = {
    id: string;
    kind: "sticker";
    name: string;
    emoji: string;
    shadow?: ShadowEffect;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    visible: boolean;
    locked?: boolean;
};

export type DrawLayer = {
    id: string;
    kind: "draw";
    name: string;
    /** Points normalized 0..1 within the layer bounding box. */
    points: { x: number; y: number }[];
    strokeColor: string;
    strokeWidth: number;
    dashed?: boolean;
    glowBlur?: number;
    glowColor?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    visible: boolean;
    locked?: boolean;
};

export type BezierAnchor = {
    x: number;
    y: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
};

export type BezierLayer = {
    id: string;
    kind: "bezier";
    name: string;
    /** Anchors normalized 0..1 within the layer bounding box. */
    anchors: BezierAnchor[];
    closed: boolean;
    fill: string;
    fillStyle?: FillStyle;
    strokeColor: string;
    strokeWidth: number;
    shadow?: ShadowEffect;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: string;
    opacity: string;
    visible: boolean;
    locked?: boolean;
};

export type EditorLayer =
    | ImageLayer
    | TextLayer
    | ShapeLayer
    | StickerLayer
    | DrawLayer
    | BezierLayer;

export type CanvasOverlayEffects = {
    vignette: { enabled: boolean; intensity: number; radius: number };
    noise: { enabled: boolean; amount: number };
    stripes: {
        enabled: boolean;
        spacing: number;
        thickness: number;
        opacity: number;
        angle: number;
        color: string;
    };
};

export const DEFAULT_CANVAS_OVERLAYS: CanvasOverlayEffects = {
    vignette: { enabled: false, intensity: 45, radius: 70 },
    noise: { enabled: false, amount: 18 },
    stripes: {
        enabled: false,
        spacing: 24,
        thickness: 4,
        opacity: 20,
        angle: 45,
        color: "#ffffff",
    },
};

export type EditorSnapshot = {
    width: string;
    height: string;
    background: string;
    backgroundFill?: FillStyle | null;
    baseImage: BaseImage | null;
    baseBrightness: string;
    baseContrast: string;
    baseSaturation: string;
    baseRotation: string;
    baseFlipHorizontal: boolean;
    overlays?: CanvasOverlayEffects;
    layers: EditorLayer[];
};

export type StoredImageLayer = Omit<ImageLayer, "file" | "eraserMaskFile"> & {
    assetName: string;
    assetType: string;
};

export type StoredEditorLayer =
    | StoredImageLayer
    | TextLayer
    | ShapeLayer
    | StickerLayer
    | DrawLayer
    | BezierLayer;

export type StoredCustomFont = {
    id: string;
    family: string;
    fileName: string;
};

export type ImageEditorDocument = {
    version: 1 | 2;
    width: string;
    height: string;
    background: string;
    backgroundFill?: FillStyle | null;
    baseImage: {
        id: string;
        name: string;
        type: string;
        width: number;
        height: number;
    } | null;
    baseBrightness: string;
    baseContrast: string;
    baseSaturation: string;
    baseRotation: string;
    baseFlipHorizontal: boolean;
    overlays?: CanvasOverlayEffects;
    customFonts?: StoredCustomFont[];
    layers: StoredEditorLayer[];
    exportFormat?: "png" | "jpeg" | "webp";
    jpegQuality?: string;
};

/** Validate integer canvas dimensions within supported pixel limits. */
export function validateCanvasDimensions(
    widthStr: string,
    heightStr: string,
): {
    valid: boolean;
    width: number;
    height: number;
} {
    const width = Number(widthStr);
    const height = Number(heightStr);
    const valid =
        Number.isInteger(width) &&
        width > 0 &&
        width <= MAX_CANVAS_DIMENSION &&
        Number.isInteger(height) &&
        height > 0 &&
        height <= MAX_CANVAS_DIMENSION &&
        width * height <= MAX_CANVAS_PIXELS;
    return { valid, width, height };
}

/** Stable comparison signature for undo/redo deduplication. */
export function snapshotKey(snapshot: EditorSnapshot): string {
    return JSON.stringify({
        width: snapshot.width,
        height: snapshot.height,
        background: snapshot.background,
        backgroundFill: snapshot.backgroundFill ?? null,
        baseImageId: snapshot.baseImage?.id ?? null,
        baseBrightness: snapshot.baseBrightness,
        baseContrast: snapshot.baseContrast,
        baseSaturation: snapshot.baseSaturation,
        baseRotation: snapshot.baseRotation,
        baseFlipHorizontal: snapshot.baseFlipHorizontal,
        overlays: snapshot.overlays ?? null,
        layers: snapshot.layers.map((layer) => {
            if (layer.kind === "image") {
                const { file: _file, eraserMaskFile: _mask, ...rest } = layer;
                return rest;
            }
            return layer;
        }),
    });
}

/** Convert an in-memory editor state into a serializable document and its referenced asset files. */
export function serializeEditorDocument(
    snapshot: EditorSnapshot,
    exportFormat: "png" | "jpeg" | "webp",
    jpegQuality: string,
    customFonts: CustomFontEntry[] = [],
): { document: ImageEditorDocument; files: { id: string; file: File }[] } {
    const files: { id: string; file: File }[] = [];
    if (snapshot.baseImage) {
        files.push({
            id: snapshot.baseImage.id,
            file: snapshot.baseImage.file,
        });
    }
    for (const font of customFonts) {
        files.push({ id: font.id, file: font.file });
    }
    const layers: StoredEditorLayer[] = snapshot.layers.map((layer) => {
        if (layer.kind === "image") {
            const { file, eraserMaskFile, ...rest } = layer;
            files.push({ id: layer.id, file });
            if (layer.eraserMaskId && eraserMaskFile) {
                files.push({ id: layer.eraserMaskId, file: eraserMaskFile });
            }
            return { ...rest, assetName: file.name, assetType: file.type };
        }
        return layer;
    });
    return {
        document: {
            version: 2,
            width: snapshot.width,
            height: snapshot.height,
            background: snapshot.background,
            backgroundFill: snapshot.backgroundFill ?? null,
            baseImage: snapshot.baseImage
                ? {
                      id: snapshot.baseImage.id,
                      name: snapshot.baseImage.file.name,
                      type: snapshot.baseImage.file.type,
                      width: snapshot.baseImage.width,
                      height: snapshot.baseImage.height,
                  }
                : null,
            baseBrightness: snapshot.baseBrightness,
            baseContrast: snapshot.baseContrast,
            baseSaturation: snapshot.baseSaturation,
            baseRotation: snapshot.baseRotation,
            baseFlipHorizontal: snapshot.baseFlipHorizontal,
            overlays: snapshot.overlays,
            customFonts: customFonts.map(({ id, family, fileName }) => ({
                id,
                family,
                fileName,
            })),
            layers,
            exportFormat,
            jpegQuality,
        },
        files,
    };
}
