import type { Scene } from 'three/src/scenes/Scene';

export type DrawableRenderMode = '2d' | 'webgl';

export interface DefaultDrawableData {
    [key: string]: any;
}

export interface DrawableOptionsGeneral<T = DefaultDrawableData> {
    renderMode: DrawableRenderMode;
    isInWorker: boolean;
    needsUpdateCallback: (data: any) => void;
    data?: T;
}

export interface DrawableOptions2d<T = DefaultDrawableData> extends DrawableOptionsGeneral<T> {
    renderMode: '2d';
}

export interface DrawableOptionsWebgl<T = DefaultDrawableData> extends DrawableOptionsGeneral<T> {
    renderMode: 'webgl';
    scene: Scene;
}

export interface DrawableDrawOptions {
    // The entire drawable should be drawn from scratch, rather than updating piecemeal
    refresh?: boolean;
    // The transformation matrix that should be applied to the drawable
    transform?: DOMMatrix;
    // The canvas data that the drawable is drawn on top of, in case it affects it
    destinationCanvas?: HTMLCanvasElement | ImageBitmap;
    // The transformation matrix that should be applied to that canvas
    destinationCanvasTransform?: DOMMatrix;
    // Updates for each drawable instance
    updates: DrawableUpdate[];
}

export type DrawableUpdateOptions = Omit<DrawableDrawOptions, 'transform' | 'updates'>;

export interface DrawableUpdate<T = DefaultDrawableData> {
    uuid: string;
    data: T;
}

export type DrawableOptions<T = DefaultDrawableData> = DrawableOptions2d<T> | DrawableOptionsWebgl<T>;

export interface DrawableUpdateBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
    updateInfo?: any; // Drawable can set anything here that may be useful to know after it is drawn
}

export interface DrawableDrawInfo {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface Drawable<T = DefaultDrawableData> {
    update: (data: T, options: DrawableUpdateOptions) => DrawableUpdateBounds;
    draw2d: (context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, info: DrawableDrawInfo) => void;
    drawWebgl: () => void;
    dispose: () => void;
}
export interface DrawableConstructor {
    new (options: DrawableOptions): Drawable;
}
