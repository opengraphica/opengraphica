/**
 * Parts of this file were adapted from miniPaint
 * @copyright (c) ViliusL
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

 import { saveAs } from 'file-saver';

import workingFileStore, {
    getCanvasRenderingContext2DSettings,
    getLayersByType,
    ensureUniqueLayerSiblingName
} from '@/store/working-file';
import editorStore from '@/store/editor';
import { createStoredImage } from '@/store/image';
import historyStore from '@/store/history';

import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { generateImageBlobHash } from '@/lib/hash';
import { knownFileExtensions } from '@/lib/regex';

import { InsertLayerAction } from '@/actions/insert-layer';

import { activeSelectionMask, appliedSelectionMask } from '@/canvas/store/selection-state';

import { useRenderer } from '@/renderers';

// @ts-ignore
import GIF from '@/lib/gif.js';

import type { WorkingFileRasterSequenceLayer, FileSystemFileHandle, ColorModel } from '@/types';

declare class ClipboardItem {
    constructor(data: { [mimeType: string]: Blob });
}

export interface ExportAsImageOptions {
    fileName?: string,
    fileType: 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'tiff',
    layerSelection?: 'all' | 'selected',
    cameraTransform?: DOMMatrix,
    applySelectionMask?: boolean,
    quality?: number,
    toClipboard?: boolean,
    toBlob?: boolean,
    toFileHandle?: FileSystemFileHandle | null,
    toNewLayer?: boolean,
    dithering?: string,
    generateImageHash?: boolean
}

export interface ExportAsImageResults {
    blob?: Blob;
    generatedImageHash: string;
}

const extensionToMimeType: { [key: string]: string } = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff'
};

export async function exportAsImage(options: ExportAsImageOptions): Promise<ExportAsImageResults> {
    let results: ExportAsImageResults = {
        generatedImageHash: ''
    };
    return await new Promise<ExportAsImageResults>(async (resolve, reject) => {
        try {
            const fileName = (options.fileName || 'image').replace(knownFileExtensions, '') + '.' + options.fileType;
            const mimeType: string = extensionToMimeType[options.fileType];

            if (!isfileFormatSupported(mimeType)) {
                reject(new Error('File format not supported.'));
                return;
            }

            let canvas = document.createElement('canvas');
            canvas.width = workingFileStore.get('width');
            canvas.height = workingFileStore.get('height');
            if (!['image/gif'].includes(mimeType)) {
                const renderer = await useRenderer();
                const snapshotBitmap = await renderer.takeSnapshot(canvas.width, canvas.height, {
                    cameraTransform: options.cameraTransform,
                    layerIds: options.layerSelection === 'selected' ? workingFileStore.state.selectedLayerIds : undefined,
                    applySelectionMask: options.applySelectionMask && (activeSelectionMask.value != null || appliedSelectionMask.value != null),
                });
                const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings()) as CanvasRenderingContext2D;
                ctx.drawImage(snapshotBitmap, 0, 0);
                snapshotBitmap.close();
            }

            if (options.toNewLayer) {
                historyStore.dispatch('runAction', {
                    action: new InsertLayerAction({
                        type: 'raster',
                        name: ensureUniqueLayerSiblingName(workingFileStore.state.layers[0]?.id, 'Flattened Image'),
                        width: canvas.width,
                        height: canvas.height,
                        data: {
                            sourceUuid: await createStoredImage(canvas),
                        }
                    })
                })
            }
            else if (options.toClipboard) {
                if (await promptClipboardWritePermission()) {
                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            try {
                                const data = [new ClipboardItem({ [blob.type]: blob })];
                                await (navigator.clipboard as any).write(data);
                                if (options.generateImageHash) {
                                    try {
                                        results.generatedImageHash = await generateImageBlobHash(blob);
                                    } catch (error) {
                                        // Ignore hash generation
                                    }
                                }
                                resolve(results);
                            } catch (error: any) {
                                reject(new Error('Error writing to clipboard.'));
                            }
                        } else {
                            reject(new Error('Image blob was not created.'));
                        }
                    });
                } else {
                    reject(new Error('Clipboard copy not supported.'));
                }
            } else if (mimeType === 'image/gif') {
                convertCanvasToGifBlob(canvas, options).then((blob) => {
                    if (blob) {
                        if (options.toFileHandle) {
                            save(blob, options.toFileHandle);
                        } else {
                            saveAs(blob, fileName);
                        }
                        resolve(results);
                    } else {
                        reject(new Error('Image blob was not created.'));
                    }
                });
            } else {
                canvas.toBlob((blob) => {
                    if (blob) {
                        if (options.toBlob) {
                            results.blob = blob;
                        } else if (options.toFileHandle) {
                            save(blob, options.toFileHandle);
                        } else {
                            saveAs(blob, fileName);
                        }
                        resolve(results);
                    } else {
                        reject(new Error('Image blob was not created.'));
                    }
                }, mimeType, options.quality);
            }
        } catch (error) {
            console.error('[src/modules/file/export.ts]', error);
            reject(new Error('An unexpected error occurred.'));
        }
    });
}

async function save(blob: Blob, fileHandle: FileSystemFileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export function isfileFormatSupported(extensionOrMimeType: string) {
    const mimeType = extensionToMimeType[extensionOrMimeType] || extensionOrMimeType;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const data = canvas.toDataURL(mimeType);
    var actualType = data.replace(/^data:([^;]*).*/, '$1');
    if (mimeType === 'image/gif') {
        return true;
    }
    else if (mimeType != actualType && mimeType != "text/plain") {
        return false;
    }
    return true;
}

