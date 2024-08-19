/*
 * This class provides an interface to draw objects called "Drawables" (inside the src/canvas/drawables) folder
 * to a HTML canvas efficiently. It makes use of the OffscreenCanvas API if available, and only renders the areas
 * of the image which have been updated in the current draw frame.
 */

import { v4 as uuidv4 } from 'uuid';
import canvasStore from '@/store/canvas';
import {
    createDrawableCanvas, setDrawableCanvasScale, addDrawable, removeDrawable, renderDrawableCanvas, destroyDrawableCanvas,
} from '@/workers/drawable-canvas.interface';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { isOffscreenCanvasSupported } from '@/lib/feature-detection/offscreen-canvas';
import { nearestPowerOf2 } from '@/lib/math';
import type { DefaultDrawableData, Drawable, DrawableDrawOptions, DrawableConstructor, DrawableRenderMode, DrawableUpdate } from '@/types';

export interface DrawableCanvasOptions {
    width?: number;
    height?: number;
    scale?: number;
    forceDrawOnMainThread?: boolean;
    sync?: boolean;
}

interface DrawableInfo {
    name: string;
    data: any;
    drawable?: Drawable;
}

export interface DrawnCallbackEvent {
    canvas: HTMLCanvasElement;
    sourceX: number;
    sourceY: number;
    updateInfo: Record<string, any>;
}

export default class DrawableCanvas {
    private isInitialized: boolean = false;
    private renderMode: DrawableRenderMode;
    private scale: number;
    private forceDrawOnMainThread: boolean;
    private sync: boolean;

    private drawables = new Map<string, DrawableInfo>();
    private drawableClassMap: Record<string, () => Promise<DrawableConstructor>> = {};
    private registeredDrawableClassMap: Record<string, DrawableConstructor> = {};

    private mainThreadCanvas: HTMLCanvasElement | undefined = undefined;
    private mainThreadCanvasCtx2d: CanvasRenderingContext2D | undefined = undefined;
    private lastDrawX: number = 0;
    private lastDrawY: number = 0;
    private lastDrawUpdateInfo: Record<string, any> = {};

    private offscreenCanvasUuid: string | undefined = undefined;
    private offscreenCanvasLastCallbackData: DrawnCallbackEvent | undefined = undefined;
    private isWaitingOnOffscreenCanvasResult = false;

    private pendingDrawOptions: DrawableDrawOptions | undefined = undefined;

    private onInitializedCallbacks: Array<() => void>= [];
    private onDrawnCallback: ((event: DrawnCallbackEvent) => void) | undefined = undefined;
    private onDrawCompleteCallbacks: Array<((event: DrawnCallbackEvent) => void)> = [];

    constructor(options: DrawableCanvasOptions) {
        this.renderMode = '2d';
        this.scale = options.scale ?? 1;
        this.forceDrawOnMainThread = options.forceDrawOnMainThread ?? false;
        this.sync = options.sync ?? false;
        this.init();
    }

    private async init() {
        const canUseOffscrenCanvas = this.forceDrawOnMainThread ? false : await isOffscreenCanvasSupported();
        if (canUseOffscrenCanvas) {
            try {
                this.offscreenCanvasUuid = await createDrawableCanvas({
                    onDrawn: (event) => {
                        this.onOffscreenCanvasDrawn(event);
                    }
                });
            } catch (error) {
                console.error('[src/canvas/renderers/drawable/canvas.ts] Error setting up OffscreenCanvas. ', error);
            }
        }
        if (!this.offscreenCanvasUuid) {
            this.mainThreadCanvas = document.createElement('canvas');
            this.mainThreadCanvas.width = 64;
            this.mainThreadCanvas.height = 64;
            if (this.renderMode === '2d') {
                this.mainThreadCanvasCtx2d = this.mainThreadCanvas.getContext('2d', getCanvasRenderingContext2DSettings()) ?? undefined;
            }
        }

        if (!this.sync && !this.offscreenCanvasUuid) {
            this.drawableClassMap = (await import('@/canvas/drawables')).default;
        }

        this.isInitialized = true;

        // Setup offscreen canvas state if some properties were modified before initialization.
        if (this.offscreenCanvasUuid) {
            setDrawableCanvasScale(this.offscreenCanvasUuid, this.scale);
            for (const [uuid, { name, data }] of this.drawables.entries()) {
                addDrawable(this.offscreenCanvasUuid, uuid, name, data);
            }
        } else {
            for (const uuid of this.drawables.keys()) {
                await this.initializeDrawable(uuid);
            }
        }

        // Run callbacks
        for (const initializedCallback of this.onInitializedCallbacks) {
            initializedCallback();
        }
        this.onInitializedCallbacks = [];
    }

