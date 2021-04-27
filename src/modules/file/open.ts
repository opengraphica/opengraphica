/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import {
    SerializedFile, SerializedFileLayer, WorkingFileLayer, RGBAColor, InsertAnyLayerOptions, InsertRasterLayerOptions,
    WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileVectorLayer, WorkingFileTextLayer,
    SerializedFileGroupLayer, SerializedFileRasterLayer, SerializedFileVectorLayer, SerializedFileTextLayer, WorkingFileAnyLayer
} from '@/types';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateFileAction } from '@/actions/update-file';
import { CreateFileAction } from '@/actions/create-file';
import { InsertLayerAction } from '@/actions/insert-layer';

interface FileDialogOpenOptions {
    insert?: boolean; // False will create a new document, true inserts into current document.
    accept?: string; // Mime type of files to accept, same as input "accept" attribute.
}

export async function openFromFileDialog(options: FileDialogOpenOptions = {}): Promise<void> {

    // This container and the file input is purposely left in the dom after creation in order to avoid
    // several bugs revolving around the fact that browsers give you no information if file selection is canceled.
    let temporaryFileInputContainer = document.getElementById('ogr-tmp-file-input-container') as HTMLDivElement;
    if (!temporaryFileInputContainer) {
        temporaryFileInputContainer = document.createElement('div');
        temporaryFileInputContainer.id = 'ogr-tmp-file-input-container';
        temporaryFileInputContainer.style.position = 'absolute';
        temporaryFileInputContainer.style.opacity = '0.01';
        temporaryFileInputContainer.style.width = '1px';
        temporaryFileInputContainer.style.height = '1px';
        temporaryFileInputContainer.style.overflow = 'hidden';
        document.body.appendChild(temporaryFileInputContainer);
    }
    temporaryFileInputContainer.innerHTML = '';

    let isChangeFired: boolean = false;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.setAttribute('accept', options.accept || '.json,image/*');
    fileInput.multiple = true;
    temporaryFileInputContainer.appendChild(fileInput);
    await new Promise<void>((resolve, reject) => {
        fileInput.addEventListener('change', async (e: Event) => {
            isChangeFired = true;
            temporaryFileInputContainer.removeChild(fileInput);
            const files = (e.target as HTMLInputElement).files;
            if (files) {
                try {
                    await openFromFileList(files, options);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            } else {
                resolve();
            }
        });
        const onFocusAway = () => {
            setTimeout(() => {
                if (!isChangeFired) {
                    resolve();
                }
            }, 500);
            window.removeEventListener('focus', onFocusAway);
        };
        window.addEventListener('focus', onFocusAway);
        fileInput.click();
    });

};

export async function insertFromFileDialog() {
    return openFromFileDialog({
        insert: true,
        accept: 'image/*'
    });
}

export async function openFromFileList(files: FileList | Array<File>, options: FileDialogOpenOptions = {}) {

    type FileReadType = 'json' | 'image';
    type FileReadResolve = { type: 'image', result: HTMLImageElement, file: File } | { type: 'json', result: string, file: File };

    const readerPromises: Promise<FileReadResolve>[] = [];

    let fileName: string = '';

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];

        readerPromises.push(
            new Promise(async (resolveReader, rejectReader) => {
                if (!file.type.match(/^image\//) && !file.name.match(/\.json$/)) {
                    rejectReader('The file "' + file.name + '" is the wrong type. It must be an image or json file.');
                    return;
                }

                const fileReadType: FileReadType = (file.type === 'text/plain' || file.name.match(/\.json$/)) ? 'json' : 'image';

                if (!fileName) {
                    fileName = file.name;
                }

                const fileReader = new FileReader();

                if (fileReadType === 'image') {
                    const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                        const image = new Image();
                        image.onload = () => {
                            resolveImage(image);
                        };
                        image.onerror = () => {
                            rejectImage();
                        };
                        image.src = URL.createObjectURL(file) as string;
                    });
                    resolveReader({ type: 'image', result: image, file: file });
                }
                else if (fileReadType === 'json') {
                    fileReader.onload = async () => {
                        resolveReader({ type: 'json', result: fileReader.result as string, file: file });
                    };
                    fileReader.onerror = () => {
                        rejectReader('An error occurred while reading the file "' + file.name + '".');
                    };
                    fileReader.readAsText(file);
                }

            })
        );
    }

    let insertLayerActions: InsertLayerAction<any>[] = [];
    const loadErrorMessages: string[] = [];

    let largestWidth = 0;
    let largestHeight = 0;
    let isAnyLayerLoaded: boolean = false;

    const newFileOptions: Partial<WorkingFileState> = {
        fileName
    };

    const settledReaderPromises = await Promise.allSettled(readerPromises);
    for (let readerSettle of settledReaderPromises) {
        if (readerSettle.status === 'fulfilled') {
            isAnyLayerLoaded = true;
            if (readerSettle.value.type === 'image') {
                const image = readerSettle.value.result;
                if (image.width > largestWidth) {
                    largestWidth = image.width;
                }
                if (image.height > largestHeight) {
                    largestHeight = image.height;
                }
                insertLayerActions.push(
                    new InsertLayerAction<InsertRasterLayerOptions<RGBAColor>>({
                        type: 'raster',
                        name: readerSettle.value.file.name,
                        width: image.width,
                        height: image.height,
                        data: {
                            sourceImage: image,
                            sourceImageIsObjectUrl: true
                        }
                    })
                );
            } else if (readerSettle.value.type === 'json') {
                const { workingFileDefinition, insertLayerActions: workingFileInsertLayerActions } = await parseSerializedFileToActions(JSON.parse(readerSettle.value.result));
                for (let prop in workingFileDefinition) {
                    if (prop === 'width') {
                        newFileOptions.width = Math.max(newFileOptions.width || 1, workingFileDefinition.width || 1);
                    } else if (prop === 'height') {
                        newFileOptions.height = Math.max(newFileOptions.height || 1, workingFileDefinition.height || 1);
                    } else {
                        (newFileOptions as any)[prop as keyof WorkingFileState] = workingFileDefinition[prop as keyof WorkingFileState];
                    }
                }
                insertLayerActions = insertLayerActions.concat(workingFileInsertLayerActions);
            }
        } else if (readerSettle.status === 'rejected') {
            loadErrorMessages.push(readerSettle.reason);
        }
    }

    if (isAnyLayerLoaded) {
        await historyStore.dispatch('free', {
            memorySize: Infinity,
            databaseSize: Infinity
        });

        if (!newFileOptions.width) {
            newFileOptions.width = largestWidth || 1;
        }
        if (!newFileOptions.height) {
            newFileOptions.height = largestHeight || 1;
        }
        
        const fileUpdateActions: BaseAction[] = [];
        if (options.insert) {
            if (workingFileStore.state.layers.length === 0) {
                fileUpdateActions.push(
                    new UpdateFileAction({
                        width: largestWidth,
                        height: largestHeight
                    })
                );
            }
        } else {
            fileUpdateActions.push(
                new CreateFileAction(newFileOptions)
            );
        }

        preferencesStore.set('useCanvasViewport', preferencesStore.get('preferCanvasViewport'));
        await historyStore.dispatch('runAction', {
            action: new BundleAction('openFile', 'Open File', [
                ...fileUpdateActions,
                ...insertLayerActions
            ])
        });

        (window as any).workingFileStore = await (await import('@/store/working-file')).default;
    } else {
        throw new Error('None of the files selected could be loaded.');
    }
}

