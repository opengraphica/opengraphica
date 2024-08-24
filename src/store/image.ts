import { v4 as uuidv4 } from 'uuid';
import imageDatabase from './data/image-history-database';
import canvasStore from './canvas';
import { createImageBlobFromCanvas, createImageBlobFromImageBitmap, createCanvasFromImage } from '@/lib/image';

// Map of uuid to image store data

interface StoredImage {
    sourceCanvas: HTMLCanvasElement | null; // This is used during editing
    sourceBitmap: ImageBitmap | null; // This is used when not editing, to save on memory
    previewCanvas: HTMLCanvasElement | null; // This is used to store a lower resolution canvas for performance intensive editing
    lockedForEditing: boolean;
    databaseUuid: string | null; // Can be null if failed to store a backup in the database
}

const imageUuidMap = new Map<string | undefined, StoredImage>();
const imageUserUuidMap = new Map<string, Set<string>>();

// Utility

async function isObjectUrlValid(url: string): Promise<boolean> {
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Creates a stored image from the image data on the given canvas.
 * @param canvas - HTML canvas that contains image data
 * @returns uuid that can be used to retrieve it later
 */
export async function createStoredImage(imageOrCanvas: HTMLCanvasElement | HTMLImageElement): Promise<string> {
    let sourceCanvas: HTMLCanvasElement | null = null;
    let sourceBitmap: ImageBitmap | null = null;
    if (imageOrCanvas instanceof HTMLCanvasElement) {
        sourceCanvas = imageOrCanvas;
    } else {
        const rendererType = canvasStore.get('renderer');
        const maxTextureSize = rendererType === 'webgl' ? canvasStore.get('threejsRenderer')?.capabilities?.maxTextureSize ?? 2048 : Infinity;
        if (imageOrCanvas.width > maxTextureSize || imageOrCanvas.height > maxTextureSize) {
            sourceCanvas = createCanvasFromImage(imageOrCanvas);
        } else {
            sourceBitmap = await createImageBitmap(imageOrCanvas, 0, 0, imageOrCanvas.width, imageOrCanvas.height, {
                imageOrientation: rendererType === '2d' ? 'none' : 'flipY',
                premultiplyAlpha: 'none',
            });
        }
        if (imageOrCanvas instanceof HTMLImageElement) {
            URL.revokeObjectURL(imageOrCanvas.src);
        }
    }
    const storedImage: StoredImage = {
        sourceCanvas,
        sourceBitmap,
        previewCanvas: null,
        lockedForEditing: false,
        databaseUuid: null,
    };
    (sourceCanvas ? createImageBlobFromCanvas(sourceCanvas) : createImageBlobFromImageBitmap(sourceBitmap!)).then((imageBlob) => {
        imageDatabase.add(imageBlob).then((databaseUuid) => {
            storedImage.databaseUuid = databaseUuid;
        });
    });
    const uuid = uuidv4();
    imageUuidMap.set(uuid, storedImage);
    return uuid;
}

/**
 * Returns the archived image or HTML canvas in memory which can be used to draw on to a canvas.
 * @param uuid - ID of the database entry for the image
 * @returns The image, or null if somehow it doesn't exist
 */
export function getStoredImageOrCanvas(uuid?: string): ImageBitmap | HTMLCanvasElement | null {
    const storedImage = imageUuidMap.get(uuid);
    return storedImage?.sourceCanvas ?? storedImage?.sourceBitmap ?? null;
}

/**
 * Returns the stored image as a canvas element, but does not guarantee it is the original canvas. So don't try to edit it.
 * @param uuid - ID of the database entry for the image
 * @returns The image canvas, or null if somehow it doesn't exist
 */
export async function getStoredImageCanvas(uuid?: string): Promise<HTMLCanvasElement | null> {
    const storedImage = imageUuidMap.get(uuid);
    const image = storedImage?.sourceCanvas ?? storedImage?.sourceBitmap ?? null;
    if (image instanceof ImageBitmap) {
        return await createCanvasFromImage(image);
    }
    return image ?? null;
}

/**
 * Converts the stored image to an HTML canvas if it isn't one already and returns it. Prevents auto-conversion back to an Image object.
 * @param uuid - ID of the database entry for the image
 * @returns The canvas source of the image, or null if a problem occurred
 */
export async function prepareStoredImageForEditing(uuid?: string): Promise<HTMLCanvasElement | null> {
    const storedImage = imageUuidMap.get(uuid);
    if (!storedImage) return null;
    if (storedImage.sourceCanvas == null) {
        let sourceBitmap = storedImage.sourceBitmap;
        if (!sourceBitmap && storedImage.databaseUuid) {
            const imageBlob = await imageDatabase.get<Blob>(storedImage.databaseUuid);
            let width = 1;
            let height = 1;
            const imageBlobUrl = URL.createObjectURL(imageBlob);
            await new Promise<void>((resolve) => {
                const image = new Image();
                image.src = imageBlobUrl;
                image.onload = () => {
                    width = image.width;
                    height = image.height;
                    resolve();
                };
                image.onerror = () => {
                    resolve();
                }
            });
            URL.revokeObjectURL(imageBlobUrl);
            sourceBitmap = await createImageBitmap(
                await imageDatabase.get<Blob>(storedImage.databaseUuid),
                0, 0, width, height, {
                    imageOrientation: canvasStore.get('renderer') === '2d' ? 'none' : 'flipY',
                    premultiplyAlpha: 'none',
                }
            );
        }
        if (!sourceBitmap) return null;
        try {
            const canvas = await createCanvasFromImage(sourceBitmap, { imageOrientation: 'flipY' });
            storedImage.sourceCanvas = canvas;
        } catch (error) {
            return null;
        }
    }
    storedImage.lockedForEditing = true;
    return storedImage.sourceCanvas;
}

/**
 * Call when the image is no longer being edited, so it can eventually be archived back to a PNG.
 * @param uuid - ID of the database entry for the image
 */
export async function prepareStoredImageForArchival(uuid?: string) {
    const storedImage = imageUuidMap.get(uuid);
    if (!storedImage) return;
    storedImage.lockedForEditing = false;
}

/**
 * Releases the stored image from memory, and from the database.
 * @param uuid - ID of the database entry for the image
 */
 export async function deleteStoredImage(uuid: string) {
    const storedImage = imageUuidMap.get(uuid);
    if (!storedImage) return;
    imageUuidMap.delete(uuid);
    if (storedImage.sourceCanvas) {
        storedImage.sourceCanvas = null;
    }
    if (storedImage.previewCanvas) {
        storedImage.previewCanvas = null;
    }
    if (storedImage.sourceBitmap) {
        storedImage.sourceBitmap.close();
        storedImage.sourceBitmap = null;
    }
    if (storedImage.databaseUuid) {
        imageDatabase.delete(storedImage.databaseUuid);
    }
}

/**
 * Adds to the user count of the stored image, preventing its deletion.
 * @param uuid - ID of the database entry for the image
 */
export function reserveStoredImage(imageUuid: string, userId: string) {
    let users = imageUserUuidMap.get(imageUuid) ?? new Set<string>();
    users.add(userId);
    imageUserUuidMap.set(imageUuid, users);
}

/**
 * Subtracts from the user count of the stored image, allowing its deletion.
 * @param uuid - ID of the database entry for the image
 */
export function unreserveStoredImage(imageUuid: string, userId: string) {
    let users = imageUserUuidMap.get(imageUuid) ?? new Set<string>();
    users.delete(userId);
    imageUserUuidMap.set(imageUuid, users);
    if (users.size === 0) {
        deleteStoredImage(imageUuid);
    }
}
