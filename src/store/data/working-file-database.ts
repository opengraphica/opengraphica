import { reactive, toRaw } from 'vue';

import appEmitter from '@/lib/emitter';
import { deepToRaw } from '@/lib/vue';

import { prepareStoredImageForEditing, reserveStoredImage, createStoredImage } from '@/store/image';
import { getStoredSvgDataUrl, createStoredSvg } from '@/store/svg';
import { createImageBlobFromCanvas, createImageFromBlob } from '@/lib/image';
import { getStoredVideoDataUrl, createStoredVideo } from '@/store/video';

import type {
    ColorModel, WorkingFile, WorkingFileLayerMask, WorkingFileGroupLayer, WorkingFileLayer, WorkingFileAnyLayer,
    WorkingFileGradientLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer,
    WorkingFileVectorLayer, SerializedFileVectorLayer, WorkingFileVideoLayer, SerializedFileVideoLayer,
} from '@/types';

interface DatabaseMetaLayer {
    id: number;
    layers: DatabaseMetaLayer[];
}
interface DatabaseMeta {
    id: string;
    data: any;
}
interface DatabaseImage {
    id: string;
    data: any;
}

let database: IDBDatabase | null = null;
let databaseInitPromise: Promise<void> | null = null;

export async function init() {
    if (!databaseInitPromise) {
        databaseInitPromise = new Promise<void>(async (resolveInit) => {
            try {
                if (window.indexedDB) {
                    // Initialize database
                    await new Promise<void>((resolve, reject) => {
                        let openRequest = window.indexedDB.open('workingFileStore', 1);
                        openRequest.onupgradeneeded = function(event) {
                            database = openRequest.result as IDBDatabase;
                            switch (event.oldVersion) {
                                case 0:
                                    database.createObjectStore('meta', { keyPath: 'id' });
                                    database.createObjectStore('layers', { keyPath: 'id' });
                                    database.createObjectStore('images', { keyPath: 'id' });
                                    break;
                            }
                        };
                        openRequest.onerror = () => {
                            reject(openRequest.error);
                        }
                        openRequest.onsuccess = () => {
                            resolve();
                            database = openRequest.result as IDBDatabase;
                        }
                    });
                    if (!database) {
                        throw new Error('indexedDB not initialized');
                    }
                }
            } catch (error) {}
            resolveInit();
        });
        await databaseInitPromise;
    } else if (!database) {
        await databaseInitPromise;
    }
};

/** Converts layers array to the database meta format, that only contains hierarcy information. */
function convertWorkingFileLayersToMeta(layers: WorkingFileLayer[]): DatabaseMetaLayer[] {
    let metaLayers: DatabaseMetaLayer[] = [];
    for (const layer of layers) {
        const layerInfo: DatabaseMetaLayer = {
            id: layer.id,
            layers: [],
        };
        metaLayers.push(layerInfo);
        if (layer.type === 'group' && (layer as WorkingFileGroupLayer).layers) {
            layerInfo.layers = convertWorkingFileLayersToMeta((layer as WorkingFileGroupLayer).layers);
        }
    }
    return metaLayers;
}

/** Stores all working file layers in the database */
async function storeLayersRecursive(layers: WorkingFileLayer[]) {
    const putRequests: Promise<Event | void>[] = [];
    for (const layer of layers) {
        putRequests.push(updateWorkingFileLayer(layer, true));

        if (layer.type === 'group') {
            putRequests.push(
                storeLayersRecursive((layer as WorkingFileGroupLayer).layers)
            );
        }
    }

    await Promise.all(putRequests);
}

async function readStoredImage(sourceUuid: string) {
    const transaction = (database as IDBDatabase).transaction('images', 'readonly');
    const imagesStore = transaction.objectStore('images');
    const getImageRequest = imagesStore.get(sourceUuid);
    const imageBlob = await new Promise<DatabaseImage>((resolve, reject) => {
        getImageRequest.onsuccess = () => {
            resolve(getImageRequest.result);
        };
        getImageRequest.onerror = reject;
    });
    const image = await createImageFromBlob(imageBlob.data);
    const imageUuid = await createStoredImage(image);
    return imageUuid;
}

