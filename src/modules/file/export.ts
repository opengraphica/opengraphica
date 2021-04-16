/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import workingFileStore from '@/store/working-file';
import { drawWorkingFileToCanvas, trackCanvasTransforms } from '@/lib/canvas';
import { saveAs } from 'file-saver';

interface ExportOptions {
    fileName?: string,
    fileType: 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'tiff',
    layerSelection?: 'all' | 'selected',
    quality?: number
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
    return await new Promise<void>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = workingFileStore.get('width');
        canvas.height = workingFileStore.get('height');
        const ctx = trackCanvasTransforms(canvas.getContext('2d'));
        ctx.imageSmoothingEnabled = false;
        drawWorkingFileToCanvas(canvas, ctx, { selectedLayersOnly: options.layerSelection === 'selected' });

        const fileName = (options.fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|tif|tiff))$/ig, '') + '.' + options.fileType;

        const mimeType: string = extensionToMimeType[options.fileType];

        if (!isfileFormatSupported(mimeType)) {
            reject(new Error('File format not supported'));
            return;
        }

        canvas.toBlob((blob) => {
            if (blob) {
                saveAs(blob, fileName);
                resolve();
            } else {
                reject(new Error('Image blob was not created'));
            }
        }, mimeType, options.quality); 
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
