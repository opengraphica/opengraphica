import { v4 as uuidv4 } from 'uuid';

// Map of uuid to image store data

interface StoredSvg {
    sourceImage: HTMLImageElement | null; // This is used during rendering
    sourceDataUrl: string | null; // This is used during exporting
}

const svgUuidMap = new Map<string | undefined, StoredSvg>();
const svgUserUuidMap = new Map<string, Set<string>>();

/**
 * Creates a stored svg from the given image element.
 * @param image - HTML image that contains image data
 * @returns uuid that can be used to retrieve it later
 */
export async function createStoredSvg(image: HTMLImageElement): Promise<string> {
    const sourceImage: HTMLImageElement = image;
    const sourceBlob = await (await fetch(image.src)).blob();

    const sourceDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(sourceBlob);
    });

    const storedSvg: StoredSvg = {
        sourceImage,
        sourceDataUrl,
    };
    const uuid = uuidv4();
    svgUuidMap.set(uuid, storedSvg);
    return uuid;
}

/**
 * Synchronously retrieves the image instance associated with the SVG, for rendering.
 */
export function getStoredSvgImage(uuid?: string): HTMLImageElement | null {
    const storedSvg = svgUuidMap.get(uuid);
    return storedSvg?.sourceImage ?? null;
}

/**
 * Synchronously retrieves the data URL representation of the SVG, for exporting.
 */
export function getStoredSvgDataUrl(uuid?: string): string | null {
    const storedSvg = svgUuidMap.get(uuid);
    return storedSvg?.sourceDataUrl ?? null;
}


/**
 * Releases the stored svg from memory, and from the database.
 * @param uuid - ID of the database entry for the svg
 */
export async function deleteStoredSvg(uuid: string) {
    const storedSvg = svgUuidMap.get(uuid);
    if (!storedSvg) return;
    svgUuidMap.delete(uuid);
    if (storedSvg.sourceImage) {
        URL.revokeObjectURL(storedSvg.sourceImage.src);
        storedSvg.sourceImage = null;
    }
    if (storedSvg.sourceDataUrl) {
        storedSvg.sourceDataUrl = null;
    }
}

/**
 * Adds to the user count of the stored svg, preventing its deletion.
 * @param uuid - ID of the database entry for the svg
 */
export function reserveStoredSvg(uuid: string, userId: string) {
    let users = svgUserUuidMap.get(uuid) ?? new Set<string>();
    users.add(userId);
    svgUserUuidMap.set(uuid, users);
}

/**
 * Subtracts from the user count of the stored svg, allowing its deletion.
 * @param uuid - ID of the database entry for the svg
 */
export function unreserveStoredSvg(uuid: string, userId: string) {
    let users = svgUserUuidMap.get(uuid) ?? new Set<string>();
    users.delete(userId);
    svgUserUuidMap.set(uuid, users);
    if (users.size === 0) {
        deleteStoredSvg(uuid);
    }
}