    async initialized() {
        if (this.isInitialized) {
            return;
        } else {
            return await new Promise<void>((resolve) => {
                this.onInitializedCallbacks.push(resolve);
            });
        }
    }

    private async initializeDrawable(uuid: string) {
        if (!this.offscreenCanvasUuid) {
            const drawableInfo = this.drawables.get(uuid);
            if (!drawableInfo) return;
            const { name } = drawableInfo;
            let DrawableClass = this.registeredDrawableClassMap[name];
            if (!DrawableClass) {
                DrawableClass = await this.drawableClassMap[name]();
            }
            drawableInfo.drawable = new DrawableClass({
                renderMode: this.renderMode,
                isInWorker: false,
                needsUpdateCallback: (data: any) => {
                    this.draw({
                        updates: [
                            { uuid, data },
                        ],
                    });
                },
                scene: undefined as never,
            });
        }
    }

    public registerDrawableClass(name: string, drawableClass: DrawableConstructor) {
        this.registeredDrawableClassMap[name] = drawableClass;
    }

    private onOffscreenCanvasDrawn(event: DrawnCallbackEvent) {
        this.isWaitingOnOffscreenCanvasResult = false;
        const callbackData = {
            canvas: event.canvas,
            sourceX: event.sourceX,
            sourceY: event.sourceY,
            updateInfo: event.updateInfo,
        };
        this.onDrawnCallback?.(callbackData);
        for (const callbackHandler of this.onDrawCompleteCallbacks) {
            callbackHandler(callbackData);
        }
        this.onDrawCompleteCallbacks = [];
        const pendingDrawOptions = this.pendingDrawOptions;
        if (pendingDrawOptions) {
            this.pendingDrawOptions = undefined;
            this.draw(pendingDrawOptions);
        }
    }

    setScale(newScale: number) {
        if (newScale == this.scale) return;
        this.scale = newScale;
        if (!this.isInitialized) return;
        if (this.offscreenCanvasUuid) {
            setDrawableCanvasScale(this.offscreenCanvasUuid, newScale);
        }
    }

    async add<T = DefaultDrawableData>(name: string, data: T = {} as never): Promise<string> {
        const uuid = uuidv4();
        this.drawables.set(uuid, {
            name,
            data,
        });
        if (this.isInitialized) {
            if (this.offscreenCanvasUuid) {
                addDrawable(this.offscreenCanvasUuid, uuid, name, data);
            }
            await this.initializeDrawable(uuid);
        }
        return uuid;
    }

    addSync<T = DefaultDrawableData>(name: string, data: T = {} as never): string {
        const uuid = uuidv4();
        this.drawables.set(uuid, {
            name,
            data,
        });
        if (this.isInitialized) {
            this.initializeDrawable(uuid);
        }
        return uuid;
    }

    remove(uuid: string) {
        const drawableInfo = this.drawables.get(uuid);
        if (!drawableInfo) return;
        this.drawables.delete(uuid);
        if (!this.isInitialized) return;
        if (this.offscreenCanvasUuid) {
            removeDrawable(this.offscreenCanvasUuid, uuid);
        }
    }

    draw(options: DrawableDrawOptions) {
        if (this.offscreenCanvasUuid) {
            if (!this.isWaitingOnOffscreenCanvasResult) {
                this.isWaitingOnOffscreenCanvasResult = true;
                renderDrawableCanvas(this.offscreenCanvasUuid, options);
            } else {
                this.pendingDrawOptions = options;
            }
        } else if (this.renderMode === '2d') {
            this.draw2d(options);
        } else if (this.renderMode === 'webgl') {
            this.drawWebgl(options);
        }
    }