async function parseSerializedFileToActions(serializedFile: SerializedFile<RGBAColor>): Promise<{ workingFileDefinition: Partial<WorkingFileState>, insertLayerActions: InsertLayerAction<any>[] }> {
    const workingFileDefinition: Partial<WorkingFileState> = {
        activeLayerId: serializedFile.activeLayerId,
        colorModel: serializedFile.colorModel,
        colorSpace: serializedFile.colorSpace,
        drawOriginX: serializedFile.drawOriginX,
        drawOriginY: serializedFile.drawOriginY,
        height: serializedFile.height,
        layerIdCounter: serializedFile.layerIdCounter,
        measuringUnits: serializedFile.measuringUnits,
        resolutionUnits: serializedFile.resolutionUnits,
        resolutionX: serializedFile.resolutionX,
        resolutionY: serializedFile.resolutionY,
        scaleFactor: serializedFile.scaleFactor,
        selectedLayerIds: serializedFile.selectedLayerIds,
        width: serializedFile.width,
    };
    const insertLayerActions: InsertLayerAction<any>[] = await parseLayersToActions(serializedFile.layers);
    return {
        workingFileDefinition,
        insertLayerActions
    };
}

async function parseLayersToActions(layers: SerializedFileLayer<RGBAColor>[]): Promise<InsertLayerAction<any>[]> {
    let insertLayerActions: InsertLayerAction<any>[] = [];
    for (let layer of layers) {
        let parsedLayer: Partial<WorkingFileLayer<RGBAColor>> = {
            blendingMode: layer.blendingMode,
            filters: layer.filters,
            groupId: layer.groupId,
            height: layer.height,
            id: layer.id,
            name: layer.name,
            opacity: layer.opacity,
            transform: new DOMMatrix(layer.transform),
            type: layer.type,
            visible: layer.visible,
            width: layer.width,
            x: layer.x,
            y: layer.y
        };
        switch (layer.type) {
            case 'group':
                parsedLayer = {
                    ...parsedLayer,
                    type: 'group',
                    layers: []
                } as WorkingFileGroupLayer<RGBAColor>;
                insertLayerActions = insertLayerActions.concat(await parseLayersToActions((layer as SerializedFileGroupLayer<RGBAColor>).layers));
                break;
            case 'raster':
                const serializedLayer = layer as SerializedFileRasterLayer<RGBAColor>;
                const image = new Image();
                const base64Fetch = await fetch(serializedLayer.data.sourceImageSerialized || '');
                const imageBlob = await base64Fetch.blob();
                await new Promise<void>((resolve) => {
                    image.onload = () => {
                        resolve();
                    };
                    image.onerror = () => {
                        resolve();
                    };
                    image.src = URL.createObjectURL(imageBlob);
                });
                parsedLayer = {
                    ...parsedLayer,
                    type: 'raster',
                    data: {
                        sourceImage: image,
                        sourceImageIsObjectUrl: true
                    }
                } as WorkingFileRasterLayer<RGBAColor>;
                break;
            case 'vector':
                parsedLayer = {
                    ...parsedLayer,
                    type: 'vector',
                    data: (layer as SerializedFileVectorLayer<RGBAColor>).data,
                } as WorkingFileVectorLayer<RGBAColor>;
                break;
            case 'text':
                parsedLayer = {
                    ...parsedLayer,
                    type: 'text',
                    data: (layer as SerializedFileTextLayer<RGBAColor>).data,
                } as WorkingFileTextLayer<RGBAColor>;
                break;
        }
        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<RGBAColor>>(parsedLayer as InsertAnyLayerOptions<RGBAColor>)
        );
    }
    return insertLayerActions;
}
