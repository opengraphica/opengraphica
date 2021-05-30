/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import {
    SerializedFile, SerializedFileLayer, WorkingFileLayer, RGBAColor, InsertAnyLayerOptions, InsertRasterLayerOptions, InsertRasterSequenceLayerOptions,
    WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer, WorkingFileTextLayer, WorkingFileAnyLayer,
    SerializedFileGroupLayer, SerializedFileRasterLayer, SerializedFileRasterSequenceLayer, SerializedFileVectorLayer, SerializedFileTextLayer
} from '@/types';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { WorkingFileState, getTimelineById } from '@/store/working-file';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import layerRenderers from '@/canvas/renderers';
import { UpdateFileAction } from '@/actions/update-file';
import { CreateFileAction } from '@/actions/create-file';
import { InsertLayerAction } from '@/actions/insert-layer';
import { knownFileExtensions } from '@/lib/regex';

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
    type FileReadResolve =
        { type: 'image', result: HTMLImageElement, file: File } |
        { type: 'imageSequence', result: { image: HTMLImageElement, duration: number }[], file: File } |
        { type: 'json', result: string, file: File };

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
                    fileName = file.name.replace(knownFileExtensions, '');
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
                    if (file.type === 'image/gif') {
                        const result: { image: HTMLImageElement, duration: number }[] = [];
                        await new Promise<void>(async (resolveImageFrames, rejectImageFrames) => {
                            // @ts-ignore
                            const SuperGif = (await import('libgif')).default;
                            const gifParent = document.createElement('div');
                            gifParent.appendChild(image);
                            const rub = new SuperGif({ gif: image });
                            rub.load(async () => {
                                const frames = rub.get_frames();
                                for (let [i, frame] of frames.entries()) {
                                    rub.move_to(i);
                                    try {
                                        const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                            const image = new Image();
                                            image.onload = () => {
                                                resolveImage(image);
                                            };
                                            image.onerror = () => {
                                                rejectImage();
                                            };
                                            rub.get_canvas().toBlob((blob: Blob) => {
                                                image.src = URL.createObjectURL(blob) as string;
                                            });
                                        });
                                        result.push({
                                            image,
                                            duration: frame.delay * 10
                                        });
                                    } catch (error) {
                                        // TODO ?
                                    }
                                }
                                resolveImageFrames();
                            });
                        });
                        if (result.length === 1) {
                            resolveReader({ type: 'image', result: result[0].image, file: file });
                        } else if (result.length > 0) {
                            resolveReader({ type: 'imageSequence', result, file: file });
                        } else {
                            rejectReader('No frames found in gif file "' + file.name + '".');
                        }
                    } else {
                        resolveReader({ type: 'image', result: image, file: file });
                    }
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
            }
            else if (readerSettle.value.type === 'imageSequence') {
                const results = readerSettle.value.result;
                const firstImage = results[0].image;
                if (firstImage.width > largestWidth) {
                    largestWidth = firstImage.width;
                }
                if (firstImage.height > largestHeight) {
                    largestHeight = firstImage.height;
                }
                let timeIterator = 0;
                const sequence: WorkingFileRasterSequenceLayer<RGBAColor>['data']['sequence'] = [];
                for (let result of results) {
                    sequence.push({
                        start: timeIterator,
                        end: timeIterator + result.duration,
                        image: {
                            sourceImage: result.image,
                            sourceImageIsObjectUrl: true
                        },
                        thumbnailImageSrc: null
                    });
                    timeIterator += result.duration;
                }
                insertLayerActions.push(
                    new InsertLayerAction<InsertRasterSequenceLayerOptions<RGBAColor>>({
                        type: 'rasterSequence',
                        name: readerSettle.value.file.name,
                        width: firstImage.width,
                        height: firstImage.height,
                        data: {
                            currentFrame: sequence[0].image,
                            sequence
                        }
                    })
                );
            }
            else if (readerSettle.value.type === 'json') {
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
        if (!options.insert) {
            await historyStore.dispatch('free', {
                memorySize: Infinity,
                databaseSize: Infinity
            });
        }
        (window as any).workingFileStore = await (await import('@/store/working-file')).default;
    } else {
        throw new Error('None of the files selected could be loaded.');
    }
}

async function parseSerializedFileToActions(serializedFile: SerializedFile<RGBAColor>): Promise<{ workingFileDefinition: Partial<WorkingFileState>, insertLayerActions: InsertLayerAction<any>[] }> {
    const workingFileDefinition: Partial<WorkingFileState> = {
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
        };
        if (layer.type === 'group') {
            parsedLayer = {
                ...parsedLayer,
                type: 'group',
                renderer: layerRenderers.group,
                expanded: false,
                layers: []
            } as WorkingFileGroupLayer<RGBAColor>;
            insertLayerActions = insertLayerActions.concat(await parseLayersToActions((layer as SerializedFileGroupLayer<RGBAColor>).layers));
        } else if (layer.type === 'raster') {
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
                renderer: layerRenderers.raster,
                data: {
                    sourceImage: image,
                    sourceImageIsObjectUrl: true
                }
            } as WorkingFileRasterLayer<RGBAColor>;
        } else if (layer.type === 'rasterSequence') {
            const serializedLayer = layer as SerializedFileRasterSequenceLayer<RGBAColor>;
            const parsedSequence: WorkingFileRasterSequenceLayer<RGBAColor>['data']['sequence'] = [];
            for (let frame of serializedLayer.data.sequence) {
                const image = new Image();
                const base64Fetch = await fetch(frame.image.sourceImageSerialized || '');
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
                parsedSequence.push({
                    start: frame.start,
                    end: frame.end,
                    image: {
                        sourceImage: image,
                        sourceImageIsObjectUrl: true
                    },
                    thumbnailImageSrc: null
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'rasterSequence',
                renderer: layerRenderers.rasterSequence,
                data: {
                    currentFrame: parsedSequence[0]?.image,
                    sequence: parsedSequence
                }
            } as WorkingFileRasterSequenceLayer<RGBAColor>;
            (window as any).parsedLayer = parsedLayer;
        } else if (layer.type === 'vector') {
            parsedLayer = {
                ...parsedLayer,
                type: 'vector',
                renderer: layerRenderers.vector,
                data: (layer as SerializedFileVectorLayer<RGBAColor>).data,
            } as WorkingFileVectorLayer<RGBAColor>;
        } else if (layer.type === 'text') {
            parsedLayer = {
                ...parsedLayer,
                type: 'text',
                renderer: layerRenderers.text,
                data: (layer as SerializedFileTextLayer<RGBAColor>).data,
            } as WorkingFileTextLayer<RGBAColor>;
        }
        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<RGBAColor>>(parsedLayer as InsertAnyLayerOptions<RGBAColor>)
        );
    }
    return insertLayerActions;
}
