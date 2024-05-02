import { v4 as uuidv4 } from 'uuid';
import imageDatabase from './data/image-database';
import { createImageBlobFromCanvas, createImageBlobFromImage, createImageFromBlob, createCanvasFromImage } from '@/lib/image';

// Map of uuid to image store data

interface StoredImage {
    sourceCanvas: HTMLCanvasElement | null; // This is used during editing
    sourceImage: HTMLImageElement | null; // This is used when not editing, to save on memory
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
    let sourceCanvas = imageOrCanvas instanceof HTMLCanvasElement ? imageOrCanvas : null;
    let sourceImage = imageOrCanvas instanceof HTMLImageElement ? imageOrCanvas : null;
    const storedImage: StoredImage = {
        sourceCanvas,
        sourceImage,
        previewCanvas: null,
        lockedForEditing: false,
        databaseUuid: null,
    };
    (sourceCanvas ? createImageBlobFromCanvas(sourceCanvas) : createImageBlobFromImage(sourceImage!)).then((imageBlob) => {
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
export function getStoredImageOrCanvas(uuid?: string): HTMLImageElement | HTMLCanvasElement | null {
    const storedImage = imageUuidMap.get(uuid);
    return storedImage?.sourceCanvas ?? storedImage?.sourceImage ?? null;
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
        let sourceImage: HTMLImageElement | undefined = undefined;
        if (storedImage.sourceImage?.src && await isObjectUrlValid(storedImage.sourceImage.src)) {
            sourceImage = storedImage.sourceImage;
        } else if (storedImage.databaseUuid) {
            sourceImage = await createImageFromBlob(await imageDatabase.get<Blob>(storedImage.databaseUuid));
        }
        if (!sourceImage) return null;
        try {
            const canvas = await createCanvasFromImage(sourceImage);
            URL.revokeObjectURL(sourceImage.src);
            storedImage.sourceImage = null;
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
    if (storedImage.sourceImage) {
        URL.revokeObjectURL(storedImage.sourceImage.src);
        storedImage.sourceImage = null;
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