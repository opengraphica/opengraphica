/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import workingFileStore from '@/store/working-file';
import { drawWorkingFileToCanvas, trackCanvasTransforms } from '@/lib/canvas';
import { saveAs } from 'file-saver';

declare class ClipboardItem {
    constructor(data: { [mimeType: string]: Blob });
}

interface ExportOptions {
    fileName?: string,
    fileType: 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'tiff',
    layerSelection?: 'all' | 'selected',
    quality?: number,
    toClipboard?: boolean
}

const extensionToMimeType: { [key: string]: string } = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff'
};

export async function exportAsImage(options: ExportOptions): Promise<void> {
    return await new Promise<void>(async (resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = workingFileStore.get('width');
            canvas.height = workingFileStore.get('height');
            const ctx = trackCanvasTransforms(canvas.getContext('2d'));
            ctx.imageSmoothingEnabled = false;
            drawWorkingFileToCanvas(canvas, ctx, { selectedLayersOnly: options.layerSelection === 'selected' });

            const fileName = (options.fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|tif|tiff))$/ig, '') + '.' + options.fileType;

            const mimeType: string = extensionToMimeType[options.fileType];

            if (!isfileFormatSupported(mimeType)) {
                reject(new Error('File format not supported.'));
                return;
            }

            if (options.toClipboard) {
                if (await promptClipboardWritePermission()) {
                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            try {
                                const data = [new ClipboardItem({ [blob.type]: blob })];
                                await (navigator.clipboard as any).write(data);
                                resolve();
                            } catch (error) {
                                reject(new Error('Error writing to clipboard.'));
                            }
                        } else {
                            reject(new Error('Image blob was not created.'));
                        }
                    });
                } else {
                    reject(new Error('Clipboard copy not supported.'));
                }
            } else {
                canvas.toBlob((blob) => {
                    if (blob) {
                        saveAs(blob, fileName);
                        resolve();
                    } else {
                        reject(new Error('Image blob was not created.'));
                    }
                }, mimeType, options.quality);
            }
        } catch (error) {
            reject(new Error('An unexpected error occurred.'));
        }
    });
}

export function isfileFormatSupported(extensionOrMimeType: string) {
    const mimeType = extensionToMimeType[extensionOrMimeType] || extensionOrMimeType;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const data = canvas.toDataURL(mimeType);
    var actualType = data.replace(/^data:([^;]*).*/, '$1');
    if (mimeType != actualType && mimeType != "text/plain") {
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
    catch (error) {
        if (error.toString() === `TypeError: 'clipboard-write' (value of 'name' member of PermissionDescriptor) is not a valid value for enumeration PermissionName.` && (window as any).ClipboardItem) {
            return true;
        }
        // Browser compatibility / Security error (ONLY HTTPS) ...
        return false;
    }
}
