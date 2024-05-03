/*
 * Unfortunately, Firefox for Android messed up their offscreen canvas implementation where
 * the canvas data can't be transferred to other canvases or extracted in any way.
 * This function tests that OffscreenCanvas is working sufficiently for this application's usage.
 */

let isSupported: boolean | null = null;

export function isOffscreenCanvasSupported(): Promise<boolean> {
    if (isSupported != null) return Promise.resolve(isSupported);
    if (!window.OffscreenCanvas) {
        isSupported = false;
        return Promise.resolve(isSupported);
    }
    return new Promise((resolve) => {
        let worker: Worker | undefined = undefined;
        try {
            worker = new Worker(
                /* webpackChunkName: 'worker-offscreen-canvas-detection' */ new URL('./workers/offscreen-canvas.worker.ts', import.meta.url)
            );
            let sourceCanvas: HTMLCanvasElement = document.createElement('canvas');
            sourceCanvas.width = 2;
            sourceCanvas.height = 2;
            let targetCanvas: HTMLCanvasElement = document.createElement('canvas');
            targetCanvas.width = 2;
            targetCanvas.height = 2;
            let offscreenCanvas = sourceCanvas.transferControlToOffscreen();
        
            worker.onmessage = () => {
                try {
                    const targetCanvasCtx = targetCanvas.getContext('2d');
                    if (targetCanvasCtx) {
                        targetCanvasCtx.drawImage(sourceCanvas, 0, 0);
                        isSupported = targetCanvasCtx.getImageData(0, 0, 1, 1).data[0] > 127;
                    } else {
                        isSupported = false;
                    }
                } catch (error) {
                    isSupported = false;
                }
                resolve(isSupported as boolean);
                (sourceCanvas as unknown) = null;
                (targetCanvas as unknown) = null;
                (offscreenCanvas as unknown) = null;
                worker?.terminate();
                worker = undefined;
            };
            worker.onerror = () => {
                isSupported = false;
                resolve(isSupported);
                (sourceCanvas as unknown) = null;
                (targetCanvas as unknown) = null;
                (offscreenCanvas as unknown) = null;
                worker?.terminate();
                worker = undefined;
            }
        
            worker.postMessage({
                canvas: offscreenCanvas,
            }, [offscreenCanvas]);
        } catch (error) {
            isSupported = false;
            resolve(isSupported);
            try {
                worker?.terminate();
                worker = undefined;
            } catch (error) {}
        }
    });
}
