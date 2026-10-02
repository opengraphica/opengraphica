import { saveAs } from 'file-saver';
 import { t } from '@/i18n';

import workingFileStore from '@/store/working-file';
import { writeWorkingFile } from '@/store/data/working-file-database';

import { createArrayBufferFromBlob, createDataUriFromBlob } from '@/lib/binary';
import appEmitter from '@/lib/emitter';

import type {
    FileSystemFileHandle, ColorModel, WorkingFile
} from '@/types';

interface SaveImageAsOptions {
    fileName?: string;
}

export function addFileExtension(fileName: string | undefined, extension?: string) {
    return (fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|ora|svg|tif|tiff|m3u8|mp4|3gp|3g2|ts|mpeg|ogg|mov|webm))$/ig, '') + (extension ? '.' + extension : '');
}

export async function createSaveArrayBuffer(): Promise<ArrayBuffer> {
    const { serializeWorkingFile } = await import('@/modules/file/formats/ora-save');
    const blob = await serializeWorkingFile();
    return createArrayBufferFromBlob(blob);
}

export async function saveImage(fileHandle: FileSystemFileHandle) {
    const { serializeWorkingFile } = await import('@/modules/file/formats/ora-save');
    const blob = await serializeWorkingFile();
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function saveImageAs(options: SaveImageAsOptions = {}) {
    const { serializeWorkingFile } = await import('@/modules/file/formats/ora-save');
    const blob = await serializeWorkingFile();
    const fileName = addFileExtension(options.fileName, 'ora');
    if (window.Capacitor?.isNativePlatform) {
        const { Directory, Filesystem } = await import('@capacitor/filesystem');
        if (!await Filesystem.checkPermissions()) {
            await Filesystem.requestPermissions();
        }
        const base64File = await createDataUriFromBlob(blob, true);
        await Filesystem.writeFile({
            path: fileName,
            data: base64File,
            directory: Directory.Documents,
            recursive: true,
        });
        appEmitter.emit('app.notify', {
            type: 'info',
            message: t('module.fileSaveAs.nativeSaveToast'),
            duration: 5000,
        });
    } else {
        saveAs(blob, fileName);
    }
}

export async function saveWorkingFileToTemporaryStorage() {
    const workingFile: WorkingFile<ColorModel> = {
        version: '0.0.1-ALPHA.1',
        date: new Date().toISOString(),
        background: workingFileStore.get('background'),
        colorModel: workingFileStore.get('colorModel'),
        colorSpace: workingFileStore.get('colorSpace'),
        drawOriginX: workingFileStore.get('drawOriginX'),
        drawOriginY: workingFileStore.get('drawOriginY'),
        height: workingFileStore.get('height'),
        layerIdCounter: workingFileStore.get('layerIdCounter'),
        maskIdCounter: workingFileStore.get('maskIdCounter'),
        masks: workingFileStore.get('masks'),
        measuringUnits: workingFileStore.get('measuringUnits'),
        resolutionUnits: workingFileStore.get('resolutionUnits'),
        resolutionX: workingFileStore.get('resolutionX'),
        resolutionY: workingFileStore.get('resolutionY'),
        scaleFactor: workingFileStore.get('scaleFactor'),
        selectedLayerIds: workingFileStore.get('selectedLayerIds'),
        width: workingFileStore.get('width'),
        layers: workingFileStore.get('layers'),
    }
    try {
        await writeWorkingFile(workingFile);
    } catch (error) {
        console.warn(error);
        throw new Error('Could not save file. It may be too large.');
    }
}
