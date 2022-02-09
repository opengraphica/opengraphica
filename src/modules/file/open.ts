/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import { Ref } from 'vue';
import {
    SerializedFile, SerializedFileLayer, WorkingFileLayer, ColorModel, InsertAnyLayerOptions, InsertRasterLayerOptions, InsertRasterSequenceLayerOptions,
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
    cancelRef?: Ref<boolean>;
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
                    await openFromFileList(files, options);
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

};

export async function insertFromFileDialog(options: FileDialogOpenOptions = {}) {
    return openFromFileDialog({
        ...options,
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
                try {
                    // Some images don't have the correct extension, which causes the browser to not recognize the type. Default to read as 'image';
                    const fileReadType: FileReadType = (file.type === 'text/plain' || file.name.match(/\.json$/)) ? 'json' : 'image';

                    if (!fileName) {
                        fileName = file.name.replace(knownFileExtensions, '');
                    }

                    const fileReader = new FileReader();

                    if (fileReadType === 'image') {
                        if (file.type === 'image/gif') {
                            const result: { image: HTMLImageElement, duration: number }[] = [];
                            const gifArrayBuffer = await new Promise<ArrayBuffer | null>((resolveArrayBuffer) => {
                                fileReader.onload = async () => {
                                    if (options.cancelRef && options.cancelRef.value === true) {
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
                            const canvas = document.createElement("canvas");
                            if (isNeedManualMerge) {
                                canvas.width = gif.width;
                                canvas.height = gif.height;
                            }
                            const ctx = canvas.getContext("2d");
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
                                if (options.cancelRef && options.cancelRef.value === true) {
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
                                if (options.cancelRef && options.cancelRef.value === true) {
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
                        } else if (['video/mp4', 'video/webp'].includes(file.type)) {
                            const result: { image: HTMLImageElement, duration: number }[] = [];
                            let fps: number = 25;
                            let videoObjectUrl = URL.createObjectURL(file);
                            let video = document.createElement('video');
                            let seekResolve: (value?: any) => void;
                            video.addEventListener('seeked', async function() {
                                if (seekResolve) {
                                    seekResolve();
                                }
                            });
                            video.src = videoObjectUrl;
                            while ((video.duration === Infinity || isNaN(video.duration)) && video.readyState < 2) {
                                await new Promise(r => setTimeout(r, 1000));
                                video.currentTime = 10000000 * Math.random();
                                if (options.cancelRef && options.cancelRef.value === true) {
                                    rejectReader('File open canceled.');
                                    return;
                                }
                            }
                            let duration = Math.min(5, video.duration);
                            let canvas = document.createElement('canvas');
                            let ctx = canvas.getContext('2d');
                            if (!ctx) {
                                rejectReader('Not enough memory to parse the video file "' + file.name + '".');
                                return;
                            }
                            let [w, h] = [video.videoWidth, video.videoHeight];
                            canvas.width =  w;
                            canvas.height = h;
                            let frames = [];
                            let interval = 1 / fps;
                            let currentTime = 0;
                            while (currentTime < duration) {
                                video.currentTime = currentTime;
                                await new Promise(resolveSeek => {
                                    seekResolve = resolveSeek;
                                });
                                ctx.drawImage(video, 0, 0, w, h);
                                let base64ImageData = canvas.toDataURL();
                                frames.push(base64ImageData);
                                currentTime += interval;
                                if (options.cancelRef && options.cancelRef.value === true) {
                                    rejectReader('File open canceled.');
                                    return;
                                }
                            }
                            for (let frame of frames) {
                                const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                    const image = new Image();
                                    image.onload = () => {
                                        resolveImage(image);
                                    };
                                    image.onerror = (error: any) => {
                                        rejectImage();
                                    };
                                    image.src = frame;
                                });
                                if (options.cancelRef && options.cancelRef.value === true) {
                                    rejectReader('File open canceled.');
                                    return;
                                }
                                result.push({
                                    image,
                                    duration: 1000 / fps
                                });
                            }
                            if (result.length === 1) {
                                resolveReader({ type: 'image', result: result[0].image, file: file });
                            } else if (result.length > 0) {
                                resolveReader({ type: 'imageSequence', result, file: file });
                            } else {
                                rejectReader('No frames found in video file "' + file.name + '".');
                            }
                        } else {
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
                    }
                    else if (fileReadType === 'json') {
                        fileReader.onload = async () => {
                            if (options.cancelRef && options.cancelRef.value === true) {
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
                    console.error(error);
                    rejectReader('An error occurred while parsing the file.' + error);
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
                const sequence: WorkingFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
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
        if (files.length > 1) {
            throw new Error('None of the files selected could be loaded.');
        } else {
            throw new Error(loadErrorMessages[0] + '');
        }
    }
}

async function parseSerializedFileToActions(serializedFile: SerializedFile<ColorModel>): Promise<{ workingFileDefinition: Partial<WorkingFileState>, insertLayerActions: InsertLayerAction<any>[] }> {
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

async function parseLayersToActions(layers: SerializedFileLayer<ColorModel>[]): Promise<InsertLayerAction<any>[]> {
    let insertLayerActions: InsertLayerAction<any>[] = [];
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
        if (layer.type === 'group') {
            parsedLayer = {
                ...parsedLayer,
                type: 'group',
                renderer: layerRenderers.group,
                expanded: false,
                layers: []
            } as WorkingFileGroupLayer<ColorModel>;
            insertLayerActions = insertLayerActions.concat(await parseLayersToActions((layer as SerializedFileGroupLayer<ColorModel>).layers));
        } else if (layer.type === 'raster') {
            const serializedLayer = layer as SerializedFileRasterLayer<ColorModel>;
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
            } as WorkingFileRasterLayer<ColorModel>;
        } else if (layer.type === 'rasterSequence') {
            const serializedLayer = layer as SerializedFileRasterSequenceLayer<ColorModel>;
            const parsedSequence: WorkingFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
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
            } as WorkingFileRasterSequenceLayer<ColorModel>;
            (window as any).parsedLayer = parsedLayer;
        } else if (layer.type === 'vector') {
            parsedLayer = {
                ...parsedLayer,
                type: 'vector',
                renderer: layerRenderers.vector,
                data: (layer as SerializedFileVectorLayer<ColorModel>).data,
            } as WorkingFileVectorLayer<ColorModel>;
        } else if (layer.type === 'text') {
            parsedLayer = {
                ...parsedLayer,
                type: 'text',
                renderer: layerRenderers.text,
                data: (layer as SerializedFileTextLayer<ColorModel>).data,
            } as WorkingFileTextLayer<ColorModel>;
        }
        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<ColorModel>>(parsedLayer as InsertAnyLayerOptions<ColorModel>)
        );
    }
    return insertLayerActions;
}
