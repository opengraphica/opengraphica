/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import { nextTick, type Ref } from 'vue';

import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import { createStoredImage } from '@/store/image';
import { createStoredSvg } from '@/store/svg';
import { createStoredVideo } from '@/store/video';
import preferencesStore from '@/store/preferences';
import workingFileStore, {
    getCanvasRenderingContext2DSettings, calculateLayerOrder, discardAllUnusedMasks, type WorkingFileState
} from '@/store/working-file';
import { readWorkingFile } from '@/store/data/working-file-database';
import { discardActiveSelectionMask, discardAppliedSelectionMask, activeSelectionPath } from '@/canvas/store/selection-state';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateFileAction } from '@/actions/update-file';
import { CreateFileAction } from '@/actions/create-file';
import { InsertLayerAction } from '@/actions/insert-layer';

import { knownFileExtensions } from '@/lib/regex';
import { createBlobFromDataUri } from '@/lib/binary';
import appEmitter from '@/lib/emitter';

import type {
    ShowOpenFilePicker, FileSystemFileHandle,
    SerializedFile, SerializedFileLayer, WorkingFileLayer, ColorModel,
    InsertAnyLayerOptions, InsertRasterLayerOptions, InsertRasterSequenceLayerOptions, InsertVectorLayerOptions, InsertVideoLayerOptions,
    WorkingFileLayerMask, WorkingFileEmptyLayer, WorkingFileGradientLayer, WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer,
    WorkingFileTextLayer, WorkingFileVectorLayer, WorkingFileVideoLayer, SerializedFileGradientLayer, SerializedFileGroupLayer,
    SerializedFileRasterLayer, SerializedFileRasterSequenceLayer, SerializedFileTextLayer, SerializedFileVectorLayer, SerializedFileVideoLayer
} from '@/types';

declare global {
    var showOpenFilePicker: ShowOpenFilePicker;
}

interface FileDialogOpenOptions {
    insert?: boolean; // False will create a new document, true inserts into current document.
    accept?: string; // Mime type of files to accept, same as input "accept" attribute.
    cancelRef?: Ref<boolean>;
    fileDiscardConfirmed?: boolean;
}

interface FileListOpenOptions {
    files?: FileList | Array<File>;
    dialogOptions?: FileDialogOpenOptions;
}

