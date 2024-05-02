import { v4 as uuidv4 } from 'uuid';
import { createDrawableCanvas, addDrawable, removeDrawable, renderDrawableCanvas, destroyDrawableCanvas } from '@/workers/drawable-canvas.interface';
import type { DrawableCanvasOptions, DefaultDrawableData, DrawableUpdate } from '@/types';

interface DrawableInfo {
    name: string;
    data: any;
}

interface DrawnCallbackEvent {
    canvas: HTMLCanvasElement;
    sourceX: number;
    sourceY: number;
}

export default class DrawableCanvas {
    private updateChunkSize: number;
    private drawables = new Map<string, DrawableInfo>();
    private canvas: HTMLCanvasElement;
    private offscreenCanvasUuid: string | undefined = undefined;
    private onDrawnCallback: ((event: DrawnCallbackEvent) => void) | undefined = undefined;

    constructor(options: DrawableCanvasOptions) {
        this.updateChunkSize = options.updateChunkSize ?? 64;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.updateChunkSize;
        this.canvas.height = this.updateChunkSize;

        if (window.OffscreenCanvas) {
            try {
                this.offscreenCanvasUuid = createDrawableCanvas({
                    onscreenCanvas: this.canvas,
                    onDrawn: (event) => {
                        this.onDrawnCallback?.({
                            canvas: this.canvas,
                            sourceX: event.sourceX,
                            sourceY: event.sourceY,
                        });
                    }
                });
            } catch (error) {
                console.error('DrawableCanvas: error setting up OffscreenCanvas. ', error);
                // Default to main thread canvas
            }
        }
    }

    add<T = DefaultDrawableData>(name: string, data: T = {} as never): string {
        const uuid = uuidv4();
        this.drawables.set(uuid, {
            name,
            data,
        });
        if (this.offscreenCanvasUuid) {
            addDrawable(this.offscreenCanvasUuid, uuid, name, data);
        }
        return uuid;
    }

    remove(uuid: string) {
        const drawableInfo = this.drawables.get(uuid);
        if (!drawableInfo) return;
        if (this.offscreenCanvasUuid) {
            removeDrawable(this.offscreenCanvasUuid, uuid);
        }
        this.drawables.delete(uuid);
    }

    draw(updates: DrawableUpdate[]) {
        if (this.offscreenCanvasUuid) {
            renderDrawableCanvas(this.offscreenCanvasUuid, updates);
        }
    }

    onDrawn(callback: (event: DrawnCallbackEvent) => void) {
        this.onDrawnCallback = callback;
    }

    dispose() {
        if (this.offscreenCanvasUuid) {
            destroyDrawableCanvas(this.offscreenCanvasUuid);
        }
    }
}
