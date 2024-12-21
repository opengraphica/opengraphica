import { v4 as uuidv4 } from 'uuid';

// Map of uuid to image store data

interface StoredVideo {
    sourceVideo: HTMLVideoElement | null; // This is used during rendering
    sourceDataUrl: string | null; // This is used during exporting
}

const videoUuidMap = new Map<string | undefined, StoredVideo>();
const videoUserUuidMap = new Map<string, Set<string>>();

/**
 * Creates a stored video from the given video element.
 * @param video - HTML video that contains video data
 * @returns uuid that can be used to retrieve it later
 */
export async function createStoredVideo(video: HTMLVideoElement): Promise<string> {
    const sourceVideo: HTMLVideoElement = video;
    const sourceBlob = await (await fetch(video.src)).blob();

    const sourceDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(sourceBlob);
    });

    const storedVideo: StoredVideo = {
        sourceVideo,
        sourceDataUrl,
    };
    const uuid = uuidv4();
    videoUuidMap.set(uuid, storedVideo);
    return uuid;
}

/**
 * Synchronously retrieves the video instance associated with the video, for rendering.
 */
export function getStoredVideo(uuid?: string): HTMLVideoElement | null {
    const storedVideo = videoUuidMap.get(uuid);
    return storedVideo?.sourceVideo ?? null;
}

/**
 * Synchronously retrieves the data URL representation of the video, for exporting.
 */
export function getStoredVideoDataUrl(uuid?: string): string | null {
    const storedVideo = videoUuidMap.get(uuid);
    return storedVideo?.sourceDataUrl ?? null;
}

/**
 * Releases the stored video from memory, and from the database.
 * @param uuid - ID of the database entry for the video
 */
export async function deleteStoredVideo(uuid: string) {
    const storedVideo = videoUuidMap.get(uuid);
    if (!storedVideo) return;
    videoUuidMap.delete(uuid);
    if (storedVideo.sourceVideo) {
        URL.revokeObjectURL(storedVideo.sourceVideo.src);
        storedVideo.sourceVideo = null;
    }
    if (storedVideo.sourceDataUrl) {
        storedVideo.sourceDataUrl = null;
    }
}

/**
 * Adds to the user count of the stored video, preventing its deletion.
 * @param uuid - ID of the database entry for the video
 */
export function reserveStoredVideo(uuid: string, userId: string) {
    let users = videoUserUuidMap.get(uuid) ?? new Set<string>();
    users.add(userId);
    videoUserUuidMap.set(uuid, users);
}

/**
 * Subtracts from the user count of the stored video, allowing its deletion.
 * @param uuid - ID of the database entry for the video
 */
export function unreserveStoredVideo(uuid: string, userId: string) {
    let users = videoUserUuidMap.get(uuid) ?? new Set<string>();
    users.delete(userId);
    videoUserUuidMap.set(uuid, users);
    if (users.size === 0) {
        deleteStoredVideo(uuid);
    }
}