async function readStoredLayersRecursive(metaLayers: DatabaseMetaLayer[], workingFile: Partial<WorkingFile>): Promise<WorkingFileAnyLayer[]> {
    const layers: WorkingFileAnyLayer[] = reactive([]);
    for (const metaLayer of metaLayers) {
        const transaction = (database as IDBDatabase).transaction('layers', 'readonly');
        const layersStore = transaction.objectStore('layers');
        const layerRequest = layersStore.get(metaLayer.id);
        const layerResult = await new Promise<WorkingFileAnyLayer>((resolve, reject) => {
            layerRequest.onsuccess = () => {
                resolve(layerRequest.result);
            },
            layerRequest.onerror = reject;
        });
        const transformArray: number[] = layerResult.transform as never;
        layerResult.transform = new DOMMatrix(transformArray);
        if (layerResult.type === 'group') {
            (layerResult as WorkingFileGroupLayer).layers = await readStoredLayersRecursive(metaLayer.layers, workingFile);
        } else if (layerResult.type === 'raster') {
            const rasterLayer = layerResult as WorkingFileRasterLayer;
            if (rasterLayer.data.sourceUuid) {
                try {
                    const imageUuid = await readStoredImage(rasterLayer.data.sourceUuid);
                    reserveStoredImage(imageUuid, `${layerResult.id}`);
                    rasterLayer.data.sourceUuid = imageUuid;
                } catch (error) {
                    console.warn('[src/store/data/working-file-database.ts] Failed to read a layer\'s source image from the store.');
                }
            }
        } else if (layerResult.type === 'rasterSequence') {
            const rasterSequenceLayer = layerResult as WorkingFileRasterSequenceLayer;
            for (const frame of rasterSequenceLayer.data.sequence) {
                if (frame.image.sourceUuid) {
                    try {
                        const imageUuid = await readStoredImage(frame.image.sourceUuid);
                        reserveStoredImage(imageUuid, `${layerResult.id}`);
                        frame.image.sourceUuid = imageUuid;
                    } catch (error) {
                        console.warn('[src/store/data/working-file-database.ts] Failed to read a layer\'s source image from the store.');
                    }
                }
            }
        } else if (layerResult.type === 'vector') {
            const vectorLayer = layerResult as WorkingFileVectorLayer;
            const serializedVectorLayer = layerResult as unknown as SerializedFileVectorLayer;
            if (serializedVectorLayer?.data?.sourceSvgSerialized) {
                const image = new Image();
                image.src = serializedVectorLayer.data.sourceSvgSerialized;
                vectorLayer.data.sourceUuid = await createStoredSvg(image);
            }
        } else if (layerResult.type === 'video') {
            const videoLayer = layerResult as WorkingFileVideoLayer;
            const serializedVideoLayer = layerResult as unknown as SerializedFileVideoLayer;
            if (serializedVideoLayer?.data?.sourceVideoSerialized) {
                const video = document.createElement('video');
                video.src = serializedVideoLayer.data.sourceVideoSerialized;
                videoLayer.data.sourceUuid = await createStoredVideo(video);
            }
        }

        if (workingFile.masks) {
            for (const filter of layerResult.filters) {
                if (filter.maskId != null) {
                    const mask = workingFile.masks[filter.maskId];
                    if (mask) {
                        reserveStoredImage(mask.sourceUuid, `${layerResult.id}`);
                    }
                }
            }
        }

        layers.push(layerResult);
    }
    for (const layer of layers) {
        appEmitter.emit('app.workingFile.layerAttached', layer);
    }
    return layers;
}

/** Clears all database tables */
export async function deleteWorkingFile() {
    await init();
    if (!database) return;

    // Clear all the existing object stores
    const transaction = database.transaction(['meta', 'layers', 'images'], 'readwrite');
    const metaStore = transaction.objectStore('meta');
    let request = metaStore.clear();
    await new Promise((resolve) => {
        request.onsuccess = resolve;
        request.onerror = resolve;
    });
    const layersStore = transaction.objectStore('layers');
    request = layersStore.clear();
    await new Promise((resolve) => {
        request.onsuccess = resolve;
        request.onerror = resolve;
    });
    const imagesStore = transaction.objectStore('images');
    request = imagesStore.clear();
    await new Promise((resolve) => {
        request.onsuccess = resolve;
        request.onerror = resolve;
    });
}

