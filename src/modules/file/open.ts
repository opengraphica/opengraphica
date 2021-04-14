/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import {
    RGBAColor, InsertRasterLayerOptions
} from '@/types';
import historyStore from '@/store/history';
import { BundleAction } from '@/actions/bundle';
import { CreateNewFileAction } from '@/actions/create-new-file';
import { InsertLayerAction } from '@/actions/insert-layer';

export async function openFromFileDialog(): Promise<void> {

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
    fileInput.multiple = true;
    temporaryFileInputContainer.appendChild(fileInput);
    await new Promise<void>((resolve, reject) => {
        fileInput.addEventListener('change', async (e: Event) => {
            isChangeFired = true;
            temporaryFileInputContainer.removeChild(fileInput);
            const files = (e.target as HTMLInputElement).files;
            if (files) {
                try {
                    await openFromFileList(files);
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

export async function openFromFileList(files: FileList) {

    type FileReadType = 'json' | 'image';
    type FileReadResolve = { type: 'image', result: HTMLImageElement, file: File } | { type: 'json', result: string, file: File };

    const readerPromises: Promise<FileReadResolve>[] = [];

    let fileName: string = '';

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];

        readerPromises.push(
            new Promise((resolveReader, rejectReader) => {
                if (!file.type.match(/^image\//) && !file.name.match(/\.json$/)) {
                    rejectReader('The file "' + file.name + '" is the wrong type. It must be an image or json file.');
                    return;
                }

                const fileReadType: FileReadType = (file.type === 'text/plain' || file.name.match(/\.json$/)) ? 'json' : 'image';

                if (!fileName) {
                    fileName = file.name;
                }

                const fileReader = new FileReader();
                fileReader.onload = async () => {
                    if (fileReadType === 'image') {
                        try {
                            const image = await new Promise<HTMLImageElement>((resolveImage, rejectImage) => {
                                const image = new Image();
                                image.onload = () => {
                                    resolveImage(image);
                                };
                                image.onerror = () => {
                                    rejectImage();
                                };
                                image.src = fileReader.result as string;
                            });
                            resolveReader({ type: 'image', result: image, file: file });
                        } catch (error) {
                            rejectReader('An error occurred while loading the image for file "' + file.name + '".');
                        }
                    } else {
                        resolveReader({ type: 'json', result: fileReader.result as string, file: file });
                    }
                };
                fileReader.onerror = () => {
                    rejectReader('An error occurred while reading the file "' + file.name + '".');
                };
                if (fileReadType === 'json') {
                    fileReader.readAsText(file);
                } else if (fileReadType === 'image') {
                    fileReader.readAsDataURL(file);
                }

            })
        );
    }

    const layerInsertActions: InsertLayerAction<any>[] = [];
    const loadErrorMessages: string[] = [];

    let largestWidth = 0;
    let largestHeight = 0;
    let isAnyLayerLoaded: boolean = false;

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
                layerInsertActions.push(
                    new InsertLayerAction<InsertRasterLayerOptions<RGBAColor>>({
                        type: 'raster',
                        name: readerSettle.value.file.name,
                        width: image.width,
                        height: image.height,
                        data: {
                            sourceImage: image,
                            sourceImageIsObjectUrl: false
                        }
                    })
                );
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

        await historyStore.dispatch('runAction', {
            action: new BundleAction('openFile', 'Open File', [
                new CreateNewFileAction({
                    fileName,
                    width: largestWidth || 1,
                    height: largestHeight || 1
                }),
                ...layerInsertActions
            ])
        });
    } else {
        throw new Error('None of the files selected could be loaded.');
    }
}