export async function promptClipboardWritePermission(): Promise<boolean> {
    try {
        // The clipboard-write permission is granted automatically to pages
        // when they are the active tab. So it's not required, but it's more safe.
        const { state } = await navigator.permissions.query({ name: 'clipboard-write' } as any);
        return state === 'granted';
    }
    catch (error: any) {
        if (error.toString() === `TypeError: 'clipboard-write' (value of 'name' member of PermissionDescriptor) is not a valid value for enumeration PermissionName.` && (window as any).ClipboardItem) {
            return true;
        }
        // Browser compatibility / Security error (ONLY HTTPS) ...
        return false;
    }
}

export async function convertCanvasToGifBlob(canvas: HTMLCanvasElement, options: ExportAsImageOptions): Promise<Blob> {
    const quality = options.quality == null ? 1 : options.quality;

    const rasterSequenceLayers = getLayersByType('rasterSequence') as WorkingFileRasterSequenceLayer<ColorModel>[];
    let significantFramesSet = new Set<number>();
    for (let layer of rasterSequenceLayers) {
        for (let frame of layer.data.sequence) {
            significantFramesSet.add(frame.start);
            significantFramesSet.add(frame.end);
        }
    }
    let significantFrames = [...significantFramesSet].sort((a, b) => {
        return a < b ? -1 : 1;
    });
    let minimumFrameTime = 10;
    let frameTimes: number[] = [significantFrames[0]];
    let previousFrame: number = significantFrames[0];
    for (let frame of significantFrames.slice(1)) {
        if (frame > previousFrame + minimumFrameTime) {
            previousFrame = Math.floor(Math.floor(frame / minimumFrameTime) * minimumFrameTime);
            if (frame % minimumFrameTime !== 0) {
                previousFrame += minimumFrameTime;
            }
            frameTimes.push(previousFrame);
        }
    }
    if (frameTimes.length === 1) {
        frameTimes.push(100);
    }

    const gifSettings = {
        workers: navigator.hardwareConcurrency || 4,
        quality: Math.round(1 + ((1 - quality) * 29)), // 1-30, lower is better
        repeat: 0,
        width: workingFileStore.get('width'),
        height: workingFileStore.get('height'),
        dither: options.dithering,
        workerScript: './js/workers/gif.worker.js',
    };
    const gif = new GIF(gifSettings);

    const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings()) as CanvasRenderingContext2D;
    const originalTimelineCursorPosition = editorStore.get('timelineCursor');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < frameTimes.length - 1; i++) {
        const frameTime = frameTimes[i];
        const delay = frameTimes[i + 1] - frameTimes[i];
        editorStore.dispatch('setTimelineCursor', frameTime);
        ctx.clearRect(0, 0, gifSettings.width, gifSettings.height);
        drawWorkingFileToCanvas2d(canvas, ctx, {
            force2dRenderer: true,
            selectedLayersOnly: options.layerSelection === 'selected'
        });
        gif.addFrame(ctx, { copy: true, delay: delay });
    }
    editorStore.dispatch('setTimelineCursor', originalTimelineCursorPosition);

    return new Promise<Blob>((resolve) => {
        gif.on('finished', (blob: Blob) => {
            resolve(blob);
        });
        gif.render();
    });
}

export function flattenToNewLayer() {
    exportAsImage({
        fileType: 'png',
        toNewLayer: true
    });
}