export async function openFromFileDialog(options: FileDialogOpenOptions = {}): Promise<void> {

    if (!options.insert && !options?.fileDiscardConfirmed && historyStore.get('hasUnsavedChanges')) {
        const { runModule } = await import('@/modules');
        runModule('file', 'openConfirm');
        return;
    }

    // We're working with new APIs
    if (window.isSecureContext && window.showOpenFilePicker) {
        const fileHandles = await window.showOpenFilePicker({
            types: [
                {
                    description: 'Images / Videos',
                    accept: {
                        'text/plain': ['.json'],
                        'image/*': [],
                        'video/*': []
                    }
                }
            ]
        });
        const files: File[] = [];
        let firstFileHandle: FileSystemFileHandle | null = null;
        for (const fileHandle of fileHandles) {
            if (fileHandle.kind === 'file') {
                if (!firstFileHandle) {
                    firstFileHandle = fileHandle as FileSystemFileHandle;
                }
                files.push(await (fileHandle as FileSystemFileHandle).getFile());
            }
        }
        if (files.length > 0) {
            await openFromFileList({ files, dialogOptions: options });
            if (!options.insert && firstFileHandle) {
                workingFileStore.set('fileHandle', firstFileHandle);
            }
        }
    }

    // Peasant old Javascript manual labor.
    else {
        // This container and the file input is purposely left in the dom after creation in order to avoid
        // several bugs revolving around the fact that browsers give you no information if file selection is canceled.
        let temporaryFileInputContainer = document.getElementById('og-tmp-file-input-container') as HTMLDivElement;
        if (!temporaryFileInputContainer) {
            temporaryFileInputContainer = document.createElement('div');
            temporaryFileInputContainer.id = 'og-tmp-file-input-container';
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
        fileInput.setAttribute('accept', options.accept || '.json,image/*,video/*');
        fileInput.setAttribute('aria-hidden', 'true');
        fileInput.multiple = true;
        temporaryFileInputContainer.appendChild(fileInput);
        await new Promise<void>((resolve, reject) => {
            let activeElement = document.activeElement;
            const checkFocusInterval = setInterval(() => {
                if (activeElement !== document.activeElement) {
                    onFocusAway();
                }
            }, 100);
            fileInput.addEventListener('change', async (e: Event) => {
                clearInterval(checkFocusInterval);
                window.removeEventListener('focus', onFocusAway);
                isChangeFired = true;
                temporaryFileInputContainer.removeChild(fileInput);
                const files = (e.target as HTMLInputElement).files;
                if (files) {
                    try {
                        await openFromFileList({ files, dialogOptions: options });
                        resolve();
                    } catch (error: any) {
                        reject(error);
                    }
                } else {
                    resolve();
                }
            });
            const onFocusAway = () => {
                clearInterval(checkFocusInterval);
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
    }

};

export async function openFromTemporaryStorage() {
    appEmitter.emit('app.workingFile.detachAllLayers');
    const workingFile = await readWorkingFile();
    workingFileStore.set('background', workingFile.background);
    workingFileStore.set('colorModel', workingFile.colorModel);
    workingFileStore.set('colorSpace', workingFile.colorSpace);
    workingFileStore.set('drawOriginX', workingFile.drawOriginX);
    workingFileStore.set('drawOriginY', workingFile.drawOriginY);
    workingFileStore.set('height', workingFile.height);
    workingFileStore.set('layerIdCounter', workingFile.layerIdCounter);
    workingFileStore.set('masks', workingFile.masks);
    workingFileStore.set('maskIdCounter', workingFile.maskIdCounter);
    workingFileStore.set('measuringUnits', workingFile.measuringUnits);
    workingFileStore.set('resolutionUnits', workingFile.resolutionUnits);
    workingFileStore.set('resolutionX', workingFile.resolutionX);
    workingFileStore.set('resolutionY', workingFile.resolutionY);
    workingFileStore.set('scaleFactor', workingFile.scaleFactor);
    workingFileStore.set('selectedLayerIds', workingFile.selectedLayerIds);
    workingFileStore.set('width', workingFile.width);
    workingFileStore.set('layers', workingFile.layers);
    discardActiveSelectionMask();
    discardAppliedSelectionMask();
    discardAllUnusedMasks();
    calculateLayerOrder();
    activeSelectionPath.value = [];
    await historyStore.dispatch('free', {
        memorySize: Infinity,
        databaseSize: Infinity
    });
    await nextTick();
    appEmitter.emit('app.canvas.resetTransform');
}

export async function insertFromFileDialog(options: FileDialogOpenOptions = {}) {
    return openFromFileDialog({
        ...options,
        insert: true,
        accept: 'image/*'
    });
}

export async function openFromFileList({ files, dialogOptions }: FileListOpenOptions = {}) {
    if (!files) return;
    if (!dialogOptions) dialogOptions = {};

    type FileReadType = 'json' | 'media';
    type FileReadResolve =
        { type: 'image', result: HTMLImageElement, file: File } |
        { type: 'imageSequence', result: { image: HTMLImageElement, duration: number }[], file: File } |
        { type: 'json', result: string, file: File } |
        { type: 'svg', result: HTMLImageElement, file: File } |
        { type: 'video', result: HTMLVideoElement, file: File};

    const readerPromises: Promise<FileReadResolve>[] = [];

    let fileName: string = '';

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];

        readerPromises.push(
            new Promise(async (resolveReader, rejectReader) => {
                try {
                    // Some images don't have the correct extension, which causes the browser to not recognize the type. Default to read as 'image';
                    const fileReadType: FileReadType = (file.type === 'text/plain' || file.name.match(/\.json$/)) ? 'json' : 'media';

                    if (!fileName) {
                        fileName = file.name.replace(knownFileExtensions, '');
                    }

                    const fileReader = new FileReader();

                    if (fileReadType === 'media') {
                        if (file.type === 'image/gif') {
                            const result: { image: HTMLImageElement, duration: number }[] = [];
                            const gifArrayBuffer = await new Promise<ArrayBuffer | null>((resolveArrayBuffer) => {
                                fileReader.onload = async () => {
                                    if (dialogOptions?.cancelRef?.value === true) {
                                        rejectReader('File open canceled.');
                                        resolveArrayBuffer(null);
                                    } else {
                                        resolveArrayBuffer(fileReader.result as ArrayBuffer);
                                    }
                                };
                                fileReader.onerror = () => {
                                    rejectReader('An error occurred while reading the file "' + file.name + '".');
                                    resolveArrayBuffer(null);
                                };
                                fileReader.readAsArrayBuffer(file);
                            });
                            if (gifArrayBuffer === null) {
                                return;
                            }
                            const { Gif, GifPresenter } = await import('gifken');
                            const gif = Gif.parse(gifArrayBuffer);
                            let isNeedManualMerge: boolean = false;
                            let gifSplit: Array<InstanceType<typeof Gif>>;
                            try {
                                gifSplit = gif.split(true);
                            } catch (error: any) {
                                isNeedManualMerge = true;
                                gifSplit = gif.split(false);
                            }
                            const canvas = document.createElement('canvas');
                            if (isNeedManualMerge) {
                                canvas.width = gif.width;
                                canvas.height = gif.height;
                            }
                            const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
                            if (!ctx) {
                                rejectReader('Not enough memory to parse the gif file "' + file.name + '".');
                                return;
                            }
                            if (isNeedManualMerge) {
                                ctx.clearRect(0, 0, gif.width, gif.height);
                            }
                            const gifFrameImage = new Image();
                            for (let [i, frame] of gif.frames.entries()) {
                                if (isNeedManualMerge) {
                                    await new Promise<void>((resolveImage, rejectImage) => {
                                        gifFrameImage.onload = () => {
                                            resolveImage();
                                        };
                                        gifFrameImage.onerror = (error: any) => {
                                            rejectImage();
                                        };
                                        gifFrameImage.src = GifPresenter.writeToDataUrl(gifSplit[i].writeToArrayBuffer());
                                    });
                                    ctx.drawImage(gifFrameImage, 0, 0);
                                    gifFrameImage.src = '';
                                }
                                if (dialogOptions?.cancelRef?.value === true) {
                                    rejectReader('File open canceled.');
                                    return;
                                }
                                const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                    const image = new Image();
                                    image.onload = () => {
                                        resolveImage(image);
                                    };
                                    image.onerror = (error: any) => {
                                        rejectImage();
                                    };
                                    if (isNeedManualMerge) {
                                        canvas.toBlob((blob) => {
                                            if (blob) {
                                                image.src = URL.createObjectURL(blob);
                                            }
                                        }, 'image/png');
                                    } else {
                                        image.src = URL.createObjectURL(GifPresenter.writeToBlob(gifSplit[i].writeToArrayBuffer()));
                                    }
                                });
                                // @ts-ignore 2365
                                if (dialogOptions?.cancelRef?.value === true) {
                                    rejectReader('File open canceled.');
                                    return;
                                }
                                result.push({
                                    image,
                                    duration: frame.delayCentiSeconds * 10
                                });
                            }
                            if (result.length === 1) {
                                resolveReader({ type: 'image', result: result[0].image, file: file });
                            } else if (result.length > 0) {
                                resolveReader({ type: 'imageSequence', result, file: file });
                            } else {
                                rejectReader('No frames found in gif file "' + file.name + '".');
                            }
                        } else if (file.type.startsWith('video/')) {
                            let videoObjectUrl = URL.createObjectURL(file);
                            let video = document.createElement('video');
                            await new Promise<void>((resolve, reject) => {
                                video.addEventListener('loadedmetadata', function() {
                                    resolve();
                                    video.currentTime = 0;
                                });
                                video.addEventListener('error', function(error) {
                                    reject(error.toString());
                                });
                                video.src = videoObjectUrl;
                            });
                            resolveReader({ type: 'video', result: video, file: file });
                        } else if (file.type === 'image/svg+xml') {
                            const fileContents = await new Promise<string>((resolveFileContents, rejectFileContents) => {
                                fileReader.onload = async () => {
                                    resolveFileContents(fileReader.result as string);
                                };
                                fileReader.onerror = () => {
                                    rejectReader('An error occurred while reading the file "' + file.name + '".');
                                };
                                fileReader.readAsText(file);
                            });
                            const xmlParser = new DOMParser();
                            const svgDocument = xmlParser.parseFromString(fileContents, 'text/xml');
                            const svgElement = svgDocument.querySelector('svg');
                            svgElement?.setAttribute('preserveAspectRatio', 'none');
                            const xmlSerializer = new XMLSerializer();
                            const modifiedSvgString = xmlSerializer.serializeToString(svgDocument);
                            const blob = new Blob([modifiedSvgString], { type: 'image/svg+xml' });
                            const modifiedFile = new File([blob], file.name, { type: 'image/svg+xml' });
                            const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                const image = new Image();
                                image.onload = () => {
                                    resolveImage(image);
                                };
                                image.onerror = (error) => {
                                    rejectImage(error);
                                };
                                image.src = URL.createObjectURL(modifiedFile) as string;
                            });
                            resolveReader({ type: 'svg', result: image, file: file });
                        } else {
                            const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                const image = new Image();
                                image.onload = () => {
                                    resolveImage(image);
                                };
                                image.onerror = (error) => {
                                    rejectImage(error);
                                };
                                image.src = URL.createObjectURL(file) as string;
                            });
                            resolveReader({ type: 'image', result: image, file: file });
                        }
                    }
                    else if (fileReadType === 'json') {
                        fileReader.onload = async () => {
                            if (dialogOptions?.cancelRef?.value === true) {
                                rejectReader('File open canceled.');
                            } else {
                                resolveReader({ type: 'json', result: fileReader.result as string, file: file });
                            }
                        };
                        fileReader.onerror = () => {
                            rejectReader('An error occurred while reading the file "' + file.name + '".');
                        };
                        fileReader.readAsText(file);
                    }
                } catch (error: any) {
                    rejectReader('An error occurred while parsing the file. ' + error?.toString());
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
                    new InsertLayerAction<InsertRasterLayerOptions<ColorModel>>({
                        type: 'raster',
                        name: readerSettle.value.file.name,
                        width: image.width,
                        height: image.height,
                        data: {
                            sourceUuid: await createStoredImage(image),
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
                const sequence: WorkingFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
                for (let result of results) {
                    sequence.push({
                        start: timeIterator,
                        end: timeIterator + result.duration,
                        image: {
                            sourceUuid: await createStoredImage(result.image),
                        },
                        thumbnailImageSrc: null
                    });
                    timeIterator += result.duration;
                }
                insertLayerActions.push(
                    new InsertLayerAction<InsertRasterSequenceLayerOptions<ColorModel>>({
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
            else if (readerSettle.value.type === 'svg') {
                const image = readerSettle.value.result;
                if (image.width > largestWidth) {
                    largestWidth = image.width;
                }
                if (image.height > largestHeight) {
                    largestHeight = image.height;
                }
                insertLayerActions.push(
                    new InsertLayerAction<InsertVectorLayerOptions<ColorModel>>({
                        type: 'vector',
                        name: readerSettle.value.file.name,
                        width: image.width,
                        height: image.height,
                        data: {
                            sourceUuid: await createStoredSvg(image),
                        }
                    })
                );
            }
            else if (readerSettle.value.type === 'video') {
                const video = readerSettle.value.result;
                if (video.videoWidth > largestWidth) {
                    largestWidth = video.videoWidth;
                }
                if (video.videoHeight > largestHeight) {
                    largestHeight = video.videoHeight;
                }
                insertLayerActions.push(
                    new InsertLayerAction<InsertVideoLayerOptions<ColorModel>>({
                        type: 'video',
                        name: readerSettle.value.file.name,
                        width: video.videoWidth,
                        height: video.videoHeight,
                        data: {
                            sourceUuid: await createStoredVideo(video),
                        }
                    })
                );
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
        if (dialogOptions.insert) {
            if (workingFileStore.state.layers.length === 0 && editorStore.get('isUsingAutoGeneratedFile')) {
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
            action: new BundleAction('openFile', 'action.openFile', [
                ...fileUpdateActions,
                ...insertLayerActions
            ])
        });
        if (!dialogOptions.insert) {
            await historyStore.dispatch('free', {
                memorySize: Infinity,
                databaseSize: Infinity
            });
        }
        (window as any).workingFileStore = await (await import('@/store/working-file')).default;
    } else {
        if (files.length > 1) {
            throw new Error('None of the files selected could be loaded.');
        } else {
            throw new Error(loadErrorMessages[0] + '');
        }
    }
}

async function parseSerializedFileToActions(serializedFile: SerializedFile<ColorModel>): Promise<{ workingFileDefinition: Partial<WorkingFileState>, insertLayerActions: InsertLayerAction<any>[] }> {
    const serializedMasks = serializedFile.masks;
    const masks: Record<number, WorkingFileLayerMask> = {};
    for (const maskId of Object.keys(serializedFile.masks ?? {}).map(key => parseInt(key))) {
        masks[maskId] = {
            sourceUuid: await parseDataUrlToStoredImage(serializedMasks[maskId].sourceImageSerialized),
            hash: serializedMasks[maskId].hash,
            offset: serializedMasks[maskId].offset,
        };
    }

    const workingFileDefinition: Partial<WorkingFileState> = {
        background: serializedFile.background,
        colorModel: serializedFile.colorModel,
        colorSpace: serializedFile.colorSpace,
        drawOriginX: serializedFile.drawOriginX,
        drawOriginY: serializedFile.drawOriginY,
        height: serializedFile.height,
        layerIdCounter: serializedFile.layerIdCounter,
        masks,
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

async function parseDataUrlToStoredImage(dataUrl: string): Promise<string> {
    const image = new Image();
    const base64Fetch = await fetch(dataUrl);
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
    return await createStoredImage(image);
}

async function parseLayersToActions(layers: SerializedFileLayer<ColorModel>[]): Promise<InsertLayerAction<any>[]> {
    let insertLayerActions: InsertLayerAction<any>[] = [];
    let groupInsertLayerActions: InsertLayerAction<any>[] = [];
    for (let layer of layers) {
        let parsedLayer: Partial<WorkingFileLayer<ColorModel>> = {
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
        if (layer.type === 'empty') {
            parsedLayer = {
                ...parsedLayer,
                type: 'empty',
            } as WorkingFileEmptyLayer<ColorModel>;
        }
        else if (layer.type === 'gradient') {
            parsedLayer = {
                ...parsedLayer,
                type: 'gradient',
                data: (layer as SerializedFileGradientLayer<ColorModel>).data,
            } as WorkingFileGradientLayer<ColorModel>;
        }
        else if (layer.type === 'group') {
            parsedLayer = {
                ...parsedLayer,
                type: 'group',
                expanded: (layer as SerializedFileGroupLayer<ColorModel>).expanded,
                layers: []
            } as WorkingFileGroupLayer<ColorModel>;
            groupInsertLayerActions = groupInsertLayerActions.concat(await parseLayersToActions((layer as SerializedFileGroupLayer<ColorModel>).layers));
        }
        else if (layer.type === 'raster') {
            const serializedLayer = layer as SerializedFileRasterLayer<ColorModel>;
            parsedLayer = {
                ...parsedLayer,
                type: 'raster',
                data: {
                    sourceUuid: await parseDataUrlToStoredImage(serializedLayer.data.sourceImageSerialized || ''),
                }
            } as WorkingFileRasterLayer<ColorModel>;
        }
        else if (layer.type === 'rasterSequence') {
            const serializedLayer = layer as SerializedFileRasterSequenceLayer<ColorModel>;
            const parsedSequence: WorkingFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
            for (let frame of serializedLayer.data.sequence) {
                parsedSequence.push({
                    start: frame.start,
                    end: frame.end,
                    image: {
                        sourceUuid: await parseDataUrlToStoredImage(frame.image.sourceImageSerialized || ''),
                    },
                    thumbnailImageSrc: null
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'rasterSequence',
                data: {
                    currentFrame: parsedSequence[0]?.image,
                    sequence: parsedSequence
                }
            } as WorkingFileRasterSequenceLayer<ColorModel>;
            (window as any).parsedLayer = parsedLayer;
        }
        else if (layer.type === 'vector') {
            const serializedLayer = layer as SerializedFileVectorLayer<ColorModel>;
            let image: HTMLImageElement | undefined;
            if (serializedLayer?.data?.sourceSvgSerialized) {
                image = new Image();
                await new Promise<void>((resolve) => {
                    image!.onload = () => {
                        resolve();
                    };
                    image!.onerror = () => {
                        resolve();
                    };
                    image!.src = URL.createObjectURL(
                        createBlobFromDataUri(serializedLayer.data.sourceSvgSerialized!)
                    );
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'vector',
                data: {
                    sourceUuid: image ? await createStoredSvg(image) : undefined,
                },
            } as WorkingFileVectorLayer<ColorModel>;
        }
        else if (layer.type === 'video') {
            const serializedLayer = layer as SerializedFileVideoLayer<ColorModel>;
            let video: HTMLVideoElement | undefined;
            if (serializedLayer?.data?.sourceVideoSerialized) {
                video = document.createElement('video');
                await new Promise<void>((resolve) => {
                    video!.addEventListener('loadeddata', () => {
                        let hasResolved = false;
                        video!.addEventListener('playing', () => {
                            video!.pause();
                            video!.currentTime = 0;
                            if (!hasResolved) {
                                clearTimeout(playStartTimeout);
                                resolve();
                            }
                        }, { once: true });
                        video!.play();
                        let playStartTimeout = setTimeout(() => {
                            hasResolved = true;
                            resolve();
                        }, 1000);
                    }, { once: true });
                    video!.addEventListener('error', (error) => {
                        console.error(error);
                        resolve();
                    }, { once: true });
                    video!.src = URL.createObjectURL(
                        createBlobFromDataUri(serializedLayer.data.sourceVideoSerialized!)
                    );
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'video',
                data: {
                    sourceUuid: video ? await createStoredVideo(video) : undefined,
                },
            } as WorkingFileVideoLayer<ColorModel>;
        }
        else if (layer.type === 'text') {
            parsedLayer = {
                ...parsedLayer,
                type: 'text',
                data: (layer as SerializedFileTextLayer<ColorModel>).data,
            } as WorkingFileTextLayer<ColorModel>;
        } 
        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<ColorModel>>(parsedLayer as InsertAnyLayerOptions<ColorModel>)
        );
    }
    insertLayerActions = insertLayerActions.concat(groupInsertLayerActions);
    return insertLayerActions;
}
