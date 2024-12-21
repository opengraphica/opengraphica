import { reactive, toRaw } from 'vue';
import { deepToRaw } from '@/lib/vue';
import { assignLayerRenderer } from '@/canvas/renderers';
import { prepareStoredImageForEditing, reserveStoredImage, createStoredImage } from '@/store/image';
import { getStoredSvgDataUrl, createStoredSvg } from '@/store/svg';
import { createImageBlobFromCanvas, createImageFromBlob } from '@/lib/image';
import { getStoredVideoDataUrl, createStoredVideo } from '@/store/video';
import type {
    ColorModel, WorkingFile, WorkingFileGroupLayer, WorkingFileLayer, WorkingFileAnyLayer,
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

async function readStoredLayersRecursive(metaLayers: DatabaseMetaLayer[]): Promise<WorkingFileAnyLayer[]> {
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
            (layerResult as WorkingFileGroupLayer).layers = await readStoredLayersRecursive(metaLayer.layers);
        } else if (layerResult.type === 'raster') {
            const rasterLayer = layerResult as WorkingFileRasterLayer;
            if (rasterLayer.data.sourceUuid) {
                const transaction = (database as IDBDatabase).transaction('images', 'readonly');
                const imagesStore = transaction.objectStore('images');
                const getImageRequest = imagesStore.get(rasterLayer.data.sourceUuid);
                const imageBlob = await new Promise<DatabaseImage>((resolve, reject) => {
                    getImageRequest.onsuccess = () => {
                        resolve(getImageRequest.result);
                    };
                    getImageRequest.onerror = reject;
                });
                const image = await createImageFromBlob(imageBlob.data);
                const imageUuid = await createStoredImage(image);
                reserveStoredImage(imageUuid, `${layerResult.id}`);
                rasterLayer.data.sourceUuid = imageUuid;
            }
        } else if (layerResult.type === 'rasterSequence') {
            const rasterSequenceLayer = layerResult as WorkingFileRasterSequenceLayer;
            for (const frame of rasterSequenceLayer.data.sequence) {
                if (frame.image.sourceUuid) {
                    const transaction = (database as IDBDatabase).transaction('images', 'readonly');
                    const imagesStore = transaction.objectStore('images');
                    const getImageRequest = imagesStore.get(frame.image.sourceUuid);
                    const imageBlob = await new Promise<DatabaseImage>((resolve, reject) => {
                        getImageRequest.onsuccess = () => {
                            resolve(getImageRequest.result);
                        };
                        getImageRequest.onerror = reject;
                    });
                    const image = await createImageFromBlob(imageBlob.data);
                    const imageUuid = await createStoredImage(image);
                    reserveStoredImage(imageUuid, `${layerResult.id}`);
                    frame.image.sourceUuid = imageUuid;
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
        assignLayerRenderer(layerResult);
        layers.push(layerResult);
    }
    for (const layer of layers) {
        await layer.renderer.attach(layer);
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

export async function updateWorkingFileLayer(layer: WorkingFileLayer, assumeIsNew: boolean = false): Promise<void> {
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

    const storedLayer: Record<string, any> = { ...layer };
    storedLayer.thumbnailImageSrc = null;
    storedLayer.drafts = null;
    storedLayer.bakedImage = null;
    storedLayer.isBaking = false;
    storedLayer.transform = [layer.transform.a, layer.transform.b, layer.transform.c, layer.transform.d, layer.transform.e, layer.transform.f];
    delete storedLayer.renderer;
    delete storedLayer.layers;
    if (storedLayer.type === 'raster') {
        const storedRasterLayer = storedLayer as WorkingFileRasterLayer;
        storedRasterLayer.data.updateChunks = undefined;
        const originalSourceUuid = (existingLayer as any)?.data?.originalSourceUuid ?? null;
        if (storedRasterLayer.data.sourceUuid && storedRasterLayer.data.sourceUuid != originalSourceUuid) {
            (storedRasterLayer.data as any).originalSourceUuid = originalSourceUuid;
            const imageCanvas = await prepareStoredImageForEditing(storedRasterLayer.data.sourceUuid);
            if (imageCanvas) {
                const imageBlob = await createImageBlobFromCanvas(imageCanvas);
                const transaction = (database as IDBDatabase).transaction('images', 'readwrite');
                const imagesStore = transaction.objectStore('images');
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
            frame.image.updateChunks = undefined;
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
                frame.image.sourceUuid = originalSourceUuid;
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
    for (const meta of metaResults) {
        if (meta.id === 'layers') {
            workingFile.layers = await readStoredLayersRecursive(meta.data);
        } else {
            workingFile[meta.id as keyof WorkingFile<ColorModel>] = meta.data;
        }
    }

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