    async drawComplete(): Promise<DrawnCallbackEvent> {
        if (this.isWaitingOnOffscreenCanvasResult) {
            return await new Promise<DrawnCallbackEvent>((resolve) => {
                this.onDrawCompleteCallbacks.push(resolve);
            });
        } else if (this.offscreenCanvasUuid) {
            return this.offscreenCanvasLastCallbackData!;
        } else {
            return {
                canvas: this.mainThreadCanvas!,
                sourceX: this.lastDrawX,
                sourceY: this.lastDrawY,
                updateInfo: this.lastDrawUpdateInfo,
            };
        }
    }

    drawCompleteSync(): DrawnCallbackEvent {
        return {
            canvas: this.mainThreadCanvas!,
            sourceX: this.lastDrawX,
            sourceY: this.lastDrawY,
            updateInfo: this.lastDrawUpdateInfo,
        };
    }

    draw2d(options: DrawableDrawOptions) {
        if (!this.mainThreadCanvasCtx2d) return;
        const { refresh, updates: drawableUpdates } = options;
        const ctx = this.mainThreadCanvasCtx2d;
        const canvas = ctx.canvas;
        const renderScale = this.scale;

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        let updateInfo: Record<string, any> = {};
        for (const drawableUpdate of drawableUpdates) {
            const drawableInfo = this.drawables.get(drawableUpdate.uuid);
            if (!drawableInfo?.drawable) continue;
            const drawingBounds = drawableInfo.drawable.update(drawableUpdate.data, { refresh });
            const { transform } = options;
            if (transform) {
                const transformedPoints = [
                    new DOMPoint(drawingBounds.left, drawingBounds.top).matrixTransform(transform),
                    new DOMPoint(drawingBounds.left, drawingBounds.bottom).matrixTransform(transform),
                    new DOMPoint(drawingBounds.right, drawingBounds.bottom).matrixTransform(transform),
                    new DOMPoint(drawingBounds.right, drawingBounds.top).matrixTransform(transform),
                ];
                for (const transformedPoint of transformedPoints) {
                    if (transformedPoint.x < left) left = transformedPoint.x;
                    if (transformedPoint.x > right) right = transformedPoint.x;
                    if (transformedPoint.y < top) top = transformedPoint.y;
                    if (transformedPoint.y > bottom) bottom = transformedPoint.y;
                }
            } else {
                if (drawingBounds.left < left) left = drawingBounds.left;
                if (drawingBounds.right > right) right = drawingBounds.right;
                if (drawingBounds.top < top) top = drawingBounds.top;
                if (drawingBounds.bottom > bottom) bottom = drawingBounds.bottom;
            }
            if (drawingBounds.updateInfo) {
                updateInfo[drawableUpdate.uuid] = drawingBounds.updateInfo;
            }
        }

        let drawX = left == Infinity ? 0 : Math.max(0, Math.floor(left * renderScale));
        let drawY = top == Infinity ? 0 : Math.max(0, Math.floor(top * renderScale));

        const newCanvasWidth = Math.pow(2, nearestPowerOf2((right - left) * renderScale));
        const newCanvasHeight = Math.pow(2, nearestPowerOf2((bottom - top) * renderScale));
        if (newCanvasWidth && newCanvasHeight && (newCanvasWidth != canvas.width || newCanvasHeight != canvas.height)) {
            canvas.width = newCanvasWidth;
            canvas.height = newCanvasHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(-drawX, -drawY);
        ctx.scale(renderScale, renderScale);
        if (options.transform) {
            const { transform } = options;
            ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
        }
        for (const { drawable } of this.drawables.values()) {
            if (!drawable) continue;
            drawable.draw2d(ctx);
        }
        ctx.restore();

        this.lastDrawX = drawX;
        this.lastDrawY = drawY;
        this.lastDrawUpdateInfo = updateInfo;
        this.onDrawnCallback?.({
            canvas,
            sourceX: drawX,
            sourceY: drawY,
            updateInfo,
        });
    }

    drawWebgl(options: DrawableDrawOptions) {
        // TODO
    }

    onDrawn(callback: (event: DrawnCallbackEvent) => void) {
        this.onDrawnCallback = callback;
    }

    dispose() {
        this.onDrawnCallback = undefined;
        this.drawables.clear();
        if (this.offscreenCanvasUuid) {
            destroyDrawableCanvas(this.offscreenCanvasUuid);
        }
    }
}