/** Delete layer from database by id */
export async function deleteWorkingFileLayer(id: number) {
    await init();
    if (!database) return;

    const transaction = database.transaction('layers', 'readwrite');
    const layersStore = transaction.objectStore('layers');
    const request = layersStore.delete(id);
    await new Promise((resolve) => {
        request.onsuccess = resolve;
        request.onerror = resolve;
    });
}

/** Writes the working file to the database */
export async function writeWorkingFile(workingFile: WorkingFile<ColorModel>) {
    await init();
    if (!database) return;

    // Clear all the existing object stores
    await deleteWorkingFile();

    try {
        // Store the meta data (root object properties) of the file
        const transaction = (database as IDBDatabase).transaction('meta', 'readwrite');
        const metaStore = transaction.objectStore('meta');
        for (const key in workingFile) {
            const value = toRaw(workingFile[key as keyof WorkingFile<ColorModel>]);
            let request: IDBRequest<IDBValidKey>;
            if (key === 'layers') {
                request = metaStore.put({
                    id: 'layers',
                    data: convertWorkingFileLayersToMeta(value as WorkingFileLayer[])
                });
            } else {
                request = metaStore.put({ id: key, data: value });
            }
            await new Promise((resolve, reject) => {
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }

        // Store each layer as a flat object in the layers store
        await storeLayersRecursive(workingFile.layers);
    } catch (error) {
        await deleteWorkingFile();
        throw error;
    }
};

export async function updateWorkingFileMasks(masks: Record<number, WorkingFileLayerMask>, maskIdCounter: number) {
    await init();
    if (!database) return;
    try {
        const transaction = (database as IDBDatabase).transaction('meta', 'readwrite');
        const metaStore = transaction.objectStore('meta');
        let request = metaStore.put({ id: 'masks', data: toRaw(masks) });
        await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        request = metaStore.put({ id: 'maskIdCounter', data: maskIdCounter });
        await new Promise((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
        });
    } catch (error) {
        throw error;
    }
}

/* Updates the meta data of the working file in the database */
export async function updateWorkingFile(workingFile: Partial<WorkingFile<ColorModel>>) {
    await init();
    if (!database) return;

    try {
        const updatePromises: Promise<unknown>[] = [];

        // Store the meta data (root object properties) of the file
        const transaction = (database as IDBDatabase).transaction('meta', 'readwrite');
        const metaStore = transaction.objectStore('meta');
        for (const key in workingFile) {
            const value = toRaw(workingFile[key as keyof WorkingFile<ColorModel>]);
            let request: IDBRequest<IDBValidKey>;
            if (key === 'layers') {
                request = metaStore.put({
                    id: 'layers',
                    data: convertWorkingFileLayersToMeta(value as WorkingFileLayer[])
                });
            } else {
                request = metaStore.put({ id: key, data: value });
            }
            updatePromises.push(new Promise((resolve, reject) => {
                request.onsuccess = resolve;
                request.onerror = reject;
            }));
        }

        await Promise.all(updatePromises);
    } catch (error) {
        throw error;
    }
}

let updateWorkingFileLayerRequestIds = new Map<number, number>();

export async function updateWorkingFileLayer(layer: WorkingFileLayer, assumeIsNew: boolean = false, workingFile?: Partial<WorkingFile>): Promise<void> {
    const requestId = Math.random();
    updateWorkingFileLayerRequestIds.set(layer.id, requestId);

    await init();
    if (!database) throw new Error('Database not created.');

    const putRequests: Promise<Event | void>[] = [];

    let existingLayer: WorkingFileLayer | null = null;
    if (!assumeIsNew) {
        const transaction = (database as IDBDatabase).transaction('layers', 'readonly');
        const layersStore = transaction.objectStore('layers');
        const request = layersStore.get(layer.id);
        await new Promise<Event | void>((resolve) => {
            request.onsuccess = () => {
                existingLayer = request.result;
                resolve();
            }
            request.onerror = resolve;
        });
    }
    if (updateWorkingFileLayerRequestIds.get(layer.id) !== requestId) return;

    const storedLayer: Record<string, any> = { ...layer, data: { ...(layer as any).data ?? {} } };
    storedLayer.thumbnailImageSrc = null;
    storedLayer.drafts = null;
    storedLayer.bakedImage = null;
    storedLayer.isBaking = false;
    storedLayer.transform = [layer.transform.a, layer.transform.b, layer.transform.c, layer.transform.d, layer.transform.e, layer.transform.f];
    delete storedLayer.renderer;
    delete storedLayer.layers;
    if (storedLayer.type === 'raster') {
        const storedRasterLayer = storedLayer as WorkingFileRasterLayer;
        delete storedRasterLayer.data.tileUpdates;
        const originalSourceUuid = (existingLayer as any)?.data?.originalSourceUuid ?? null;
        if (storedRasterLayer.data.sourceUuid && storedRasterLayer.data.sourceUuid != originalSourceUuid) {
            (storedRasterLayer.data as any).originalSourceUuid = originalSourceUuid;
            const imageCanvas = await prepareStoredImageForEditing(storedRasterLayer.data.sourceUuid);
            if (imageCanvas) {
                const imageBlob = await createImageBlobFromCanvas(imageCanvas);
                const transaction = (database as IDBDatabase).transaction('images', 'readwrite');
                const imagesStore = transaction.objectStore('images');
                if (updateWorkingFileLayerRequestIds.get(layer.id) !== requestId) return;
                const imageStoreRequest = imagesStore.put({
                    id: storedRasterLayer.data.sourceUuid,
                    data: imageBlob,
                });
                putRequests.push(
                    new Promise<Event>((resolve, reject) => {
                        imageStoreRequest.onsuccess = resolve;
                        imageStoreRequest.onerror = reject;
                    })
                );
            }
        } else {
            storedRasterLayer.data.sourceUuid = originalSourceUuid;
        }
    } else if (storedLayer.type === 'rasterSequence') {
        const storedRasterSequenceLayer = storedLayer as WorkingFileRasterSequenceLayer;
        for (const [frameIndex, frame] of storedRasterSequenceLayer.data.sequence.entries()) {
            frame.thumbnailImageSrc = null;
            frame.image.tileUpdates = undefined;
            let originalSourceUuid = null;
            const existingFrame = (existingLayer as unknown as WorkingFileRasterSequenceLayer)?.data?.sequence?.[frameIndex] ?? null;
            if (existingFrame) {
                originalSourceUuid = (existingFrame?.image as any)?.originalSourceUuid ?? null;
            }
            if (frame.image.sourceUuid && frame.image.sourceUuid != originalSourceUuid) {
                const imageCanvas = await prepareStoredImageForEditing(frame.image.sourceUuid);
                if (imageCanvas) {
                    const imageBlob = await createImageBlobFromCanvas(imageCanvas);
                    const transaction = (database as IDBDatabase).transaction('images', 'readwrite');
                    const imagesStore = transaction.objectStore('images');
                    if (updateWorkingFileLayerRequestIds.get(layer.id) !== requestId) return;
                    const imageStoreRequest = imagesStore.put({
                        id: frame.image.sourceUuid,
                        data: imageBlob,
                    });
                    putRequests.push(
                        new Promise<Event>((resolve, reject) => {
                            imageStoreRequest.onsuccess = resolve;
                            imageStoreRequest.onerror = reject;
                        })
                    );
                }
            } else {
                frame.image.sourceUuid = originalSourceUuid ?? undefined;
            }
        }
    } else if (storedLayer.type === 'vector') {
        const storedVectorLayer = storedLayer as SerializedFileVectorLayer;
        const workingVectorLayer = layer as WorkingFileVectorLayer;
        const originalSourceUuid = (existingLayer as any)?.data?.originalSourceUuid ?? null;
        if (workingVectorLayer.data.sourceUuid && workingVectorLayer.data.sourceUuid != originalSourceUuid) {
            storedVectorLayer.data.sourceSvgSerialized = getStoredSvgDataUrl(workingVectorLayer.data.sourceUuid) ?? undefined;
        }
    } else if (storedLayer.type === 'video') {
        const storedVideoLayer = storedLayer as SerializedFileVideoLayer;
        const workingVideoLayer = layer as WorkingFileVideoLayer;
        const originalSourceUuid = (existingLayer as any)?.data?.originalSourceUuid ?? null;
        if (workingVideoLayer.data.sourceUuid && workingVideoLayer.data.sourceUuid != originalSourceUuid) {
            storedVideoLayer.data.sourceVideoSerialized = getStoredVideoDataUrl(workingVideoLayer.data.sourceUuid) ?? undefined;
        }
    }

    if (workingFile?.masks) {
        let hasMasks = false;
        for (const filter of layer.filters) {
            if (filter.maskId != null) {
                const mask = workingFile.masks[filter.maskId];
                if (mask) {
                    hasMasks = true;
                    const imageCanvas = await prepareStoredImageForEditing(mask.sourceUuid);
                    if (imageCanvas) {
                        const imageBlob = await createImageBlobFromCanvas(imageCanvas);
                        const transaction = (database as IDBDatabase).transaction('images', 'readwrite');
                        const imagesStore = transaction.objectStore('images');
                        if (updateWorkingFileLayerRequestIds.get(layer.id) !== requestId) return;
                        const imageStoreRequest = imagesStore.put({
                            id: mask.sourceUuid,
                            data: imageBlob,
                        });
                        putRequests.push(
                            new Promise<Event>((resolve, reject) => {
                                imageStoreRequest.onsuccess = resolve;
                                imageStoreRequest.onerror = reject;
                            })
                        );
                    }
                }
            }
        }
        if (hasMasks) {
            updateWorkingFileMasks(
                workingFile.masks,
                workingFile.maskIdCounter
                    ?? (parseInt(Object.keys(workingFile.masks).sort((a, b) => (a < b ? 1 : -1))[0]) + 1)
            );
        }
    }

    if (updateWorkingFileLayerRequestIds.get(layer.id) !== requestId) return;
    const transaction = (database as IDBDatabase).transaction('layers', 'readwrite');
    const layersStore = transaction.objectStore('layers');
    const request = layersStore.put(deepToRaw(storedLayer));
    putRequests.push(
        new Promise<Event>((resolve, reject) => {
            request.onsuccess = resolve;
            request.onerror = reject;
        })
    );

    return Promise.all(putRequests) as unknown as Promise<void>;
}

/** Reads the working file from the database */
export async function readWorkingFile(): Promise<WorkingFile<ColorModel>> {
    await init();
    if (!database) throw new Error('Database not created.');

    const workingFile: Partial<WorkingFile<ColorModel>> = {};

    const transaction = database.transaction(['meta', 'layers', 'images'], 'readonly');
    const metaStore = transaction.objectStore('meta');
    const metaRequest = metaStore.getAll();
    const metaResults = await new Promise<DatabaseMeta[]>((resolve, reject) => {
        metaRequest.onsuccess = () => {
            resolve(metaRequest.result);
        };
        metaRequest.onerror = reject;
    });
    let layers: DatabaseMetaLayer[] = [];
    for (const meta of metaResults) {
        if (meta.id === 'layers') {
            layers = meta.data;
        } else if (meta.id === 'masks') {
            let databaseMasks = meta.data;
            let masks: Record<number, WorkingFileLayerMask> = {};
            for (const maskId of Object.keys(meta.data).map(key => parseInt(key))) {
                const mask = databaseMasks[maskId];
                try {
                    masks[maskId] = {
                        sourceUuid: await readStoredImage(mask.sourceUuid),
                        hash: mask.hash,
                        offset: mask.offset,
                    };
                } catch {
                    console.warn('[src/store/data/working-file-database.ts] Failed to read a mask image from the store.');
                }
            }
            workingFile.masks = masks;
        } else {
            workingFile[meta.id as keyof WorkingFile<ColorModel>] = meta.data;
        }
    }
    workingFile.layers = await readStoredLayersRecursive(layers, workingFile);

    workingFile.masks = workingFile.masks ?? {};

    return workingFile as WorkingFile<ColorModel>;
}

export async function hasWorkingFile(): Promise<boolean> {
    await init();
    if (!database) throw new Error('Database not created.');

    const transaction = database.transaction('layers', 'readonly');
    const layersStore = transaction.objectStore('layers');
    const layersRequest = layersStore.getAll();

    return new Promise<boolean>((resolve, reject) => {
        layersRequest.onsuccess = () => {
            resolve(layersRequest.result?.length > 0);
        }
        layersRequest.onerror = reject;
    });
}
